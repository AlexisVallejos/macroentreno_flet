/**
 * Pruebas del asistente con IA contra un MySQL real temporal (mysql-memory-server).
 * OpenAI nunca se llama de verdad: cada prueba simula sus respuestas con setOpenAiFetch.
 */
import assert from 'node:assert/strict';
import { after, afterEach, before, describe, test } from 'node:test';
import { createDB } from 'mysql-memory-server';
import request from 'supertest';

const FAKE_KEY = 'sk-test-clave-falsa-de-pruebas';

let db;
let app;
let pool;
let env;
let openai;
const tokens = {};

const auth = (role) => ({ Authorization: `Bearer ${tokens[role].accessToken}` });
const jsonResponse = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
const textReply = (text, id = 'resp_ok') => jsonResponse({ id, output: [{ type: 'message', content: [{ type: 'output_text', text }] }] });
const openAiError = (status, code, message = 'error simulado') => jsonResponse({ error: { code, message } }, status);
const chat = (role, messages) => request(app).post('/api/ai/chat').set(auth(role)).send({ messages });
const hello = [{ role: 'user', text: 'hola' }];

/** Simula OpenAI con una lista de respuestas en orden y guarda cada pedido. */
function mockOpenAi(...responses) {
  const calls = [];
  openai.setOpenAiFetch(async (url, init) => {
    calls.push({ url, init, body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body });
    const next = responses[Math.min(calls.length - 1, responses.length - 1)];
    if (next instanceof Error) throw next;
    return next;
  });
  return calls;
}

/** Corre `fn` con otra clave de OpenAI y después restaura la de las pruebas. */
async function withKey(key, fn) {
  const previous = env.openai.apiKey;
  env.openai.apiKey = key;
  try {
    return await fn();
  } finally {
    env.openai.apiKey = previous;
  }
}

before(async () => {
  db = await createDB({ version: '8.4.x' });
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DB_HOST: '127.0.0.1',
    DB_PORT: String(db.port),
    DB_USER: db.username,
    DB_PASSWORD: '',
    DB_NAME: 'macroentreno_ai_test',
    OPENAI_API_KEY: FAKE_KEY,
    OPENAI_MODEL: 'modelo-de-prueba',
  });
  const { initDatabase } = await import('../scripts/db-init.js');
  ({ env } = await import('../src/config/env.js'));
  await initDatabase({ config: env.db });
  ({ pool } = await import('../src/config/db.js'));
  openai = await import('../src/modules/ai/openai.js');
  app = (await import('../src/app.js')).createApp();

  for (const [role, email] of [
    ['athlete', 'atleta@macroentreno.com'],
    ['coach', 'coach@macroentreno.com'],
  ]) {
    const res = await request(app).post('/api/auth/login').send({ email, password: 'Demo1234' });
    assert.equal(res.status, 200, res.text);
    tokens[role] = res.body.data.tokens;
  }
});

afterEach(() => openai.setOpenAiFetch());

after(async () => {
  await pool?.end();
  await db?.stop();
});

describe('asistente con IA: estado de la configuración', () => {
  test('GET /api/ai/status sin sesión → 401', async () => {
    const res = await request(app).get('/api/ai/status');
    assert.equal(res.status, 401);
  });

  test('con clave → configured true y el modelo, sin exponer la clave', async () => {
    const calls = mockOpenAi(textReply('no debería llamarse'));
    const res = await request(app).get('/api/ai/status').set(auth('athlete'));
    assert.equal(res.status, 200, res.text);
    assert.deepEqual(res.body.data, { configured: true, model: 'modelo-de-prueba' });
    assert.ok(!res.text.includes(FAKE_KEY));
    assert.equal(calls.length, 0, 'el estado no consulta a OpenAI');
  });

  test('sin clave → configured false', async () => {
    await withKey('', async () => {
      const res = await request(app).get('/api/ai/status').set(auth('athlete'));
      assert.equal(res.status, 200);
      assert.equal(res.body.data.configured, false);
      assert.equal(res.body.data.warning, undefined);
    });
  });

  test('clave con formato raro (no empieza con sk-) → configurada pero con aviso', async () => {
    await withKey('clave-pegada-mal', async () => {
      const res = await request(app).get('/api/ai/status').set(auth('athlete'));
      assert.equal(res.body.data.configured, true);
      assert.match(res.body.data.warning, /sk-/);
      assert.ok(!res.text.includes('clave-pegada-mal'));
    });
  });

  test('chat sin clave → 503 AI_NOT_CONFIGURED con dónde poner la clave, sin llamar a OpenAI', async () => {
    const calls = mockOpenAi(textReply('no debería llamarse'));
    await withKey('', async () => {
      const res = await chat('athlete', hello);
      assert.equal(res.status, 503);
      assert.equal(res.body.error.code, 'AI_NOT_CONFIGURED');
      assert.match(res.body.error.message, /backend\/\.env/);
      assert.match(res.body.error.message, /OPENAI_API_KEY/);
    });
    assert.equal(calls.length, 0);
  });
});

