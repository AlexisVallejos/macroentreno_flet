import { query } from '../../config/db.js';
import { today } from '../../utils/dates.js';
import { HttpError, badGateway } from '../../utils/httpError.js';
import { TIMEOUT_MS, createResponse, functionCalls, outputText, speak, transcribe } from './openai.js';
import { TOOLS, runTool } from './ai.tools.js';

/** Vueltas máximas de herramientas por mensaje: evita bucles si el modelo insiste. */
const MAX_TOOL_ROUNDS = 6;
/** Tiempo total para contestar un mensaje (la app espera 90 s): cada vuelta usa lo que queda. */
const CHAT_BUDGET_MS = 80_000;
/** Si queda menos que esto no se arranca otra vuelta: se contesta con lo que ya se hizo. */
const MIN_ROUND_MS = 5_000;
/** Historial que se manda al modelo: los últimos mensajes hasta este total de caracteres. */
const HISTORY_CHARS = 12_000;
const ROLE_LABEL = { athlete: 'atleta', coach: 'entrenador', admin: 'administrador' };

const ROLE_CONTEXT = {
  athlete: (me) =>
    `Es atleta${me.coachName ? ` y su entrenador es ${me.coachName}` : ''}: ayudalo a cumplir sus objetivos de macros y a entrenar con constancia.`,
  coach: () =>
    'Es entrenador: además de su propio diario, puede pedirte ideas de rutinas o planes para sus atletas. Las herramientas solo registran en SU cuenta; si quiere cargarle algo a un atleta, armale el plan y decile que lo asigne desde la sección de sus atletas.',
  admin: () => 'Es administrador de la app: puede usarte como cualquier usuario y también agregar ejercicios al catálogo.',
};

async function profile(user) {
  const [[me], [eaten]] = await Promise.all([
    query(
      `SELECT u.name, u.kcal_goal AS kcal, u.protein_goal AS protein, u.carbs_goal AS carbs, u.fat_goal AS fat, c.name AS coachName
       FROM users u LEFT JOIN users c ON c.id = u.coach_id WHERE u.id = ?`,
      [user.id],
    ),
    query(
      `SELECT COALESCE(SUM(kcal), 0) AS kcal, COALESCE(SUM(protein), 0) AS protein, COALESCE(SUM(carbs), 0) AS carbs,
              COALESCE(SUM(fat), 0) AS fat, COUNT(*) AS entries
       FROM diary_entries WHERE user_id = ? AND entry_date = ?`,
      [user.id, today()],
    ),
  ]);
  return { ...me, eaten };
}

const hhmm = (date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
const whole = (n) => Math.round(Number(n));

function instructions(user, me) {
  const e = me.eaten;
  const progress = Number(e.entries)
    ? `Hasta ahora hoy registró ${whole(e.kcal)} kcal, ${whole(e.protein)} g proteína, ${whole(e.carbs)} g carbohidratos y ${whole(e.fat)} g grasas (${e.entries} registros).`
    : 'Todavía no registró comidas hoy.';
  return `Sos el asistente de MacroEntreno, una app argentina de nutrición y gimnasio. Hablás en español rioplatense, cálido y directo, como un entrenador personal.
Usuario: ${me.name} (${ROLE_LABEL[user.role]}). ${ROLE_CONTEXT[user.role]?.(me) ?? ''}
Hoy es ${today()} y son las ${hhmm(new Date())}. Objetivos diarios: ${me.kcal} kcal, ${me.protein} g proteína, ${me.carbs} g carbohidratos, ${me.fat} g grasas.
${progress} Si registrás algo nuevo o te preguntan por otro día, usá resumen_del_dia para tener los números al día.

Qué podés hacer con las herramientas: buscar alimentos, registrar comidas en el diario, crear alimentos propios, ver el resumen del día, buscar ejercicios, registrar o planificar entrenamientos${['coach', 'admin'].includes(user.role) ? ' y agregar ejercicios al catálogo' : ''}.

Reglas:
- Si te mandan una foto de comida: identificá cada alimento, estimá los gramos usando referencias visibles (plato ~26 cm, cubiertos, manos, envases) y calculá kcal y macros. Decí qué es, cuánto pesa aproximadamente y los macros, y aclará que es una estimación.
- Si te piden registrar algo ("anotalo", "agregalo", "ponémelo"), hacelo con registrar_comida. Si mandan solo una foto sin pedir nada, mostrá la estimación y preguntá si la registrás y en qué comida.
- Para productos envasados o comunes, buscá primero con buscar_alimentos y usá el foodId si coincide.
- Si no dicen la comida, inferila por la hora (desayuno hasta las 11, almuerzo 11 a 15, merienda 15 a 19, cena desde las 19) o por el contexto.
- Para entrenamientos, buscá los ejercicios en el catálogo y usá su exerciseId; si te piden una rutina, armala con series y repeticiones realistas.
- Si una herramienta devuelve un error, no digas que lo hiciste: explicá qué faltó o corregí los datos y probá de nuevo.
- Si el pedido es ambiguo (cantidad, día o comida imposibles de inferir), hacé una sola pregunta corta antes de registrar.
- Cuando te pregunten cuánto les falta, calculalo con los objetivos y lo registrado, y sugerí algo concreto para completarlo.
- Respondé breve (2 a 5 oraciones), sin tablas ni markdown pesado: la respuesta también se puede escuchar en voz alta. Usá números redondos.
- No des consejos médicos; ante dolor, lesiones o trastornos alimentarios, sugerí consultar a un profesional.`;
}

const messageSize = (m) => (m.text?.length ?? 0) + (m.image ? 500 : 0);

/**
 * Recorta el historial: los últimos mensajes que entran en HISTORY_CHARS (el último siempre va) y
 * sin respuestas del asistente al principio, para que la charla arranque con el usuario.
 */
export function trimHistory(messages) {
  const kept = [];
  let size = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    size += messageSize(messages[i]);
    if (kept.length && size > HISTORY_CHARS) break;
    kept.unshift(messages[i]);
  }
  while (kept.length > 1 && kept[0].role === 'assistant') kept.shift();
  return kept;
}

