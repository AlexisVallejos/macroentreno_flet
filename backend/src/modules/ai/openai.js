import { env } from '../../config/env.js';
import { badGateway, unavailable } from '../../utils/httpError.js';

/**
 * Cliente mínimo de la API de OpenAI (https://developers.openai.com/api): Responses API para el
 * chat con imágenes y herramientas, transcripción de audio y texto a voz. La clave vive solo en el
 * servidor: la app nunca la ve.
 */
const URL = 'https://api.openai.com/v1';
const TIMEOUT_MS = 60_000;

let fetcher = (...args) => fetch(...args);
/** Para las pruebas: reemplaza el fetch real por uno simulado (sin argumento vuelve al real). */
export function setOpenAiFetch(fn) {
  fetcher = fn ?? ((...args) => fetch(...args));
}

export const openAiConfigured = () => Boolean(env.openai.apiKey);

async function call(path, { json, form, binary = false }) {
  if (!openAiConfigured()) throw unavailable('AI_NOT_CONFIGURED', 'El asistente con IA no está configurado en el servidor (falta OPENAI_API_KEY)');
  let res;
  try {
    res = await fetcher(`${URL}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.openai.apiKey}`, ...(json ? { 'Content-Type': 'application/json' } : {}) },
      body: json ? JSON.stringify(json) : form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw badGateway('AI_ERROR', 'No se pudo conectar con el asistente, revisá la conexión');
  }
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    if (res.status === 429) throw badGateway('AI_RATE_LIMIT', 'El asistente está saturado, probá en unos segundos');
    throw badGateway('AI_ERROR', `El asistente no pudo responder${detail?.error?.message ? `: ${detail.error.message}` : ''}`);
  }
  return binary ? Buffer.from(await res.arrayBuffer()) : res.json();
}

/**
 * Una vuelta de la Responses API. `previousResponseId` encadena la respuesta anterior (con sus
 * llamadas a herramientas y razonamiento) para devolverle solo los resultados.
 */
export function createResponse({ instructions, input, tools, previousResponseId, schema }) {
  return call('/responses', {
    json: {
      model: env.openai.model,
      instructions,
      input,
      ...(tools?.length ? { tools } : {}),
      ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
      ...(schema ? { text: { format: { type: 'json_schema', name: schema.name, schema: schema.schema, strict: true } } } : {}),
    },
  });
}

/** Texto final de una respuesta (une todos los bloques output_text de los mensajes). */
export function outputText(response) {
  return (response.output ?? [])
    .filter((item) => item.type === 'message')
    .flatMap((item) => item.content ?? [])
    .filter((c) => c.type === 'output_text')
    .map((c) => c.text)
    .join('')
    .trim();
}

export const functionCalls = (response) => (response.output ?? []).filter((item) => item.type === 'function_call');

/** Audio (buffer) → texto en castellano. */
export async function transcribe(buffer, mimeType) {
  const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : mimeType.includes('wav') ? 'wav' : 'mp3';
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimeType }), `audio.${ext}`);
  form.append('model', env.openai.transcribeModel);
  form.append('language', 'es');
  const json = await call('/audio/transcriptions', { form });
  return (json.text ?? '').trim();
}

/** Texto → audio MP3 con voz natural en castellano rioplatense. */
export function speak(text) {
  return call('/audio/speech', {
    json: {
      model: env.openai.ttsModel,
      voice: env.openai.ttsVoice,
      input: text,
      instructions: 'Hablá en español rioplatense (Argentina), con tono cercano, claro y motivador, como un entrenador.',
      response_format: 'mp3',
    },
    binary: true,
  });
}
