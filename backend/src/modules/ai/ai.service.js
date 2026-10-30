import { query } from '../../config/db.js';
import { today } from '../../utils/dates.js';
import { badGateway } from '../../utils/httpError.js';
import { createResponse, functionCalls, outputText, speak, transcribe } from './openai.js';
import { TOOLS, runTool } from './ai.tools.js';

/** Vueltas máximas de herramientas por mensaje: evita bucles si el modelo insiste. */
const MAX_TOOL_ROUNDS = 6;
const ROLE_LABEL = { athlete: 'atleta', coach: 'entrenador', admin: 'administrador' };

async function profile(user) {
  const [row] = await query(
    'SELECT name, kcal_goal AS kcal, protein_goal AS protein, carbs_goal AS carbs, fat_goal AS fat FROM users WHERE id = ?',
    [user.id],
  );
  return row;
}

function instructions(user, me) {
  return `Sos el asistente de MacroEntreno, una app argentina de nutrición y gimnasio. Hablás en español rioplatense, cálido y directo, como un entrenador personal.
Usuario: ${me.name} (${ROLE_LABEL[user.role]}). Hoy es ${today()}. Objetivos diarios: ${me.kcal} kcal, ${me.protein} g proteína, ${me.carbs} g carbohidratos, ${me.fat} g grasas.

Qué podés hacer con las herramientas: buscar alimentos, registrar comidas en el diario, crear alimentos propios, ver el resumen del día, buscar ejercicios, registrar o planificar entrenamientos${['coach', 'admin'].includes(user.role) ? ' y agregar ejercicios al catálogo' : ''}.

Reglas:
- Si te mandan una foto de comida: identificá cada alimento, estimá los gramos usando referencias visibles (plato ~26 cm, cubiertos, manos, envases) y calculá kcal y macros. Decí qué es, cuánto pesa aproximadamente y los macros, y aclará que es una estimación.
- Si te piden registrar algo ("anotalo", "agregalo", "ponémelo"), hacelo con registrar_comida. Si mandan solo una foto sin pedir nada, mostrá la estimación y preguntá si la registrás y en qué comida.
- Para productos envasados o comunes, buscá primero con buscar_alimentos y usá el foodId si coincide.
- Si no dicen la comida, inferila por la hora o el contexto (desayuno, almuerzo, merienda, cena, snack).
- Para entrenamientos, buscá los ejercicios en el catálogo y usá su exerciseId; si te piden una rutina, armala con series y repeticiones realistas.
- Respondé breve (2 a 5 oraciones), sin tablas ni markdown pesado: la respuesta también se puede escuchar en voz alta. Usá números redondos.
- No des consejos médicos; ante dolor, lesiones o trastornos alimentarios, sugerí consultar a un profesional.`;
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
  const me = await profile(user);
  const actions = [];
  let response = await createResponse({ instructions: instructions(user, me), input: toInput(messages), tools: TOOLS });

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const calls = functionCalls(response);
    if (!calls.length) break;
    const outputs = [];
    for (const call of calls) {
      const result = await runTool(user, call.name, call.arguments);
      if (result.action) actions.push(result.action);
      outputs.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result) });
    }
    response = await createResponse({ instructions: instructions(user, me), input: outputs, tools: TOOLS, previousResponseId: response.id });
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
