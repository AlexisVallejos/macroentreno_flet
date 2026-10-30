/**
 * Suite dedicada a inicio de sesión y registro (POST /api/auth/register, /login, /refresh,
 * /logout, PUT /password, GET /me) contra un MySQL real temporal (mysql-memory-server).
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import jwt from 'jsonwebtoken';
import { createDB } from 'mysql-memory-server';
import request from 'supertest';

const DEMO_PASSWORD = 'Demo1234';
const INVALID_CREDENTIALS_MESSAGE = 'Email o contraseña incorrectos';

let db;
let app;
let pool;
let signAccessToken;
let env;
let oauth;
let authService;

const register = (body) => request(app).post('/api/auth/register').send(body);
const login = (email, password = DEMO_PASSWORD) => request(app).post('/api/auth/login').send({ email, password });
const me = (accessToken) => request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`);
const refresh = (refreshToken) => request(app).post('/api/auth/refresh').send({ refreshToken });
const fieldsOf = (res) => res.body.error.details.map((d) => d.field).sort();

/** Email único por test para que los casos no dependan entre sí. */
let counter = 0;
const uniqueEmail = (prefix = 'usuario') => `${prefix}.${Date.now()}.${++counter}@test.com`;

/** Registra un usuario válido y devuelve { email, password, body }. */
async function registerUser(overrides = {}) {
  const data = { name: 'Usuario Prueba', email: uniqueEmail(), password: 'Clave1234', ...overrides };
  const res = await register(data);
  assert.equal(res.status, 201, res.text);
  return { ...data, body: res.body.data };
}

function assertValidationError(res, expectedFields) {
  assert.equal(res.status, 400, res.text);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  assert.ok(Array.isArray(res.body.error.details));
  assert.deepEqual(fieldsOf(res), [...expectedFields].sort());
  for (const detail of res.body.error.details) assert.equal(typeof detail.message, 'string');
}

before(async () => {
  db = await createDB({ version: '8.4.x' });
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DB_HOST: '127.0.0.1',
    DB_PORT: String(db.port),
    DB_USER: db.username,
    DB_PASSWORD: '',
    DB_NAME: 'macroentreno_auth_test',
  });
  const { initDatabase } = await import('../scripts/db-init.js');
  ({ env } = await import('../src/config/env.js'));
  await initDatabase({ config: env.db });
  ({ pool } = await import('../src/config/db.js'));
  ({ signAccessToken } = await import('../src/modules/auth/tokens.js'));
  oauth = await import('../src/modules/auth/oauth.js');
  authService = await import('../src/modules/auth/auth.service.js');
  app = (await import('../src/app.js')).createApp();
});

after(async () => {
  await pool?.end();
  await db?.stop();
});

describe('registro: alta exitosa', () => {
  test('registro válido → 201 con rol athlete y tokens', async () => {
    const email = uniqueEmail('alta');
    const res = await register({ name: 'Ana Pérez', email, password: 'Clave1234' });
    assert.equal(res.status, 201, res.text);
    const { user, tokens } = res.body.data;
    assert.equal(user.role, 'athlete');
    assert.equal(user.name, 'Ana Pérez');
    assert.equal(user.email, email);
    assert.equal(user.isActive, true);
    assert.equal(user.hasPassword, true);
    assert.equal(user.coachId, null);
    assert.equal(typeof user.id, 'number');
    assert.equal(tokens.tokenType, 'Bearer');
    assert.equal(typeof tokens.accessToken, 'string');
    assert.equal(typeof tokens.refreshToken, 'string');
    assert.ok(tokens.expiresIn);
  });

  test('registro normaliza el email (minúsculas y sin espacios) y recorta el nombre', async () => {
    const local = `Mixto.${Date.now()}`;
    const res = await register({ name: '   Juan Gómez   ', email: `  ${local}@Ejemplo.COM  `, password: 'Clave1234' });
    assert.equal(res.status, 201, res.text);
    assert.equal(res.body.data.user.email, `${local.toLowerCase()}@ejemplo.com`);
    assert.equal(res.body.data.user.name, 'Juan Gómez');

    const [row] = (await pool.query('SELECT email, name FROM users WHERE id = ?', [res.body.data.user.id]))[0];
    assert.equal(row.email, `${local.toLowerCase()}@ejemplo.com`);
    assert.equal(row.name, 'Juan Gómez');
  });

  test('registro no expone la contraseña ni su hash', async () => {
    const res = await register({ name: 'Sin Hash', email: uniqueEmail('hash'), password: 'Secreta123' });
    assert.equal(res.status, 201, res.text);
    const text = JSON.stringify(res.body);
    assert.equal(res.body.data.user.passwordHash, undefined);
    assert.equal(res.body.data.user.password_hash, undefined);
    assert.equal(res.body.data.user.password, undefined);
    assert.ok(!text.includes('Secreta123'), 'la respuesta contiene la contraseña');
    assert.ok(!/\$2[aby]\$/.test(text), 'la respuesta contiene un hash bcrypt');
  });

  test('registro guarda la contraseña hasheada con bcrypt, nunca en texto plano', async () => {
    const { body } = await registerUser({ password: 'Plana1234' });
    const [[row]] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [body.user.id]);
    assert.notEqual(row.password_hash, 'Plana1234');
    assert.match(row.password_hash, /^\$2[aby]\$10\$/);
  });

  test('el rol enviado en el cuerpo se ignora: siempre crea un athlete', async () => {
    const res = await register({ name: 'Quiere Admin', email: uniqueEmail('rol'), password: 'Clave1234', role: 'admin' });
    assert.equal(res.status, 201, res.text);
    assert.equal(res.body.data.user.role, 'athlete');
  });

  test('el access token del registro sirve en GET /api/auth/me', async () => {
    const { email, body } = await registerUser({ name: 'Con Sesión' });
    const res = await me(body.tokens.accessToken);
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.data.id, body.user.id);
    assert.equal(res.body.data.email, email);
    assert.equal(res.body.data.role, 'athlete');
    assert.equal(res.body.data.passwordHash, undefined);
  });

  test('contraseña de exactamente 8 y de 72 caracteres es aceptada', async () => {
    await registerUser({ password: 'Abcdef12' });
    await registerUser({ password: `${'a'.repeat(71)}1` });
  });

  test('nombre de exactamente 2 caracteres es aceptado', async () => {
    const { body } = await registerUser({ name: 'Al' });
    assert.equal(body.user.name, 'Al');
  });
});

