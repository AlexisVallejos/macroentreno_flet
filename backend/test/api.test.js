/**
 * Pruebas de integración contra un MySQL real temporal (mysql-memory-server).
 * La primera ejecución descarga los binarios de MySQL; puede tardar unos minutos.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import { createDB } from 'mysql-memory-server';
import request from 'supertest';

let db;
let app;
let pool;
const tokens = {};

const auth = (role) => ({ Authorization: `Bearer ${tokens[role].accessToken}` });
const login = (email, password = 'Demo1234') => request(app).post('/api/auth/login').send({ email, password });

before(async () => {
  db = await createDB({ version: '8.4.x' });
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DB_HOST: '127.0.0.1',
    DB_PORT: String(db.port),
    DB_USER: db.username,
    DB_PASSWORD: '',
    DB_NAME: 'macroentreno_test',
    // Servicios externos con claves de prueba: las llamadas se simulan (setFatSecretFetch / setMercadoPagoFetch).
    FATSECRET_CONSUMER_KEY: 'test-key',
    FATSECRET_CONSUMER_SECRET: 'test-secret',
    FATSECRET_REGION: '',
    MERCADOPAGO_ACCESS_TOKEN: 'TEST-token',
    MERCADOPAGO_WEBHOOK_SECRET: 'secreto-webhook',
    PUBLIC_APP_URL: 'https://app.macroentreno.test',
    PRO_PRICE: '4999',
    OPENAI_API_KEY: 'test-openai',
  });
  const { initDatabase } = await import('../scripts/db-init.js');
  const { env } = await import('../src/config/env.js');
  await initDatabase({ config: env.db });
  ({ pool } = await import('../src/config/db.js'));
  app = (await import('../src/app.js')).createApp();

  for (const [role, email] of [
    ['admin', 'admin@macroentreno.com'],
    ['coach', 'coach@macroentreno.com'],
    ['athlete', 'atleta@macroentreno.com'],
    ['other', 'martina@macroentreno.com'],
  ]) {
    const res = await login(email);
    assert.equal(res.status, 200, res.text);
    tokens[role] = res.body.data.tokens;
  }
});

after(async () => {
  await pool?.end();
  await db?.stop();
});

describe('salud y errores generales', () => {
  test('GET /api/health responde ok', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.database, 'ok');
  });

  test('ruta inexistente → 404 con formato de error', async () => {
    const res = await request(app).get('/api/no-existe');
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'NOT_FOUND');
  });

  test('JSON mal formado → 400 INVALID_JSON', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{mal');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_JSON');
  });
});

describe('autenticación', () => {
  test('registro valida campos', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'A', email: 'no-es-email', password: '123' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    const fields = res.body.error.details.map((d) => d.field);
    assert.deepEqual(fields.sort(), ['email', 'name', 'password', 'password'].sort());
  });

  test('registro crea un atleta y devuelve tokens', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Nuevo Usuario', email: 'Nuevo@Mail.com', password: 'Clave1234' });
    assert.equal(res.status, 201, res.text);
    assert.equal(res.body.data.user.role, 'athlete');
    assert.equal(res.body.data.user.email, 'nuevo@mail.com');
    assert.ok(res.body.data.tokens.accessToken);
    assert.ok(res.body.data.tokens.refreshToken);
    assert.equal(res.body.data.user.passwordHash, undefined);
  });

  test('email duplicado → 409', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Otro', email: 'nuevo@mail.com', password: 'Clave1234' });
    assert.equal(res.status, 409);
  });

  test('credenciales incorrectas → 401 INVALID_CREDENTIALS', async () => {
    const res = await login('atleta@macroentreno.com', 'incorrecta1');
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
  });

  test('sin token → 401; token basura → 401 TOKEN_INVALID', async () => {
    assert.equal((await request(app).get('/api/auth/me')).status, 401);
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer basura');
    assert.equal(res.body.error.code, 'TOKEN_INVALID');
  });

  test('GET /auth/me devuelve el usuario con su coach', async () => {
    const res = await request(app).get('/api/auth/me').set(auth('athlete'));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.role, 'athlete');
    assert.equal(res.body.data.coachName, 'Coach Laura');
  });

  test('refresh rota el token y detecta reutilización', async () => {
    const { body } = await login('martina@macroentreno.com');
    const original = body.data.tokens.refreshToken;

    const first = await request(app).post('/api/auth/refresh').send({ refreshToken: original });
    assert.equal(first.status, 200);
    const rotated = first.body.data.tokens.refreshToken;
    assert.notEqual(rotated, original);

    const reuse = await request(app).post('/api/auth/refresh').send({ refreshToken: original });
    assert.equal(reuse.status, 401);
    assert.equal(reuse.body.error.code, 'REFRESH_REUSED');

    // Al detectar el robo se revocan todas las sesiones, incluida la rotada.
    const afterReuse = await request(app).post('/api/auth/refresh').send({ refreshToken: rotated });
    assert.equal(afterReuse.status, 401);
  });

  test('logout revoca el refresh token', async () => {
    const { body } = await login('martina@macroentreno.com');
    const { refreshToken } = body.data.tokens;
    assert.equal((await request(app).post('/api/auth/logout').send({ refreshToken })).status, 204);
    assert.equal((await request(app).post('/api/auth/refresh').send({ refreshToken })).status, 401);
  });

  test('login social sin configurar → 501; proveedor desconocido → 400', async () => {
    const challenge = 'a'.repeat(64);
    const res = await request(app).get(
      `/api/auth/oauth/google/start?redirect_uri=macroentreno://oauth-callback&code_challenge=${challenge}`,
    );
    assert.equal(res.status, 501);
    assert.equal(res.body.error.code, 'PROVIDER_NOT_CONFIGURED');
    const unknown = await request(app).get(`/api/auth/oauth/twitter/start?redirect_uri=x&code_challenge=${challenge}`);
    assert.equal(unknown.status, 400);
  });
});

describe('login social (flujo OAuth con proveedor simulado)', () => {
  const verifier = crypto.randomBytes(32).toString('hex');
  const challenge = crypto.createHash('sha256').update(verifier).digest('hex');
  let restore;

  before(async () => {
    const { env } = await import('../src/config/env.js');
    const { socialProviders } = await import('../src/modules/auth/socialProviders.js');
    const original = socialProviders.github.fetchProfile;
    env.social.githubClientId = 'test-client';
    env.social.githubClientSecret = 'test-secret';
    // Simula a GitHub: el código "existente" pertenece al atleta demo, "nuevo" a alguien sin email.
    socialProviders.github.fetchProfile = async (code) =>
      code === 'existente'
        ? { providerUserId: 'gh-1', email: 'atleta@macroentreno.com', name: 'Alexis GH', avatarUrl: null }
        : { providerUserId: 'gh-2', email: null, name: 'Sin Email', avatarUrl: 'https://example.com/a.png' };
    restore = () => {
      socialProviders.github.fetchProfile = original;
      env.social.githubClientId = '';
      env.social.githubClientSecret = '';
    };
  });
  after(() => restore());

  async function runFlow(providerCode, redirect = 'macroentreno://oauth-callback') {
    const start = await request(app).get(
      `/api/auth/oauth/github/start?redirect_uri=${encodeURIComponent(redirect)}&code_challenge=${challenge}`,
    );
    assert.equal(start.status, 302, start.text);
    const authorize = new URL(start.headers.location);
    assert.equal(authorize.host, 'github.com');
    assert.ok(authorize.searchParams.get('redirect_uri').endsWith('/api/auth/oauth/github/callback'));
    const state = authorize.searchParams.get('state');

    const callback = await request(app).get(`/api/auth/oauth/github/callback?code=${providerCode}&state=${state}`);
    assert.equal(callback.status, 302);
    return new URL(callback.headers.location);
  }

  test('GET /oauth/providers informa cuáles están configurados', async () => {
    const res = await request(app).get('/api/auth/oauth/providers');
    const byId = Object.fromEntries(res.body.data.map((p) => [p.id, p.configured]));
    assert.deepEqual(byId, { google: false, facebook: false, github: true });
  });

  test('rechaza redirect_uri que no es de la app', async () => {
    const res = await request(app).get(
      `/api/auth/oauth/github/start?redirect_uri=${encodeURIComponent('https://evil.com/x')}&code_challenge=${challenge}`,
    );
    assert.equal(res.status, 400);
  });

  test('vincula por email a un usuario existente y canjea el código con PKCE', async () => {
    const back = await runFlow('existente');
    assert.equal(back.protocol, 'macroentreno:');
    const code = back.searchParams.get('code');

    const exchange = await request(app).post('/api/auth/oauth/exchange').send({ code, codeVerifier: verifier });
    assert.equal(exchange.status, 200, exchange.text);
    assert.equal(exchange.body.data.user.id, 3);
    assert.ok(exchange.body.data.tokens.accessToken);

    const reuse = await request(app).post('/api/auth/oauth/exchange').send({ code, codeVerifier: verifier });
    assert.equal(reuse.status, 401); // un solo uso
  });

  test('verifier incorrecto → 401', async () => {
    const code = (await runFlow('existente')).searchParams.get('code');
    const res = await request(app)
      .post('/api/auth/oauth/exchange')
      .send({ code, codeVerifier: crypto.randomBytes(32).toString('hex') });
    assert.equal(res.status, 401);
  });

  test('crea un atleta nuevo si no hay email; la segunda vez reutiliza la cuenta', async () => {
    const first = await runFlow('nuevo', 'exp://192.168.0.10:8081/--/oauth-callback');
    const res = await request(app)
      .post('/api/auth/oauth/exchange')
      .send({ code: first.searchParams.get('code'), codeVerifier: verifier });
    assert.equal(res.body.data.user.role, 'athlete');
    assert.equal(res.body.data.user.email, null);
    assert.equal(res.body.data.user.hasPassword, false);

    const second = await runFlow('nuevo');
    const again = await request(app)
      .post('/api/auth/oauth/exchange')
      .send({ code: second.searchParams.get('code'), codeVerifier: verifier });
    assert.equal(again.body.data.user.id, res.body.data.user.id);
  });

  test('cancelación en el proveedor vuelve a la app con error', async () => {
    const start = await request(app).get(
      `/api/auth/oauth/github/start?redirect_uri=macroentreno://oauth-callback&code_challenge=${challenge}`,
    );
    const state = new URL(start.headers.location).searchParams.get('state');
    const res = await request(app).get(`/api/auth/oauth/github/callback?error=access_denied&state=${state}`);
    assert.equal(new URL(res.headers.location).searchParams.get('error'), 'cancelled');
  });
});

describe('roles y permisos', () => {
  test('athlete no puede listar usuarios ni ver estadísticas', async () => {
    assert.equal((await request(app).get('/api/users').set(auth('athlete'))).status, 403);
    assert.equal((await request(app).get('/api/admin/stats').set(auth('athlete'))).status, 403);
  });

  test('coach solo ve a sus atletas', async () => {
    const res = await request(app).get('/api/users').set(auth('coach'));
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.map((u) => u.email), ['atleta@macroentreno.com']);
    // Martina no está asignada a este coach
    assert.equal((await request(app).get('/api/users/4').set(auth('coach'))).status, 403);
    assert.equal((await request(app).get('/api/diary?date=2026-01-01&userId=4').set(auth('coach'))).status, 403);
  });

  test('coach puede leer el diario de su atleta pero no escribirlo', async () => {
    const date = new Date().toISOString().slice(0, 10);
    const read = await request(app).get(`/api/diary?date=${date}&userId=3`).set(auth('coach'));
    assert.equal(read.status, 200);
    const [entry] = read.body.data.entries;
    if (entry) {
      const write = await request(app).delete(`/api/diary/${entry.id}`).set(auth('coach'));
      assert.equal(write.status, 403);
    }
  });

  test('coach ajusta objetivos de su atleta', async () => {
    const res = await request(app).put('/api/users/3/goals').set(auth('coach')).send({ goals: { kcal: 1900 } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.goals.kcal, 1900);
  });

  test('admin: CRUD de usuarios y asignación de coach', async () => {
    const created = await request(app)
      .post('/api/users')
      .set(auth('admin'))
      .send({ name: 'Coach Nuevo', email: 'coach2@macroentreno.com', password: 'Clave1234', role: 'coach' });
    assert.equal(created.status, 201, created.text);
    const coachId = created.body.data.id;

    const bad = await request(app).put('/api/users/4').set(auth('admin')).send({ coachId: 3 });
    assert.equal(bad.status, 400); // 3 es atleta, no coach

    const assigned = await request(app).put('/api/users/4').set(auth('admin')).send({ coachId });
    assert.equal(assigned.status, 200);
    assert.equal(assigned.body.data.coachId, coachId);

    const self = await request(app).put('/api/users/1').set(auth('admin')).send({ role: 'athlete' });
    assert.equal(self.status, 400);

    const removed = await request(app).delete(`/api/users/${coachId}`).set(auth('admin'));
    assert.equal(removed.status, 204);
    const martina = await request(app).get('/api/users/4').set(auth('admin'));
    assert.equal(martina.body.data.coachId, null); // ON DELETE SET NULL
  });

  test('usuario desactivado no puede usar su token', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Baja', email: 'baja@mail.com', password: 'Clave1234' });
    const { id } = reg.body.data.user;
    await request(app).put(`/api/users/${id}`).set(auth('admin')).send({ isActive: false });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${reg.body.data.tokens.accessToken}`);
    assert.equal(res.status, 403);
  });

  test('admin ve estadísticas', async () => {
    const res = await request(app).get('/api/admin/stats').set(auth('admin'));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.usersByRole.coach, 1);
    assert.ok(res.body.data.foods.global >= 140);
  });
});

describe('alimentos', () => {
  test('búsqueda FULLTEXT por nombre y marca', async () => {
    const res = await request(app).get('/api/foods?search=alfajor havanna').set(auth('athlete'));
    assert.equal(res.status, 200);
    assert.ok(res.body.data.some((f) => f.name.includes('Havanna')), JSON.stringify(res.body.data));
    const brand = await request(app).get('/api/foods?search=marolio').set(auth('athlete'));
    assert.ok(brand.body.meta.total >= 3);
  });

  test('palabras cortas usan LIKE', async () => {
    const res = await request(app).get('/api/foods?search=de').set(auth('athlete'));
    assert.equal(res.status, 200);
    assert.ok(res.body.meta.total > 0);
  });

  test('athlete crea alimento propio pero no global', async () => {
    const body = { name: 'Tarta de verdura', kcal: 250, protein: 8, carbs: 25, fat: 12, portionGrams: 150 };
    const own = await request(app).post('/api/foods').set(auth('athlete')).send(body);
    assert.equal(own.status, 201);
    assert.equal(own.body.data.isGlobal, false);

    const global = await request(app).post('/api/foods').set(auth('athlete')).send({ ...body, isGlobal: true });
    assert.equal(global.status, 403);

    // Otro atleta no lo ve
    const other = await request(app).get(`/api/foods/${own.body.data.id}`).set(auth('other'));
    assert.equal(other.status, 404);

    const mine = await request(app).get('/api/foods?scope=mine').set(auth('athlete'));
    assert.equal(mine.body.meta.total, 2);
  });

  test('coach edita el catálogo global; athlete no', async () => {
    const list = await request(app).get('/api/foods?scope=global&limit=1').set(auth('athlete'));
    const id = list.body.data[0].id;
    assert.equal((await request(app).put(`/api/foods/${id}`).set(auth('athlete')).send({ kcal: 1 })).status, 403);
    const ok = await request(app).put(`/api/foods/${id}`).set(auth('coach')).send({ category: 'Revisado' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.category, 'Revisado');
  });
});

describe('diario', () => {
  let entryId;

  test('con foodId escala los macros por gramos', async () => {
    const search = await request(app).get('/api/foods?search=pollo pechuga').set(auth('athlete'));
    const chicken = search.body.data[0]; // 165 kcal / 31 g prot cada 100 g
    const res = await request(app)
      .post('/api/diary')
      .set(auth('athlete'))
      .send({ date: '2026-02-10', meal: 'almuerzo', foodId: chicken.id, grams: 150 });
    assert.equal(res.status, 201, res.text);
    assert.equal(res.body.data.kcal, 247.5);
    assert.equal(res.body.data.protein, 46.5);
    entryId = res.body.data.id;
  });

  test('carga manual y validaciones', async () => {
    const bad = await request(app).post('/api/diary').set(auth('athlete')).send({ date: '10/02/2026', meal: 'brunch', grams: -1 });
    assert.equal(bad.status, 400);
    const manual = await request(app)
      .post('/api/diary')
      .set(auth('athlete'))
      .send({ date: '2026-02-10', meal: 'cena', name: 'Milanesa casera', grams: 200, kcal: 450, protein: 35, carbs: 20, fat: 25 });
    assert.equal(manual.status, 201);
  });

  test('día con totales y objetivos', async () => {
    const res = await request(app).get('/api/diary?date=2026-02-10').set(auth('athlete'));
    assert.equal(res.body.data.entries.length, 2);
    assert.equal(res.body.data.entries[0].meal, 'almuerzo');
    assert.equal(res.body.data.totals.kcal, 697.5);
    assert.equal(res.body.data.goals.kcal, 1900);
  });

  test('editar gramos recalcula; otro usuario no puede editar', async () => {
    const res = await request(app).put(`/api/diary/${entryId}`).set(auth('athlete')).send({ grams: 100, meal: 'cena' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.kcal, 165);
    assert.equal(res.body.data.meal, 'cena');
    assert.equal((await request(app).put(`/api/diary/${entryId}`).set(auth('other')).send({ grams: 1 })).status, 403);
  });

  test('borrar', async () => {
    assert.equal((await request(app).delete(`/api/diary/${entryId}`).set(auth('athlete'))).status, 204);
    assert.equal((await request(app).delete(`/api/diary/${entryId}`).set(auth('athlete'))).status, 404);
  });
});

describe('ejercicios y entrenamientos', () => {
  let workoutId;

  test('catálogo: todos leen, solo coach/admin escriben', async () => {
    const list = await request(app).get('/api/exercises?muscleGroup=Pecho').set(auth('athlete'));
    assert.ok(list.body.data.length >= 3);
    const body = { name: 'Fondos en paralelas', muscleGroup: 'Triceps' };
    assert.equal((await request(app).post('/api/exercises').set(auth('athlete')).send(body)).status, 403);
    assert.equal((await request(app).post('/api/exercises').set(auth('coach')).send(body)).status, 201);
    assert.equal((await request(app).post('/api/exercises').set(auth('coach')).send(body)).status, 409);
  });

  test('coach carga una rutina a su atleta', async () => {
    const res = await request(app)
      .post('/api/workouts')
      .set(auth('coach'))
      .send({
        userId: 3,
        date: '2026-02-11',
        title: 'Espalda',
        exercises: [
          { exerciseId: 4, sets: [{ reps: 10, weight: 50 }, { reps: 8, weight: 55, rpe: 8 }] },
          { name: 'Dominadas', sets: [{ reps: 6 }] },
        ],
      });
    assert.equal(res.status, 201, res.text);
    assert.equal(res.body.data.userId, 3);
    assert.equal(res.body.data.createdByName, 'Coach Laura');
    assert.equal(res.body.data.exercises.length, 2);
    assert.equal(res.body.data.exercises[0].sets[1].rpe, 8);
    workoutId = res.body.data.id;

    // No puede cargar a un atleta ajeno
    const other = await request(app)
      .post('/api/workouts')
      .set(auth('coach'))
      .send({ userId: 4, date: '2026-02-11', title: 'Ajena', exercises: [{ name: 'Algo', sets: [{ reps: 1 }] }] });
    assert.equal(other.status, 403);
  });

  test('atleta ve, edita y borra su sesión', async () => {
    const list = await request(app).get('/api/workouts?from=2026-02-01&to=2026-02-28').set(auth('athlete'));
    assert.equal(list.body.data.length, 1);

    const put = await request(app)
      .put(`/api/workouts/${workoutId}`)
      .set(auth('athlete'))
      .send({ date: '2026-02-12', title: 'Espalda pesada', exercises: [{ name: 'Remo', sets: [{ reps: 5, weight: 80 }] }] });
    assert.equal(put.status, 200);
    assert.equal(put.body.data.exercises.length, 1);
    assert.equal((await request(app).get(`/api/workouts/${workoutId}`).set(auth('other'))).status, 403);

    const [[orphans]] = await pool.query('SELECT COUNT(*) AS n FROM workout_sets ws LEFT JOIN workout_exercises we ON we.id = ws.workout_exercise_id WHERE we.id IS NULL');
    assert.equal(orphans.n, 0);

    assert.equal((await request(app).delete(`/api/workouts/${workoutId}`).set(auth('athlete'))).status, 204);
  });

  test('sesión sin ejercicios → 400', async () => {
    const res = await request(app).post('/api/workouts').set(auth('athlete')).send({ date: '2026-02-11', title: 'Vacía', exercises: [] });
    assert.equal(res.status, 400);
  });
});

describe('progreso', () => {
  test('resumen semanal y comparación de ejercicios', async () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const to = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const res = await request(app).get(`/api/progress?days=7&to=${to}`).set(auth('athlete'));
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.data.daily.length, 7);
    assert.ok(res.body.data.summary.loggedDays >= 6);
    const bench = res.body.data.exercises.find((e) => e.name.startsWith('Press de banca'));
    // La rutina pendiente del coach no cuenta como una sesión realizada.
    assert.equal(bench.sessions, 2);
    assert.equal(bench.delta.bestWeight, 2.5);
  });

  test('coach ve el progreso de su atleta; athlete no ve el de otro', async () => {
    assert.equal((await request(app).get('/api/progress?userId=3').set(auth('coach'))).status, 200);
    assert.equal((await request(app).get('/api/progress?userId=3').set(auth('other'))).status, 403);
  });
});

describe('índices', () => {
  test('las consultas principales usan los índices definidos', async () => {
    const explain = async (sql, params) => {
      const [rows] = await pool.query(`EXPLAIN ${sql}`, params);
      return rows[0].key;
    };
    assert.equal(
      await explain('SELECT * FROM diary_entries WHERE user_id = ? AND entry_date = ?', [3, '2026-02-10']),
      'idx_diary_user_date',
    );
    assert.equal(
      await explain('SELECT * FROM workouts WHERE user_id = ? AND workout_date BETWEEN ? AND ?', [3, '2026-01-01', '2026-03-01']),
      'idx_workouts_user_date',
    );
    assert.equal(
      await explain("SELECT * FROM foods WHERE MATCH(name, brand) AGAINST ('+pollo*' IN BOOLEAN MODE)", []),
      'ft_foods_search',
    );
    assert.equal(await explain('SELECT id FROM users WHERE email = ?', ['atleta@macroentreno.com']), 'uq_users_email');
  });
});

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const jsonResponse = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

describe('MacroEntreno Pro: micronutrientes', () => {
  test('el atleta con Pro recibe los micronutrientes del día; el plan gratis no', async () => {
    const pro = await request(app).get(`/api/diary?date=${localToday()}`).set(auth('athlete'));
    assert.equal(pro.status, 200);
    const fiber = pro.body.data.micros.find((m) => m.key === 'fiber');
    // avena 60 g (10,6 g/100 g) + pollo 200 g (0) + arroz 150 g (1,8 g/100 g) = 6,36 + 0 + 2,7
    assert.equal(fiber.value, 9.1);
    assert.equal(fiber.percent, 33); // 9,1 g de 28 g
    assert.equal(fiber.known, 3);
    const vitD = pro.body.data.micros.find((m) => m.key === 'vitaminD');
    assert.equal(vitD.value, null, 'lo desconocido no suma cero');
    assert.ok(pro.body.data.entries[0].micros);

    const free = await request(app).get(`/api/diary?date=${localToday()}`).set(auth('other'));
    assert.equal(free.body.data.micros, null);
    assert.equal((await request(app).get('/api/auth/me').set(auth('other'))).body.data.plan.pro, false);
  });

  test('el coach ve los micronutrientes de su atleta (Pro incluido por el rol)', async () => {
    const res = await request(app).get(`/api/diary?date=${localToday()}&userId=3`).set(auth('coach'));
    assert.ok(Array.isArray(res.body.data.micros));
    const me = await request(app).get('/api/auth/me').set(auth('coach'));
    assert.deepEqual(me.body.data.plan, { pro: true, source: 'role', proUntil: null });
  });

  test('progreso: promedio diario de micronutrientes solo con Pro', async () => {
    const pro = await request(app).get(`/api/progress?days=7&to=${localToday()}`).set(auth('athlete'));
    assert.equal(pro.body.data.micros.days, 7);
    assert.ok(pro.body.data.micros.nutrients.find((m) => m.key === 'sodium').value > 0);
    const free = await request(app).get('/api/progress?days=7').set(auth('other'));
    assert.equal(free.body.data.micros, null);
  });
});

describe('MacroEntreno Pro: FatSecret', () => {
  let fatsecret;
  const calls = [];
  // Porción de 50 g: la API tiene que pasar todo a 100 g.
  const serving = { serving_id: '1', serving_description: '1 unidad', metric_serving_amount: '50.000', metric_serving_unit: 'g', calories: '44.5', protein: '0.55', carbohydrate: '11.4', fat: '0.15', fiber: '1.3', sugar: '6.1', sodium: '0.5', potassium: '179', vitamin_c: '4.35', calcium: '2.5', iron: '0.13' };
  const banana = { food_id: '5388', food_name: 'Banana', food_type: 'Generic', servings: { serving } };

  before(async () => {
    fatsecret = await import('../src/modules/foods/fatsecret.js');
    fatsecret.setFatSecretFetch(async (url) => {
      const params = new URL(url).searchParams;
      calls.push(params);
      if (params.get('method') === 'foods.search.v5') return jsonResponse({ foods_search: { total_results: '1', page_number: '0', results: { food: banana } } });
      if (params.get('method') === 'food.get.v5') return jsonResponse({ food: banana });
      return jsonResponse({ error: { code: 2, message: 'método desconocido' } });
    });
  });
  after(() => fatsecret.setFatSecretFetch());

  test('sin Pro → 402 PRO_REQUIRED', async () => {
    const res = await request(app).get('/api/foods/fatsecret/search?search=banana').set(auth('other'));
    assert.equal(res.status, 402);
    assert.equal(res.body.error.code, 'PRO_REQUIRED');
  });

  test('busca firmando con OAuth 1.0 y normaliza a 100 g', async () => {
    const res = await request(app).get('/api/foods/fatsecret/search?search=banana').set(auth('athlete'));
    assert.equal(res.status, 200, res.text);
    const [food] = res.body.data.foods;
    assert.equal(food.kcal, 89);
    assert.equal(food.micros.potassium, 358);
    assert.equal(food.micros.vitamin_d, null);
    assert.equal(food.microsCount, 7);
    const sent = calls.at(-1);
    assert.equal(sent.get('oauth_consumer_key'), 'test-key');
    assert.equal(sent.get('oauth_signature_method'), 'HMAC-SHA1');
    assert.ok(sent.get('oauth_signature'));
  });

  test('importar crea el alimento (sin duplicar) y el diario escala sus micronutrientes', async () => {
    const first = await request(app).post('/api/foods/fatsecret/import').set(auth('athlete')).send({ externalId: '5388' });
    assert.equal(first.status, 201, first.text);
    assert.equal(first.body.data.micros.fiber, 2.6);
    assert.deepEqual(first.body.data.source, { name: 'fatsecret', id: '5388' });
    const again = await request(app).post('/api/foods/fatsecret/import').set(auth('athlete')).send({ externalId: '5388' });
    assert.equal(again.body.data.id, first.body.data.id);

    const entry = await request(app)
      .post('/api/diary')
      .set(auth('athlete'))
      .send({ date: '2026-03-01', meal: 'merienda', foodId: first.body.data.id, grams: 150 });
    assert.equal(entry.status, 201, entry.text);
    assert.equal(entry.body.data.micros.potassium, 537);
    assert.equal(entry.body.data.micros.vitaminD, null);

    // Un atleta sin Pro puede registrar ese alimento, pero no recibe sus micronutrientes.
    const free = await request(app).get(`/api/foods/${first.body.data.id}`).set(auth('other'));
    assert.equal(free.body.data.micros, undefined);
  });
});

describe('MacroEntreno Pro: suscripción con Mercado Pago', () => {
  let mp;
  let preapproval;
  const sent = [];
  const sign = (dataId, requestId, ts = String(Math.floor(Date.now() / 1000))) => {
    const v1 = crypto.createHmac('sha256', 'secreto-webhook').update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest('hex');
    return `ts=${ts},v1=${v1}`;
  };

  before(async () => {
    mp = await import('../src/modules/billing/mercadopago.js');
    mp.setMercadoPagoFetch(async (url, options) => {
      const body = options.body ? JSON.parse(options.body) : null;
      sent.push({ url, method: options.method, body, headers: options.headers });
      if (options.method === 'POST' && url.endsWith('/preapproval')) {
        preapproval = { id: 'pre-123', status: 'pending', external_reference: body.external_reference, init_point: 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=pre-123' };
        return jsonResponse(preapproval, 201);
      }
      if (url.endsWith('/preapproval/pre-123') && options.method === 'GET') return jsonResponse(preapproval);
      if (url.endsWith('/preapproval/pre-123') && options.method === 'PUT') {
        preapproval = { ...preapproval, status: body.status };
        return jsonResponse(preapproval);
      }
      return jsonResponse({ message: 'not found' }, 404);
    });
  });
  after(() => mp.setMercadoPagoFetch());

  test('el plan informa precio y que se puede pagar', async () => {
    const res = await request(app).get('/api/billing/plan').set(auth('other'));
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.price, { amount: 4999, currency: 'ARS', period: 'month' });
    assert.equal(res.body.data.checkoutAvailable, true);
  });

  test('suscribirse crea el preapproval pendiente y devuelve el link de pago', async () => {
    const res = await request(app).post('/api/billing/subscribe').set(auth('other'));
    assert.equal(res.status, 201, res.text);
    assert.match(res.body.data.checkoutUrl, /preapproval_id=pre-123/);
    const call = sent.at(-1);
    assert.equal(call.headers.Authorization, 'Bearer TEST-token');
    assert.ok(call.headers['X-Idempotency-Key']);
    assert.deepEqual(call.body.auto_recurring, { frequency: 1, frequency_type: 'months', transaction_amount: 4999, currency_id: 'ARS' });
    assert.equal(call.body.payer_email, 'martina@macroentreno.com');
    assert.equal(call.body.back_url, 'https://app.macroentreno.test/pro');
    assert.equal(res.body.data.subscription.status, 'pending');
  });

  test('coach no se suscribe: su rol ya incluye Pro', async () => {
    assert.equal((await request(app).post('/api/billing/subscribe').set(auth('coach'))).status, 400);
  });

  test('webhook con firma inválida → 401; con firma válida activa Pro', async () => {
    const bad = await request(app)
      .post('/api/billing/webhook?type=subscription_preapproval&data.id=pre-123')
      .set('x-signature', 'ts=1,v1=deadbeef')
      .set('x-request-id', 'req-1')
      .send({ type: 'subscription_preapproval', data: { id: 'pre-123' } });
    assert.equal(bad.status, 401);

    const next = new Date(Date.now() + 30 * 86_400_000).toISOString();
    preapproval = { ...preapproval, status: 'authorized', next_payment_date: next };
    const ok = await request(app)
      .post('/api/billing/webhook?type=subscription_preapproval&data.id=pre-123')
      .set('x-signature', sign('pre-123', 'req-2'))
      .set('x-request-id', 'req-2')
      .send({ type: 'subscription_preapproval', data: { id: 'pre-123' } });
    assert.equal(ok.status, 200, ok.text);

    const me = await request(app).get('/api/auth/me').set(auth('other'));
    assert.equal(me.body.data.plan.pro, true);
    assert.equal(me.body.data.plan.source, 'subscription');
    const plan = await request(app).get('/api/billing/plan').set(auth('other'));
    assert.equal(plan.body.data.subscription.status, 'authorized');
    // Con Pro activo ya ve los micronutrientes.
    const diary = await request(app).get(`/api/diary?date=${localToday()}`).set(auth('other'));
    assert.ok(Array.isArray(diary.body.data.micros));
  });

  test('cancelar da de baja en Mercado Pago pero respeta el período pagado', async () => {
    const res = await request(app).post('/api/billing/cancel').set(auth('other'));
    assert.equal(res.status, 200, res.text);
    assert.equal(sent.at(-1).method, 'PUT');
    assert.deepEqual(sent.at(-1).body, { status: 'cancelled' });
    assert.equal(res.body.data.subscription.status, 'cancelled');
    assert.equal(res.body.data.plan.pro, true);
  });

  test('admin regala o quita Pro; los demás no', async () => {
    assert.equal((await request(app).post('/api/billing/grant').set(auth('athlete')).send({ userId: 4, days: 30 })).status, 403);
    const off = await request(app).post('/api/billing/grant').set(auth('admin')).send({ userId: 4, days: 0 });
    assert.equal(off.status, 200);
    assert.equal(off.body.data.plan.pro, false);
    const on = await request(app).post('/api/billing/grant').set(auth('admin')).send({ userId: 4, days: 15 });
    assert.equal(on.body.data.plan.pro, true);
  });

  test('webhook de otra cosa se ignora', async () => {
    const res = await request(app)
      .post('/api/billing/webhook?type=payment&data.id=999')
      .set('x-signature', sign('999', 'req-3'))
      .set('x-request-id', 'req-3')
      .send({ type: 'payment', data: { id: '999' } });
    assert.equal(res.status, 200);
  });
});


describe('seguimiento, planes e informes por rol', () => {
  let coachA, coachB, athleteA, athleteB, plan;
  const headers = {};
  let today, week, food;
  before(async () => {
    const periods = await import('../src/modules/reports/periods.js');
    today = periods.argentinaToday();
    week = periods.mondayOf(today);
    for (const [key, role, name] of [['ca', 'coach', 'Coach A'], ['cb', 'coach', 'Coach B'], ['aa', 'athlete', 'Atleta A'], ['ab', 'athlete', 'Atleta B']]) {
      const res = await request(app).post('/api/users').set(auth('admin')).send({ name, email: `${key}@seguimiento.test`, password: 'Demo1234', role });
      assert.equal(res.status, 201, res.text);
      const session = await login(`${key}@seguimiento.test`);
      headers[key] = { Authorization: `Bearer ${session.body.data.tokens.accessToken}` };
      if (key === 'ca') coachA = res.body.data.id;
      if (key === 'cb') coachB = res.body.data.id;
      if (key === 'aa') athleteA = res.body.data.id;
      if (key === 'ab') athleteB = res.body.data.id;
    }
    await request(app).put(`/api/users/${athleteA}`).set(auth('admin')).send({ coachId: coachA });
    await request(app).put(`/api/users/${athleteB}`).set(auth('admin')).send({ coachId: coachB });
    const list = await request(app).get('/api/foods?scope=global&limit=1').set(headers.ca);
    food = list.body.data[0];
  });
  test('panel limitado a los clientes del coach y validación de fechas reales', async () => {
    const dash = await request(app).get(`/api/coaching/dashboard?date=${today}`).set(headers.ca);
    assert.equal(dash.status, 200, dash.text);
    assert.deepEqual(dash.body.data.clients.map((c) => c.id), [athleteA]);
    assert.equal((await request(app).get('/api/coaching/dashboard').set(headers.aa)).status, 403);
    assert.equal((await request(app).get('/api/coaching/dashboard?date=2026-02-31').set(headers.ca)).status, 400);
  });
  test('crear planes verifica rol, asignación, alimentos privados y cantidades', async () => {
    const body = { athleteId: athleteA, title: 'Plan semanal A', notes: 'Indicaciones de prueba', startDate: today, endDate: today,
      items: [{ foodId: food.id, grams: food.portionGrams * 2, meal: 'almuerzo', dayOfWeek: 0 }] };
    assert.equal((await request(app).post('/api/coaching/plans').set(headers.aa).send(body)).status, 403);
    assert.equal((await request(app).post('/api/coaching/plans').set(headers.cb).send(body)).status, 403);
    assert.equal((await request(app).post('/api/coaching/plans').set(headers.ca).send({ ...body, items: [{ ...body.items[0], grams: -1 }] })).status, 400);
    const privateFood = await request(app).post('/api/foods').set(headers.ab).send({ name: 'Comida privada B', category: 'Personal', portionGrams: 100, kcal: 150, protein: 10, carbs: 20, fat: 2 });
    assert.equal(privateFood.status, 201, privateFood.text);
    assert.equal((await request(app).post('/api/coaching/plans').set(headers.ca).send({ ...body, items: [{ ...body.items[0], foodId: privateFood.body.data.id }] })).status, 400);
    const created = await request(app).post('/api/coaching/plans').set(headers.ca).send(body);
    assert.equal(created.status, 201, created.text);
    plan = created.body.data;
    assert.equal(plan.items[0].kcal, Math.round(food.kcal * 20) / 10);
    assert.equal((await request(app).get(`/api/coaching/plans/${plan.id}`).set(headers.cb)).status, 403);
    assert.equal((await request(app).get(`/api/coaching/plans/${plan.id}/pdf`).set(headers.ab)).status, 403);
  });
  test('copiar plan es atómico, conserva nutrientes y no duplica con dos clics', async () => {
    const results = await Promise.all([1, 2].map(() => request(app).post(`/api/coaching/plans/${plan.id}/apply`).set(headers.aa).send({ date: today })));
    for (const r of results) assert.equal(r.status, 200, r.text);
    assert.equal(results.reduce((n, r) => n + r.body.data.added, 0), 1);
    const day = await request(app).get(`/api/diary?date=${today}`).set(headers.aa);
    assert.equal(day.body.data.entries.length, 1);
    assert.equal(day.body.data.totals.kcal, plan.items[0].kcal);
    assert.equal((await request(app).post(`/api/coaching/plans/${plan.id}/apply`).set(headers.ab).send({ date: today })).status, 403);
    const pdf = await request(app).get(`/api/coaching/plans/${plan.id}/pdf?format=base64`).set(headers.aa);
    assert.equal(pdf.status, 200, pdf.text);
    assert.equal(Buffer.from(pdf.body.data.base64, 'base64').subarray(0, 5).toString(), '%PDF-');
    await request(app).post(`/api/coaching/plans/${plan.id}/archive`).set(headers.ca);
    assert.equal((await request(app).post(`/api/coaching/plans/${plan.id}/apply`).set(headers.aa).send({ date: today })).status, 400);
  });
  test('rutinas asignadas no aumentan rendimiento hasta confirmación del atleta', async () => {
    const workout = { userId: athleteA, date: today, title: 'Rutina asignada', exercises: [{ name: 'Sentadilla libre', sets: [{ reps: 10, weight: 20 }] }] };
    const assigned = await request(app).post('/api/workouts').set(headers.ca).send(workout);
    assert.equal(assigned.status, 201, assigned.text);
    assert.equal(assigned.body.data.status, 'planned');
    let report = await request(app).get(`/api/reports/weekly/preview?week=${week}`).set(headers.aa);
    assert.equal(report.status, 200, report.text);
    assert.equal(report.body.data.summary.sessions, 0);
    assert.equal(report.body.data.summary.planned, 1);
    const completed = { ...workout, status: 'completed' };
    assert.equal((await request(app).put(`/api/workouts/${assigned.body.data.id}`).set(headers.ca).send(completed)).status, 400);
    assert.equal((await request(app).put(`/api/workouts/${assigned.body.data.id}`).set(headers.aa).send(completed)).status, 200);
    report = await request(app).get(`/api/reports/weekly/preview?week=${week}`).set(headers.aa);
    assert.equal(report.body.data.summary.sessions, 1);
    assert.equal(report.body.data.summary.volume, 200);
    const { addDays } = await import('../src/utils/dates.js');
    assert.equal((await request(app).put(`/api/workouts/${assigned.body.data.id}`).set(headers.ca).send({ ...workout, date: addDays(today, 1) })).status, 400);
  });
  test('PDF semanal cerrado es persistente e idempotente y exige acceso al atleta', async () => {
    const { addDays } = await import('../src/utils/dates.js');
    const lastWeek = addDays(week, -7);
    assert.equal((await request(app).post('/api/reports/weekly/generate').set(headers.aa).send({ week })).status, 400);
    assert.equal((await request(app).get(`/api/reports/weekly/preview?userId=${athleteA}`).set(headers.cb)).status, 403);
    const first = await request(app).post('/api/reports/weekly/generate').set(headers.aa).send({ week: lastWeek });
    assert.equal(first.status, 200, first.text);
    const second = await request(app).post('/api/reports/weekly/generate').set(headers.ca).send({ week: lastWeek, userId: athleteA });
    assert.equal(first.body.data.id, second.body.data.id);
    const id = first.body.data.id;
    assert.equal((await request(app).get(`/api/reports/weekly/${id}/pdf`).set(headers.ab)).status, 403);
    const pdf = await request(app).get(`/api/reports/weekly/${id}/pdf`).set(headers.aa);
    assert.equal(pdf.status, 200);
    assert.match(pdf.headers['content-type'], /application\/pdf/);
    const [stored] = (await pool.query('SELECT LENGTH(pdf) AS bytes FROM weekly_reports WHERE id = ?', [id]))[0];
    assert.ok(stored.bytes > 1000);
    const { generateDueWeeklyReports } = await import('../src/modules/reports/reports.service.js');
    await generateDueWeeklyReports();
    await generateDueWeeklyReports();
    const [[automatic]] = await pool.query('SELECT COUNT(*) AS total FROM weekly_reports WHERE athlete_id = 3 AND week_start = ?', [lastWeek]);
    assert.equal(automatic.total, 1, 'El proceso automático generó la semana cerrada del atleta demo');
    const [counts] = (await pool.query('SELECT COUNT(*) AS total FROM weekly_reports WHERE athlete_id = ? AND week_start = ?', [athleteA, lastWeek]))[0];
    assert.equal(counts.total, 1);
  });
  test('mensual cuenta altas únicas y actividad y solo lo descarga admin', async () => {
    const month = today.slice(0, 7);
    let report = await request(app).get(`/api/reports/coaches/monthly?month=${month}`).set(auth('admin'));
    assert.equal(report.status, 200, report.text);
    let a = report.body.data.coaches.find((c) => c.id === coachA);
    assert.equal(a.newClients, 1);
    assert.equal(a.clientsServed, 1);
    assert.equal(a.workouts, 1);
    assert.equal(a.meals, 1);
    assert.equal(a.plans, 1);
    assert.equal(a.routines, 1);
    await request(app).put(`/api/users/${athleteA}`).set(auth('admin')).send({ coachId: coachB });
    assert.equal((await request(app).get(`/api/coaching/plans/${plan.id}`).set(headers.ca)).status, 403);
    assert.equal((await request(app).get(`/api/coaching/plans/${plan.id}`).set(headers.cb)).status, 200);
    await request(app).put(`/api/users/${athleteA}`).set(auth('admin')).send({ coachId: coachA });
    report = await request(app).get(`/api/reports/coaches/monthly?month=${month}`).set(auth('admin'));
    a = report.body.data.coaches.find((c) => c.id === coachA);
    assert.equal(a.newClients, 1, 'No cuenta dos veces un cliente reasignado');
    assert.equal((await request(app).get('/api/reports/coaches/monthly').set(headers.ca)).status, 403);
    const pdf = await request(app).get(`/api/reports/coaches/monthly/pdf?month=${month}&coachId=${coachA}&format=base64`).set(auth('admin'));
    assert.equal(pdf.status, 200, pdf.text);
    assert.equal(Buffer.from(pdf.body.data.base64, 'base64').subarray(0, 5).toString(), '%PDF-');
    assert.equal((await request(app).get('/api/reports/coaches/monthly?month=2026-13').set(auth('admin'))).status, 400);
  });
  test('cambiar el rol del entrenador libera clientes y cierra sus asignaciones', async () => {
    const updated = await request(app).put(`/api/users/${coachA}`).set(auth('admin')).send({ role: 'athlete' });
    assert.equal(updated.status, 200, updated.text);
    const athlete = await request(app).get(`/api/users/${athleteA}`).set(auth('admin'));
    assert.equal(athlete.body.data.coachId, null);
    const [[row]] = await pool.query('SELECT COUNT(*) AS total FROM coach_assignments WHERE coach_id = ? AND ended_at IS NULL', [coachA]);
    assert.equal(row.total, 0);
  });
});

describe('alimentos: código de barras y bases gratuitas', () => {
  let off;
  let usda;
  const offCalls = [];
  const polenta = {
    code: '7790580660000',
    product_name: 'Polenta Instantánea',
    brands: 'Arcor, Prestopronta',
    quantity: '500 g',
    serving_quantity: 50,
    nutriments: { 'energy-kcal_100g': 340, proteins_100g: 7, carbohydrates_100g: 78, fat_100g: 0.8, fiber_100g: 2.2, sodium_100g: 0.012 },
  };

  before(async () => {
    off = await import('../src/modules/foods/openfoodfacts.js');
    usda = await import('../src/modules/foods/usda.js');
    off.setOpenFoodFactsFetch(async (url, init) => {
      offCalls.push({ url, userAgent: init.headers['User-Agent'] });
      if (url.includes('/product/7790580660000')) return jsonResponse({ status: 1, product: polenta });
      if (url.includes('/product/')) return jsonResponse({ status: 0, status_verbose: 'product not found' });
      return jsonResponse({ hits: [polenta] });
    });
    usda.setUsdaFetch(async () =>
      jsonResponse({
        foods: [
          {
            fdcId: 173944,
            description: 'Bananas, raw',
            foodNutrients: [
              { nutrientNumber: '208', unitName: 'KCAL', value: 89 },
              { nutrientNumber: '203', unitName: 'G', value: 1.09 },
              { nutrientNumber: '205', unitName: 'G', value: 22.8 },
              { nutrientNumber: '204', unitName: 'G', value: 0.33 },
              { nutrientNumber: '306', unitName: 'MG', value: 358 },
            ],
          },
        ],
      }),
    );
  });
  after(() => {
    off.setOpenFoodFactsFetch();
    usda.setUsdaFetch();
  });

  test('un código desconocido en Open Food Facts → found: false', async () => {
    const res = await request(app).get('/api/foods/barcode/0000000000017').set(auth('other'));
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.data.found, false);
  });

  test('código inválido → 400', async () => {
    const res = await request(app).get('/api/foods/barcode/abc').set(auth('other'));
    assert.equal(res.status, 400);
  });

  test('escanear trae el producto de Open Food Facts, lo guarda y el segundo escaneo no sale de la app', async () => {
    const first = await request(app).get('/api/foods/barcode/7790580660000').set(auth('other'));
    assert.equal(first.status, 200, first.text);
    assert.equal(first.body.data.source, 'openfoodfacts');
    assert.equal(first.body.data.food.name, 'Polenta Instantánea');
    assert.equal(first.body.data.food.brand, 'Arcor');
    assert.equal(first.body.data.food.barcode, '7790580660000');
    assert.equal(first.body.data.food.kcal, 340);
    assert.match(offCalls.at(-1).userAgent, /MacroEntreno/);

    const before = offCalls.length;
    const again = await request(app).get('/api/foods/barcode/7790580660000').set(auth('athlete'));
    assert.equal(again.body.data.source, 'catalog');
    assert.equal(again.body.data.food.id, first.body.data.food.id);
    // Con Pro se ven los micronutrientes convertidos a mg.
    assert.equal(again.body.data.food.micros.sodium, 12);
    assert.equal(offCalls.length, before);
  });

  test('un alimento propio con código de barras se encuentra al escanear', async () => {
    const created = await request(app)
      .post('/api/foods')
      .set(auth('other'))
      .send({ name: 'Granola casera', portionGrams: 40, kcal: 180, protein: 5, carbs: 24, fat: 7, barcode: '1234567890128' });
    assert.equal(created.status, 201, created.text);
    const res = await request(app).get('/api/foods/barcode/1234567890128').set(auth('other'));
    assert.equal(res.body.data.food.id, created.body.data.id);
    // Otro usuario no ve el alimento privado.
    const other = await request(app).get('/api/foods/barcode/1234567890128').set(auth('athlete'));
    assert.equal(other.body.data.found, false);
  });

  test('busca en USDA e importa sin duplicar', async () => {
    const res = await request(app).get('/api/foods/external/search?source=usda&search=banana').set(auth('other'));
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.data[0].name, 'Bananas, raw');
    assert.equal(res.body.data[0].micros.potassium, 358);

    usda.setUsdaFetch(async () => jsonResponse({ fdcId: 173944, description: 'Bananas, raw', foodNutrients: [{ nutrient: { number: '208', unitName: 'kcal' }, amount: 89 }, { nutrient: { number: '203', unitName: 'g' }, amount: 1.09 }] }));
    const first = await request(app).post('/api/foods/external/import').set(auth('other')).send({ source: 'usda', externalId: '173944' });
    assert.equal(first.status, 201, first.text);
    assert.equal(first.body.data.category, 'USDA');
    const again = await request(app).post('/api/foods/external/import').set(auth('other')).send({ source: 'usda', externalId: '173944' });
    assert.equal(again.body.data.id, first.body.data.id);
  });
});

describe('asistente con IA', () => {
  let openai;
  const requests = [];

  before(async () => {
    openai = await import('../src/modules/ai/openai.js');
  });
  after(() => openai.setOpenAiFetch());

  test('sin sesión → 401', async () => {
    const res = await request(app).post('/api/ai/chat').send({ messages: [{ role: 'user', text: 'hola' }] });
    assert.equal(res.status, 401);
  });

  test('el chat ejecuta herramientas con los permisos del usuario y devuelve los cambios', async () => {
    let round = 0;
    openai.setOpenAiFetch(async (url, init) => {
      const body = JSON.parse(init.body);
      requests.push({ url, body, authorization: init.headers.Authorization });
      round++;
      if (round === 1) {
        return jsonResponse({
          id: 'resp_1',
          output: [
            {
              type: 'function_call',
              call_id: 'call_1',
              name: 'registrar_comida',
              arguments: JSON.stringify({ comida: 'almuerzo', fecha: '2026-03-10', items: [{ nombre: 'Milanesa con puré', gramos: 350, kcal: 620, proteinas: 38, carbohidratos: 45, grasas: 30 }] }),
            },
            { type: 'function_call', call_id: 'call_2', name: 'crear_ejercicio', arguments: JSON.stringify({ nombre: 'Remo Pendlay', grupo_muscular: 'Espalda' }) },
          ],
        });
      }
      return jsonResponse({ id: 'resp_2', output: [{ type: 'message', content: [{ type: 'output_text', text: 'Listo, anoté tu milanesa con puré.' }] }] });
    });

    const res = await request(app)
      .post('/api/ai/chat')
      .set(auth('other'))
      .send({ messages: [{ role: 'user', text: 'Anotá una milanesa con puré en el almuerzo', image: 'data:image/jpeg;base64,/9j/AAAA' }] });
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.data.reply, 'Listo, anoté tu milanesa con puré.');
    assert.deepEqual(res.body.data.actions.map((a) => a.type), ['diary']);

    // La clave viaja solo del servidor a OpenAI; la imagen se manda como input_image.
    assert.equal(requests[0].authorization, 'Bearer test-openai');
    assert.equal(requests[0].body.input[0].content[1].type, 'input_image');
    // Segunda vuelta: resultados de las herramientas encadenados a la respuesta anterior.
    assert.equal(requests[1].body.previous_response_id, 'resp_1');
    const outputs = requests[1].body.input.map((o) => JSON.parse(o.output));
    assert.equal(outputs[0].ok, true);
    assert.match(outputs[1].error, /Solo entrenadores/); // un atleta no puede tocar el catálogo de ejercicios

    const day = await request(app).get('/api/diary?date=2026-03-10').set(auth('other'));
    assert.ok(day.body.data.entries.some((e) => e.name === 'Milanesa con puré' && Number(e.kcal) === 620));
  });

  test('análisis de foto devuelve los alimentos estimados sin registrar nada', async () => {
    const analysis = { esComida: true, descripcion: 'Bife con ensalada', confianza: 'media', items: [{ nombre: 'Bife de chorizo', gramos: 250, kcal: 550, proteinas: 60, carbohidratos: 0, grasas: 34 }] };
    openai.setOpenAiFetch(async (_url, init) => {
      const body = JSON.parse(init.body);
      assert.equal(body.text.format.type, 'json_schema');
      return jsonResponse({ id: 'resp_3', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(analysis) }] }] });
    });
    const res = await request(app).post('/api/ai/food-photo').set(auth('other')).send({ image: 'data:image/png;base64,iVBORw0KGgo=' });
    assert.equal(res.status, 200, res.text);
    assert.deepEqual(res.body.data, analysis);
  });

  test('imagen que no es data URL → 400', async () => {
    const res = await request(app).post('/api/ai/food-photo').set(auth('other')).send({ image: 'https://ejemplo.com/foto.jpg' });
    assert.equal(res.status, 400);
  });

  test('voz: transcribe el audio y sintetiza la respuesta', async () => {
    openai.setOpenAiFetch(async (url, init) => {
      if (url.endsWith('/audio/transcriptions')) {
        assert.equal(init.body.get('language'), 'es');
        return jsonResponse({ text: ' Agregame una banana a la merienda ' });
      }
      return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
    });
    const text = await request(app).post('/api/ai/transcribe').set(auth('other')).send({ audio: Buffer.from('audio-falso').toString('base64'), mimeType: 'audio/webm;codecs=opus' });
    assert.equal(text.status, 200, text.text);
    assert.equal(text.body.data.text, 'Agregame una banana a la merienda');
    const speech = await request(app).post('/api/ai/speech').set(auth('other')).send({ text: 'Listo' });
    assert.equal(speech.body.data.audio, Buffer.from([1, 2, 3]).toString('base64'));
  });

  test('sin OPENAI_API_KEY → 503 AI_NOT_CONFIGURED', async () => {
    const { env } = await import('../src/config/env.js');
    const key = env.openai.apiKey;
    env.openai.apiKey = '';
    try {
      const res = await request(app).post('/api/ai/chat').set(auth('other')).send({ messages: [{ role: 'user', text: 'hola' }] });
      assert.equal(res.status, 503);
      assert.equal(res.body.error.code, 'AI_NOT_CONFIGURED');
    } finally {
      env.openai.apiKey = key;
    }
  });
});