/** Mensajes de la app → input de la Responses API. Solo el último mensaje lleva imagen (ahorra tokens). */
function toInput(messages) {
  return messages.map((m, i) => {
    if (m.role === 'assistant') return { role: 'assistant', content: m.text };
    const content = [];
    if (m.text) content.push({ type: 'input_text', text: m.text });
    if (m.image && i === messages.length - 1) content.push({ type: 'input_image', image_url: m.image, detail: 'high' });
    else if (m.image) content.push({ type: 'input_text', text: '(Había adjuntado una foto.)' });
    return { role: 'user', content };
  });
}

/**
 * Chat con herramientas: el modelo puede llamar varias herramientas; se ejecutan con los permisos
 * del usuario y se le devuelven los resultados hasta que contesta con texto.
 * Devuelve la respuesta y la lista de cambios hechos (para que la app los muestre y refresque).
 */
export async function chat(user, messages) {
  const deadline = Date.now() + CHAT_BUDGET_MS;
  const timeoutMs = () => Math.min(TIMEOUT_MS, deadline - Date.now());
  const me = await profile(user);
  const system = instructions(user, me);
  const actions = [];
  let response = await createResponse({ instructions: system, input: toInput(trimHistory(messages)), tools: TOOLS, timeoutMs: timeoutMs() });

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const calls = functionCalls(response);
    if (!calls.length) break;
    const outputs = [];
    for (const call of calls) {
      const result = await runTool(user, call.name, call.arguments);
      if (result.action) actions.push(result.action);
      outputs.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result) });
    }
    if (deadline - Date.now() < MIN_ROUND_MS) {
      // Sin tiempo para otra vuelta: lo hecho ya quedó guardado y la app lo muestra en las acciones.
      if (actions.length) return { reply: 'Listo, ya quedó guardado.', actions };
      throw new HttpError(504, 'AI_TIMEOUT', 'El asistente tardó demasiado en responder, probá de nuevo');
    }
    response = await createResponse({ instructions: system, input: outputs, tools: TOOLS, previousResponseId: response.id, timeoutMs: timeoutMs() });
  }

  const reply = outputText(response);
  if (!reply && !actions.length) throw badGateway('AI_EMPTY', 'El asistente no devolvió respuesta, probá de nuevo');
  return { reply: reply || 'Listo.', actions };
}

const FOOD_PHOTO_SCHEMA = {
  name: 'analisis_comida',
  schema: {
    type: 'object',
    properties: {
      esComida: { type: 'boolean', description: 'false si la foto no muestra comida' },
      descripcion: { type: 'string', description: 'Una oración que describe el plato' },
      confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            nombre: { type: 'string' },
            gramos: { type: 'number' },
            kcal: { type: 'number' },
            proteinas: { type: 'number' },
            carbohidratos: { type: 'number' },
            grasas: { type: 'number' },
          },
          required: ['nombre', 'gramos', 'kcal', 'proteinas', 'carbohidratos', 'grasas'],
          additionalProperties: false,
        },
      },
    },
    required: ['esComida', 'descripcion', 'confianza', 'items'],
    additionalProperties: false,
  },
};

/**
 * Foto de un plato → alimentos con gramos y macros estimados. No registra nada: la app muestra el
 * resultado, el usuario ajusta los gramos y confirma.
 */
export async function analyzeFoodPhoto(image, note) {
  const response = await createResponse({
    instructions:
      'Sos nutricionista. Analizá la foto de comida: separá cada alimento visible, estimá su peso en gramos usando referencias (plato estándar ~26 cm, cubiertos, manos, envases) y calculá kcal y macros para ese peso con valores de tablas nutricionales (preferí comidas argentinas típicas cuando aplique: milanesa, empanadas, asado, mate cocido, facturas). Nombres en español. Si hay un envase con etiqueta legible, usá esos datos. Si no es comida, esComida=false e items vacío.',
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: note ? `Aclaración del usuario: ${note}` : 'Analizá este plato.' },
          { type: 'input_image', image_url: image, detail: 'high' },
        ],
      },
    ],
    schema: FOOD_PHOTO_SCHEMA,
  });
  try {
    return JSON.parse(outputText(response));
  } catch {
    throw badGateway('AI_ERROR', 'No se pudo interpretar el análisis de la foto, probá con otra');
  }
}

export async function transcribeAudio(base64, mimeType) {
  return { text: await transcribe(Buffer.from(base64, 'base64'), mimeType) };
}

export async function textToSpeech(text) {
  const audio = await speak(text);
  return { audio: audio.toString('base64'), mimeType: 'audio/mpeg' };
}