describe('registro: validaciones por campo', () => {
  const valid = () => ({ name: 'Nombre Válido', email: uniqueEmail('val'), password: 'Clave1234' });

  test('nombre de menos de 2 caracteres → 400 VALIDATION_ERROR (name)', async () => {
    assertValidationError(await register({ ...valid(), name: 'A' }), ['name']);
  });

  test('nombre que solo tiene 1 carácter después de recortar espacios → 400 (name)', async () => {
    assertValidationError(await register({ ...valid(), name: '   A   ' }), ['name']);
  });

  test('nombre de más de 100 caracteres → 400 (name)', async () => {
    assertValidationError(await register({ ...valid(), name: 'x'.repeat(101) }), ['name']);
  });

  test('email inválido → 400 VALIDATION_ERROR (email)', async () => {
    for (const email of ['no-es-email', 'sin@dominio', '@ejemplo.com', 'dos@@ejemplo.com', '']) {
      const res = await register({ ...valid(), email });
      assertValidationError(res, ['email']);
      assert.equal(res.body.error.details[0].message, 'Email inválido');
    }
  });

  test('contraseña de menos de 8 caracteres → 400 (password)', async () => {
    const res = await register({ ...valid(), password: 'Abc1234' });
    assertValidationError(res, ['password']);
    assert.match(res.body.error.details[0].message, /al menos 8 caracteres/);
  });

  test('contraseña de más de 72 caracteres → 400 (password)', async () => {
    const res = await register({ ...valid(), password: `${'a'.repeat(72)}1` });
    assertValidationError(res, ['password']);
    assert.match(res.body.error.details[0].message, /72 caracteres/);
  });

  test('contraseña sin letras → 400 (password)', async () => {
    const res = await register({ ...valid(), password: '12345678' });
    assertValidationError(res, ['password']);
    assert.match(res.body.error.details[0].message, /al menos una letra/);
  });

  test('contraseña sin números → 400 (password)', async () => {
    const res = await register({ ...valid(), password: 'SoloLetras' });
    assertValidationError(res, ['password']);
    assert.match(res.body.error.details[0].message, /al menos un número/);
  });

  test('contraseña corta y sin números informa ambos problemas', async () => {
    assertValidationError(await register({ ...valid(), password: 'abc' }), ['password', 'password']);
  });

  test('cuerpo vacío → 400 con los tres campos', async () => {
    assertValidationError(await register({}), ['email', 'name', 'password']);
  });

  test('sin cuerpo → 400 con los tres campos', async () => {
    assertValidationError(await request(app).post('/api/auth/register'), ['email', 'name', 'password']);
  });

  test('tipos incorrectos (números en vez de texto) → 400', async () => {
    assertValidationError(await register({ name: 123, email: 456, password: 12345678 }), ['email', 'name', 'password']);
  });

  test('un registro rechazado no crea el usuario', async () => {
    const email = uniqueEmail('rechazado');
    assert.equal((await register({ name: 'X', email, password: 'Clave1234' })).status, 400);
    const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    assert.equal(rows.length, 0);
  });
});

