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
    assert.equal(bench.sessions, 3);
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