describe('asistente con IA: errores de OpenAI', () => {
  test('401 de OpenAI → 503 AI_INVALID_KEY "La clave de OpenAI es inválida" (sin reintentar)', async () => {
    const calls = mockOpenAi(openAiError(401, 'invalid_api_key', 'Incorrect API key provided: sk-test***'));
    const res = await chat('athlete', hello);
    assert.equal(res.status, 503);
    assert.equal(res.body.error.code, 'AI_INVALID_KEY');
    assert.match(res.body.error.message, /^La clave de OpenAI es inválida/);
    assert.ok(!res.text.includes('sk-test'), 'no se reenvía el detalle de OpenAI con la clave');
    assert.equal(calls.length, 1);
  });

  test('429 por límite de uso → se reintenta una vez y si sigue, 429 AI_RATE_LIMIT', async () => {
    const calls = mockOpenAi(openAiError(429, 'rate_limit_exceeded'));
    const res = await chat('athlete', hello);
    assert.equal(res.status, 429);
    assert.equal(res.body.error.code, 'AI_RATE_LIMIT');
    assert.match(res.body.error.message, /saturado/);
    assert.equal(calls.length, 2);
  });

  test('429 pasajero y después ok → el reintento contesta normalmente', async () => {
    const calls = mockOpenAi(openAiError(429, 'rate_limit_exceeded'), textReply('¡Hola! ¿En qué te ayudo?'));
    const res = await chat('athlete', hello);
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.data.reply, '¡Hola! ¿En qué te ayudo?');
    assert.equal(calls.length, 2);
  });

  test('429 sin saldo (insufficient_quota) → 503 AI_QUOTA sin reintentar', async () => {
    const calls = mockOpenAi(openAiError(429, 'insufficient_quota'));
    const res = await chat('athlete', hello);
    assert.equal(res.status, 503);
    assert.equal(res.body.error.code, 'AI_QUOTA');
    assert.match(res.body.error.message, /saldo/);
    assert.equal(calls.length, 1);
  });

  test('5xx de OpenAI → se reintenta una vez y después 502 AI_UNAVAILABLE', async () => {
    const calls = mockOpenAi(openAiError(500, 'server_error'), openAiError(503, 'server_error'));
    const res = await chat('athlete', hello);
    assert.equal(res.status, 502);
    assert.equal(res.body.error.code, 'AI_UNAVAILABLE');
    assert.equal(calls.length, 2);
  });

  test('modelo inexistente (404) → 503 AI_MODEL_NOT_FOUND que menciona OPENAI_MODEL', async () => {
    mockOpenAi(openAiError(404, 'model_not_found'));
    const res = await chat('athlete', hello);
    assert.equal(res.status, 503);
    assert.equal(res.body.error.code, 'AI_MODEL_NOT_FOUND');
    assert.match(res.body.error.message, /OPENAI_MODEL/);
  });

  test('sin conexión con OpenAI → 502 AI_UNREACHABLE', async () => {
    const calls = mockOpenAi(new TypeError('fetch failed'));
    const res = await chat('athlete', hello);
    assert.equal(res.status, 502);
    assert.equal(res.body.error.code, 'AI_UNREACHABLE');
    assert.equal(calls.length, 2);
  });

  test('OpenAI no contesta a tiempo → 504 AI_TIMEOUT', async () => {
    mockOpenAi(new DOMException('The operation timed out.', 'TimeoutError'));
    const res = await chat('athlete', hello);
    assert.equal(res.status, 504);
    assert.equal(res.body.error.code, 'AI_TIMEOUT');
  });

  test('los errores de la foto y la voz usan el mismo mapeo', async () => {
    mockOpenAi(openAiError(401, 'invalid_api_key'));
    const photo = await request(app).post('/api/ai/food-photo').set(auth('athlete')).send({ image: 'data:image/png;base64,iVBORw0KGgo=' });
    assert.equal(photo.body.error.code, 'AI_INVALID_KEY');
    const speech = await request(app).post('/api/ai/speech').set(auth('athlete')).send({ text: 'Hola' });
    assert.equal(speech.body.error.code, 'AI_INVALID_KEY');
  });
});

describe('asistente con IA: mensajes e historial', () => {
  const validationMessages = (res) => res.body.error.details.map((d) => d.message).join(' | ');

  test('mensaje demasiado largo → 400 con un motivo claro', async () => {
    const res = await chat('athlete', [{ role: 'user', text: 'a'.repeat(4001) }]);
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.match(validationMessages(res), /demasiado largo/);
  });

  test('sin mensajes, último mensaje del asistente o vacío → 400', async () => {
    for (const messages of [[], [...hello, { role: 'assistant', text: 'Hola' }], [{ role: 'user', text: '   ' }]]) {
      const res = await chat('athlete', messages);
      assert.equal(res.status, 400, JSON.stringify(messages));
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    }
  });

  test('más de 30 mensajes → 400', async () => {
    const messages = Array.from({ length: 31 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: `mensaje ${i}` }));
    const res = await chat('athlete', messages);
    assert.equal(res.status, 400);
    assert.match(validationMessages(res), /como máximo 30/);
  });

  test('el historial largo se recorta por tamaño y arranca con un mensaje del usuario', async () => {
    const calls = mockOpenAi(textReply('Dale'));
    const messages = Array.from({ length: 29 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: `${i} ${'x'.repeat(1500)}` }));
    const res = await chat('athlete', messages);
    assert.equal(res.status, 200, res.text);
    const { input } = calls[0].body;
    assert.ok(input.length < messages.length, `se mandaron ${input.length} mensajes`);
    assert.equal(input[0].role, 'user');
    assert.equal(input.at(-1).content[0].text, messages.at(-1).text, 'el último mensaje siempre va');
  });

  test('las instrucciones incluyen el rol, la hora y lo que lleva comido hoy', async () => {
    const calls = mockOpenAi(textReply('Vas bien'));
    await chat('coach', [{ role: 'user', text: '¿Cómo vengo hoy?' }]);
    const { instructions, model } = calls[0].body;
    assert.equal(model, 'modelo-de-prueba');
    assert.match(instructions, /\(entrenador\)/);
    assert.match(instructions, /son las \d{2}:\d{2}/);
    assert.match(instructions, /registró|Todavía no registró/);
    assert.match(instructions, /agregar ejercicios al catálogo/);
    assert.equal(calls[0].init.headers.Authorization, `Bearer ${FAKE_KEY}`);
  });
});