describe('registro: email duplicado', () => {
  test('email ya registrado → 409 CONFLICT', async () => {
    const { email } = await registerUser();
    const res = await register({ name: 'Otra Persona', email, password: 'Clave1234' });
    assert.equal(res.status, 409, res.text);
    assert.equal(res.body.error.code, 'CONFLICT');
    assert.equal(res.body.error.message, 'Ya existe una cuenta con ese email');
  });

  test('mismo email con otras mayúsculas y espacios → 409', async () => {
    const { email } = await registerUser();
    const res = await register({ name: 'Otra Persona', email: `  ${email.toUpperCase()} `, password: 'Clave1234' });
    assert.equal(res.status, 409, res.text);
    assert.equal(res.body.error.code, 'CONFLICT');
  });

  test('email de un usuario demo → 409', async () => {
    const res = await register({ name: 'Impostor', email: 'Admin@MacroEntreno.com', password: 'Clave1234' });
    assert.equal(res.status, 409, res.text);
  });
});

describe('login: credenciales correctas', () => {
  for (const [role, email] of [
    ['admin', 'admin@macroentreno.com'],
    ['coach', 'coach@macroentreno.com'],
    ['athlete', 'atleta@macroentreno.com'],
  ]) {
    test(`login demo ${role} (${email}) → 200 con rol ${role}`, async () => {
      const res = await login(email);
      assert.equal(res.status, 200, res.text);
      const { user, tokens } = res.body.data;
      assert.equal(user.role, role);
      assert.equal(user.email, email);
      assert.equal(user.isActive, true);
      assert.equal(user.passwordHash, undefined);
      assert.equal(tokens.tokenType, 'Bearer');
      assert.ok(tokens.accessToken);
      assert.ok(tokens.refreshToken);

      const profile = await me(tokens.accessToken);
      assert.equal(profile.status, 200);
      assert.equal(profile.body.data.role, role);
    });
  }

  test('login acepta email en mayúsculas', async () => {
    const res = await login('ATLETA@MACROENTRENO.COM');
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.data.user.email, 'atleta@macroentreno.com');
  });

  test('login acepta email con espacios alrededor', async () => {
    const res = await login('   Atleta@MacroEntreno.com  ');
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.data.user.role, 'athlete');
  });

  test('cada login entrega un refresh token distinto', async () => {
    const a = await login('coach@macroentreno.com');
    const b = await login('coach@macroentreno.com');
    assert.notEqual(a.body.data.tokens.refreshToken, b.body.data.tokens.refreshToken);
  });
});

describe('login: credenciales incorrectas', () => {
  test('contraseña incorrecta → 401 INVALID_CREDENTIALS', async () => {
    const res = await login('atleta@macroentreno.com', 'Incorrecta1');
    assert.equal(res.status, 401, res.text);
    assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
    assert.equal(res.body.error.message, INVALID_CREDENTIALS_MESSAGE);
    assert.equal(res.body.data, undefined);
  });

  test('email inexistente → 401 INVALID_CREDENTIALS', async () => {
    const res = await login('nadie@macroentreno.com');
    assert.equal(res.status, 401, res.text);
    assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
  });

  test('email inexistente y contraseña incorrecta dan la misma respuesta (no revela cuentas)', async () => {
    const wrongPassword = await login('admin@macroentreno.com', 'Incorrecta1');
    const unknownEmail = await login('no-existe@macroentreno.com', 'Incorrecta1');
    assert.equal(wrongPassword.status, unknownEmail.status);
    assert.deepEqual(wrongPassword.body, unknownEmail.body);
  });

  test('la contraseña distingue mayúsculas y minúsculas', async () => {
    const res = await login('atleta@macroentreno.com', 'demo1234');
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
  });

  test('contraseña vacía → 400 VALIDATION_ERROR (password)', async () => {
    const res = await login('atleta@macroentreno.com', '');
    assertValidationError(res, ['password']);
    assert.equal(res.body.error.details[0].message, 'Ingresá la contraseña');
  });

  test('email con formato inválido → 400 VALIDATION_ERROR (email)', async () => {
    assertValidationError(await login('atleta-sin-arroba', DEMO_PASSWORD), ['email']);
  });

  test('cuerpo vacío → 400 con email y password', async () => {
    assertValidationError(await request(app).post('/api/auth/login').send({}), ['email', 'password']);
  });

  test('cuenta creada solo con red social (sin contraseña) → 401 SOCIAL_ACCOUNT', async () => {
    const email = uniqueEmail('social');
    await pool.query('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, NULL, ?)', [
      'Solo Social',
      email,
      'athlete',
    ]);
    const res = await login(email, 'Cualquiera1');
    assert.equal(res.status, 401, res.text);
    assert.equal(res.body.error.code, 'SOCIAL_ACCOUNT');
    assert.match(res.body.error.message, /red social/);
  });

  test('cuenta social puede definir contraseña sin la actual y luego entrar con email', async () => {
    const email = uniqueEmail('social-pass');
    const [result] = await pool.query('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, NULL, ?)', [
      'Social Con Clave',
      email,
      'athlete',
    ]);
    const accessToken = signAccessToken({ id: result.insertId, role: 'athlete' });
    const set = await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ newPassword: 'NuevaClave1' });
    assert.equal(set.status, 200, set.text);

    const res = await login(email, 'NuevaClave1');
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.data.user.hasPassword, true);
  });

  test('cuenta desactivada con contraseña correcta → 403 FORBIDDEN', async () => {
    const { email, password, body } = await registerUser({ name: 'Dado De Baja' });
    await pool.query('UPDATE users SET is_active = 0 WHERE id = ?', [body.user.id]);
    const res = await login(email, password);
    assert.equal(res.status, 403, res.text);
    assert.equal(res.body.error.code, 'FORBIDDEN');
    assert.equal(res.body.error.message, 'Tu cuenta está desactivada');
    assert.equal(res.body.data, undefined);
  });

  test('cuenta desactivada: su token de acceso y su refresh token dejan de servir', async () => {
    const { body } = await registerUser({ name: 'Baja Con Sesión' });
    await pool.query('UPDATE users SET is_active = 0 WHERE id = ?', [body.user.id]);
    assert.equal((await me(body.tokens.accessToken)).status, 403);
    assert.equal((await refresh(body.tokens.refreshToken)).status, 403);
  });
});

describe('flujo completo: registro, login, refresh, logout y cambio de contraseña', () => {
  test('un usuario recién registrado puede iniciar sesión con las mismas credenciales', async () => {
    const { email, password, body } = await registerUser({ name: 'Recién Llegado', password: 'Primera123' });
    const res = await login(email, password);
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.data.user.id, body.user.id);
    assert.equal(res.body.data.user.role, 'athlete');
    assert.equal((await me(res.body.data.tokens.accessToken)).status, 200);
  });

  test('el registrado puede entrar escribiendo el email con otras mayúsculas', async () => {
    const { email, password } = await registerUser();
    const res = await login(email.toUpperCase(), password);
    assert.equal(res.status, 200, res.text);
  });

  test('refresh tras el registro rota el token y logout lo revoca', async () => {
    const { body } = await registerUser({ name: 'Renueva Sesión' });
    const original = body.tokens.refreshToken;

    const rotated = await refresh(original);
    assert.equal(rotated.status, 200, rotated.text);
    assert.equal(rotated.body.data.user.id, body.user.id);
    const next = rotated.body.data.tokens;
    assert.notEqual(next.refreshToken, original);
    assert.equal((await me(next.accessToken)).status, 200);

    const out = await request(app).post('/api/auth/logout').send({ refreshToken: next.refreshToken });
    assert.equal(out.status, 204);
    const afterLogout = await refresh(next.refreshToken);
    assert.equal(afterLogout.status, 401);
  });

  test('refresh con token inválido → 401 REFRESH_INVALID; sin token → 400', async () => {
    const res = await refresh('no-es-un-jwt');
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'REFRESH_INVALID');
    assertValidationError(await request(app).post('/api/auth/refresh').send({}), ['refreshToken']);
  });

  test('usar el access token como refresh token → 401 REFRESH_INVALID', async () => {
    const { body } = await registerUser();
    const res = await refresh(body.tokens.accessToken);
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'REFRESH_INVALID');
  });

  test('logout sin cuerpo responde 204 igual', async () => {
    assert.equal((await request(app).post('/api/auth/logout')).status, 204);
  });

  test('logout-all revoca los refresh tokens de todos los dispositivos', async () => {
    const { email, password, body } = await registerUser();
    const second = (await login(email, password)).body.data.tokens;
    const out = await request(app).post('/api/auth/logout-all').set('Authorization', `Bearer ${second.accessToken}`);
    assert.equal(out.status, 204);
    assert.equal((await refresh(body.tokens.refreshToken)).status, 401);
    assert.equal((await refresh(second.refreshToken)).status, 401);
  });

  test('cambiar contraseña: la anterior deja de funcionar y la nueva sí', async () => {
    const { email, password, body } = await registerUser({ password: 'Anterior123' });
    const res = await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${body.tokens.accessToken}`)
      .send({ currentPassword: password, newPassword: 'Nueva12345' });
    assert.equal(res.status, 200, res.text);
    assert.ok(res.body.data.tokens.accessToken);
    assert.ok(res.body.data.tokens.refreshToken);

    const old = await login(email, password);
    assert.equal(old.status, 401);
    assert.equal(old.body.error.code, 'INVALID_CREDENTIALS');
    assert.equal((await login(email, 'Nueva12345')).status, 200);
  });

  test('cambiar contraseña revoca las sesiones anteriores pero entrega un par nuevo válido', async () => {
    const { password, body } = await registerUser({ password: 'Anterior123' });
    const res = await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${body.tokens.accessToken}`)
      .send({ currentPassword: password, newPassword: 'Nueva12345' });
    assert.equal(res.status, 200, res.text);
    // El par nuevo funciona (se prueba primero: reutilizar un token revocado cierra TODAS las sesiones).
    const renewed = await refresh(res.body.data.tokens.refreshToken);
    assert.equal(renewed.status, 200, renewed.text);
    const stale = await refresh(body.tokens.refreshToken);
    assert.equal(stale.status, 401);
    assert.equal(stale.body.error.code, 'REFRESH_REUSED');
  });

  test('cambiar contraseña con la actual incorrecta → 400 INVALID_PASSWORD y no cambia nada', async () => {
    const { email, password, body } = await registerUser({ password: 'Anterior123' });
    const res = await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${body.tokens.accessToken}`)
      .send({ currentPassword: 'Equivocada1', newPassword: 'Nueva12345' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_PASSWORD');
    assert.equal((await login(email, password)).status, 200);
  });

  test('cambiar contraseña sin enviar la actual (cuenta con contraseña) → 400 INVALID_PASSWORD', async () => {
    const { body } = await registerUser();
    const res = await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${body.tokens.accessToken}`)
      .send({ newPassword: 'Nueva12345' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_PASSWORD');
  });

  test('la nueva contraseña cumple las mismas reglas que el registro', async () => {
    const { password, body } = await registerUser();
    const res = await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${body.tokens.accessToken}`)
      .send({ currentPassword: password, newPassword: 'corta' });
    assertValidationError(res, ['newPassword', 'newPassword']);
  });

  test('cambiar contraseña sin sesión → 401', async () => {
    const res = await request(app).put('/api/auth/password').send({ newPassword: 'Nueva12345' });
    assert.equal(res.status, 401);
  });
});

describe('seguridad: intentos de saltear la validación', () => {
  const valid = () => ({ name: 'Nombre Válido', email: uniqueEmail('seg'), password: 'Clave1234' });
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const adminToken = async () => (await login('admin@macroentreno.com')).body.data.tokens.accessToken;
  const listUsers = (accessToken) => request(app).get('/api/users').set('Authorization', `Bearer ${accessToken}`);

  // --- Tokens de acceso ---

  test('JWT con alg "none" (sin firma) y rol admin → 401 TOKEN_INVALID', async () => {
    const { body } = await registerUser();
    const forged = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: body.user.id, role: 'admin', type: 'access' })}.`;
    const res = await me(forged);
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'TOKEN_INVALID');
  });

  test('JWT firmado con otro secreto → 401 TOKEN_INVALID', async () => {
    const { body } = await registerUser();
    const forged = jwt.sign({ sub: body.user.id, role: 'admin', type: 'access' }, 'secreto-adivinado');
    const res = await me(forged);
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'TOKEN_INVALID');
  });

  test('JWT con el payload alterado (rol admin) y la firma original → 401 TOKEN_INVALID', async () => {
    const { body } = await registerUser();
    const [header, , signature] = body.tokens.accessToken.split('.');
    const tampered = `${header}.${b64({ sub: body.user.id, role: 'admin', type: 'access' })}.${signature}`;
    assert.equal((await me(tampered)).status, 401);
    assert.equal((await listUsers(tampered)).status, 401);
  });

  test('JWT con el secreto correcto pero otro algoritmo (HS512) → 401: el algoritmo está fijado', async () => {
    const { body } = await registerUser();
    const other = jwt.sign({ sub: body.user.id, role: 'athlete', type: 'access' }, env.jwt.accessSecret, {
      algorithm: 'HS512',
    });
    assert.equal((await me(other)).status, 401);
  });

  test('el rol se lee de la base, no del token: un token válido que dice "admin" no da permisos de admin', async () => {
    const { body } = await registerUser();
    const lying = signAccessToken({ id: body.user.id, role: 'admin' });
    assert.equal((await listUsers(lying)).status, 403);
    assert.equal((await me(lying)).body.data.role, 'athlete');
  });

  test('si un admin le baja el rol, el token emitido antes pierde los permisos al instante', async () => {
    const { body } = await registerUser();
    await pool.query("UPDATE users SET role = 'coach' WHERE id = ?", [body.user.id]);
    const token = signAccessToken({ id: body.user.id, role: 'coach' });
    assert.equal((await listUsers(token)).status, 200);
    await pool.query("UPDATE users SET role = 'athlete' WHERE id = ?", [body.user.id]);
    assert.equal((await listUsers(token)).status, 403);
  });

  test('token vencido → 401 TOKEN_EXPIRED', async () => {
    const { body } = await registerUser();
    const expired = jwt.sign({ sub: body.user.id, role: 'athlete', type: 'access' }, env.jwt.accessSecret, {
      expiresIn: -10,
    });
    const res = await me(expired);
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'TOKEN_EXPIRED');
  });

  test('usar el refresh token como access token → 401 TOKEN_INVALID', async () => {
    const { body } = await registerUser();
    const res = await me(body.tokens.refreshToken);
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'TOKEN_INVALID');
  });

  test('un "state" de OAuth (firmado con el mismo secreto) no sirve como access token', async () => {
    const state = oauth.signState({ provider: 'google', appRedirectUri: 'macroentreno://x', challenge: 'a'.repeat(64) });
    assert.equal((await me(state)).status, 401);
  });

  test('token de un usuario borrado → 401', async () => {
    const { body } = await registerUser();
    await pool.query('DELETE FROM users WHERE id = ?', [body.user.id]);
    const res = await me(body.tokens.accessToken);
    assert.equal(res.status, 401);
    assert.equal((await refresh(body.tokens.refreshToken)).status, 401);
  });

  test('cabecera Authorization mal formada → 401', async () => {
    const { body } = await registerUser();
    const token = body.tokens.accessToken;
    for (const header of [token, `bearer ${token}`, `Basic ${token}`, 'Bearer', 'Bearer ', `Bearer ${token}x`]) {
      const res = await request(app).get('/api/auth/me').set('Authorization', header);
      assert.equal(res.status, 401, header);
    }
  });

  // --- Refresh y logout ---

  test('refresh token "inventado" con el secreto correcto pero que no está en la base → 401', async () => {
    const { body } = await registerUser();
    const forged = jwt.sign({ sub: body.user.id, type: 'refresh', jti: crypto.randomUUID() }, env.jwt.refreshSecret);
    const res = await refresh(forged);
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'REFRESH_INVALID');
  });

  test('refresh con alg "none" → 401 REFRESH_INVALID', async () => {
    const forged = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 1, type: 'refresh' })}.`;
    assert.equal((await refresh(forged)).body.error.code, 'REFRESH_INVALID');
  });

  test('refresh o logout con tipos que no son texto → 400, nunca 500', async () => {
    for (const refreshToken of [123, { $ne: null }, ['a'], true]) {
      assertValidationError(await refresh(refreshToken), ['refreshToken']);
      assertValidationError(await request(app).post('/api/auth/logout').send({ refreshToken }), ['refreshToken']);
    }
  });

  // --- Inyección y tipos ---

  test('inyección SQL en el email del login → 400 o 401, nunca entra', async () => {
    for (const email of ["' OR '1'='1", "admin@macroentreno.com' --", "' OR 1=1 --@x.com", "a'--@x.com"]) {
      const res = await login(email, "' OR '1'='1");
      assert.ok([400, 401].includes(res.status), `${email}: ${res.status}`);
      assert.equal(res.body.data, undefined);
    }
  });

  test('inyección SQL en la contraseña de un usuario existente → 401 INVALID_CREDENTIALS', async () => {
    for (const password of ["' OR '1'='1", "' OR 1=1 --", '") OR ("1"="1']) {
      const res = await login('admin@macroentreno.com', password);
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
    }
  });

  test('un nombre con SQL se guarda como texto literal y no rompe nada', async () => {
    const name = "Robert'); DROP TABLE users;--";
    const { body } = await registerUser({ name });
    assert.equal(body.user.name, name);
    const [[row]] = await pool.query('SELECT COUNT(*) AS n FROM users');
    assert.ok(row.n > 1);
  });

  test('login con objetos o arrays en vez de texto (inyección tipo NoSQL) → 400', async () => {
    const bodies = [
      { email: { $ne: null }, password: { $ne: null } },
      { email: ['admin@macroentreno.com'], password: [DEMO_PASSWORD] },
      { email: 'admin@macroentreno.com', password: { $gt: '' } },
      { email: 'admin@macroentreno.com', password: 12345678 },
      { email: 'admin@macroentreno.com', password: true },
      { email: null, password: null },
    ];
    for (const body of bodies) {
      const res = await request(app).post('/api/auth/login').send(body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    }
  });

  test('cuerpo que no es JSON válido → 400 INVALID_JSON', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_JSON');
  });

  test('cuerpo gigante (más de 100 kB) → 413 PAYLOAD_TOO_LARGE, no 500', async () => {
    const res = await register({ ...valid(), name: 'x'.repeat(200_000) });
    assert.equal(res.status, 413);
    assert.equal(res.body.error.code, 'PAYLOAD_TOO_LARGE');
  });

  // --- Email ---

  test('email con caracteres invisibles, NUL o no ASCII → 400 (email)', async () => {
    for (const email of [
      `ana​.${Date.now()}@test.com`,
      `ana.${Date.now()}@test.com\u0000`,
      `ana\u0000.${Date.now()}@test.com`,
      `añá.${Date.now()}@test.com`,
      `ana.${Date.now()}@tëst.com`,
      `ana .${Date.now()}@test.com`,
    ]) {
      assertValidationError(await register({ ...valid(), email }), ['email']);
    }
  });

  test('email con tabulaciones, saltos de línea o espacios alrededor se normaliza', async () => {
    const local = `tab.${Date.now()}`;
    const res = await register({ ...valid(), email: `\t ${local.toUpperCase()}@Test.com \n` });
    assert.equal(res.status, 201, res.text);
    assert.equal(res.body.data.user.email, `${local}@test.com`);
  });

  test('email de 190 caracteres se acepta; de 191 → 400 (no 500 por la columna de la base)', async () => {
    const domain = `@${Date.now()}.com`;
    const at190 = `${'a'.repeat(190 - domain.length)}${domain}`;
    assert.equal(at190.length, 190);
    assert.equal((await register({ ...valid(), email: at190 })).status, 201);
    const res = await register({ ...valid(), email: `b${at190}` });
    assertValidationError(res, ['email']);
    assert.match(res.body.error.details[0].message, /190 caracteres/);
    assertValidationError(await login(`b${at190}`), ['email']);
  });

  // --- Nombre ---

  test('nombre con NUL, saltos de línea o caracteres invisibles → 400 (name)', async () => {
    for (const name of ['Ana\u0000Pérez', 'Ana\nPérez', '​​', 'Ana‮Pérez', 'Ana​']) {
      const res = await register({ ...valid(), name });
      assert.equal(res.status, 400, JSON.stringify(name));
      assert.deepEqual([...new Set(fieldsOf(res))], ['name']);
    }
  });

  test('nombre sin letras → 400 (name)', async () => {
    for (const name of ['12', '....', '1234 5678']) {
      const res = await register({ ...valid(), name });
      assertValidationError(res, ['name']);
      assert.match(res.body.error.details[0].message, /al menos una letra/);
    }
  });

  test('nombre de 100 caracteres se acepta', async () => {
    const { body } = await registerUser({ name: 'a'.repeat(100) });
    assert.equal(body.user.name.length, 100);
  });

  // --- Contraseña ---

  test('contraseña de solo espacios → 400 (password)', async () => {
    const res = await register({ ...valid(), password: ' '.repeat(12) });
    assertValidationError(res, ['password', 'password']);
  });

  test('contraseña de menos de 72 caracteres pero más de 72 bytes (ñ, tildes, emojis) → 400', async () => {
    for (const password of [`${'ñ'.repeat(40)}a1`, `${'😀'.repeat(20)}a1`]) {
      const res = await register({ ...valid(), password });
      assertValidationError(res, ['password']);
      assert.match(res.body.error.details[0].message, /demasiado larga/);
    }
    await registerUser({ password: `${'ñ'.repeat(35)}a1` }); // 72 bytes justos
  });

  test('bcrypt ignora lo que pasa de 72 bytes: "clave de 72 + basura" NO inicia sesión', async () => {
    const password = `${'a'.repeat(71)}1`;
    const { email } = await registerUser({ password });
    assert.equal((await login(email, password)).status, 200);
    const res = await login(email, `${password}LoQueSea`);
    assertValidationError(res, ['password']);
    assert.equal(res.body.data, undefined);
  });

  test('cambiar contraseña con "actual + basura" (más de 72) → 400 y no cambia', async () => {
    const password = `${'b'.repeat(71)}2`;
    const { email, body } = await registerUser({ password });
    const res = await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${body.tokens.accessToken}`)
      .send({ currentPassword: `${password}X`, newPassword: 'Nueva12345' });
    assertValidationError(res, ['currentPassword']);
    assert.equal((await login(email, password)).status, 200);
  });

  // --- Campos que no se pueden elegir al registrarse ---

  test('registrarse enviando role, isActive, proUntil o coachId no tiene efecto', async () => {
    const [[coach]] = await pool.query("SELECT id FROM users WHERE role = 'coach' LIMIT 1");
    const res = await register({
      ...valid(),
      role: 'admin',
      isActive: false,
      is_active: 0,
      proUntil: '2099-01-01',
      pro_until: '2099-01-01',
      coachId: coach.id,
      coach_id: coach.id,
      id: 1,
    });
    assert.equal(res.status, 201, res.text);
    const { user } = res.body.data;
    assert.notEqual(user.id, 1);
    const [[row]] = await pool.query('SELECT role, is_active, pro_until, coach_id FROM users WHERE id = ?', [user.id]);
    assert.deepEqual({ ...row }, { role: 'athlete', is_active: 1, pro_until: null, coach_id: null });
  });

  // --- Límite de intentos ---

  test('login, registro y cambio de contraseña tienen límite de intentos (cabeceras RateLimit)', async () => {
    const { body } = await registerUser();
    const responses = [
      await login('nadie@test.com', 'x'),
      await register({}),
      await request(app).put('/api/auth/password').set('Authorization', `Bearer ${body.tokens.accessToken}`).send({}),
      await request(app).post('/api/auth/oauth/exchange').send({}),
    ];
    for (const res of responses) assert.ok(res.headers['ratelimit-policy'], res.req.path);
  });

  // --- Login social ---

  test('canje OAuth con un código inventado → 401 SOCIAL_LOGIN_FAILED', async () => {
    const res = await request(app)
      .post('/api/auth/oauth/exchange')
      .send({ code: 'inventado', codeVerifier: 'v'.repeat(43) });
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'SOCIAL_LOGIN_FAILED');
  });

  test('canje OAuth: sin el code_verifier correcto no entra y el código queda quemado', async () => {
    const { body } = await registerUser();
    const verifier = 'v'.repeat(50);
    const challenge = crypto.createHash('sha256').update(verifier).digest('hex');
    const exchange = (code, codeVerifier) => request(app).post('/api/auth/oauth/exchange').send({ code, codeVerifier });

    const stolen = oauth.createLoginCode(body.user.id, challenge);
    assert.equal((await exchange(stolen, 'w'.repeat(50))).status, 401);
    assert.equal((await exchange(stolen, verifier)).status, 401); // un solo uso

    const fresh = oauth.createLoginCode(body.user.id, challenge);
    const ok = await exchange(fresh, verifier);
    assert.equal(ok.status, 200, ok.text);
    assert.equal(ok.body.data.user.id, body.user.id);
    assert.equal((await exchange(fresh, verifier)).status, 401);
  });

  test('callback OAuth con un "state" falso (access token o firmado con otro secreto) → 400', async () => {
    const { body } = await registerUser();
    const fake = jwt.sign({ type: 'oauth_state', provider: 'google', appRedirectUri: 'macroentreno://x' }, 'otro');
    for (const state of [body.tokens.accessToken, fake, '']) {
      const res = await request(app).get('/api/auth/oauth/google/callback').query({ state, code: 'x' });
      assert.equal(res.status, 400, state);
    }
  });

  test('OAuth solo vuelve a esquemas de la app (sin redirecciones abiertas)', () => {
    for (const uri of ['https://evil.com/robar', 'javascript:alert(1)', 'no-es-url']) {
      assert.throws(() => oauth.assertAppRedirect(uri), { status: 400 }, uri);
    }
    assert.doesNotThrow(() => oauth.assertAppRedirect('macroentreno://oauth-callback'));
  });

  test('login social con el email en mayúsculas se vincula a la cuenta existente (no duplica)', async () => {
    const { email, body } = await registerUser();
    const userId = await authService.linkSocialAccount('google', {
      providerUserId: `g-${Date.now()}`,
      email: `  ${email.toUpperCase()} `,
      name: 'Desde Google',
      avatarUrl: null,
    });
    assert.equal(userId, body.user.id);
  });

  // --- Alta y edición de usuarios por un admin ---

  test('alta de usuario por admin aplica las mismas reglas que el registro', async () => {
    const token = await adminToken();
    const create = (data) => request(app).post('/api/users').set('Authorization', `Bearer ${token}`).send(data);
    for (const password of ['12345678', 'SoloLetras', 'corta1', `${'a'.repeat(72)}1`]) {
      const res = await create({ ...valid(), password });
      assert.equal(res.status, 400, password);
      assert.deepEqual([...new Set(fieldsOf(res))], ['password']);
    }
    assertValidationError(await create({ ...valid(), name: 'Ana\u0000' }), ['name']);
    assertValidationError(await create({ ...valid(), email: 'x@y.z' }), ['email']);

    const local = `alta.admin.${Date.now()}`;
    const ok = await create({ ...valid(), email: `  ${local.toUpperCase()}@Test.com ` });
    assert.equal(ok.status, 201, ok.text);
    assert.equal(ok.body.data.email, `${local}@test.com`);
  });

  test('edición de usuario por admin normaliza el email con espacios y mayúsculas', async () => {
    const token = await adminToken();
    const { body } = await registerUser();
    const local = `edit.admin.${Date.now()}`;
    const res = await request(app)
      .put(`/api/users/${body.user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: ` ${local.toUpperCase()}@TEST.com  ` });
    assert.equal(res.status, 200, res.text);
    assert.equal(res.body.data.email, `${local}@test.com`);
  });
});
