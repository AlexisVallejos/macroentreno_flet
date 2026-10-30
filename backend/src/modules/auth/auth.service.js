import bcrypt from 'bcryptjs';
import { query, transaction } from '../../config/db.js';
import { HttpError, badRequest, conflict, forbidden, unauthorized } from '../../utils/httpError.js';
import { EMAIL_MAX } from '../../utils/validation.js';
import { USER_COLUMNS, USER_FROM, toPublicUser } from '../users/users.mapper.js';
import { consumeRefreshToken, issueTokens, revokeAllForUser, revokeRefreshToken } from './tokens.js';

const BCRYPT_ROUNDS = 10;

export async function findUserById(id) {
  const [row] = await query(`SELECT ${USER_COLUMNS} FROM ${USER_FROM} WHERE u.id = ?`, [id]);
  return row;
}

async function session(row) {
  if (!row.is_active) throw forbidden('Tu cuenta está desactivada');
  return { user: toPublicUser(row), tokens: await issueTokens(row) };
}

export async function register({ name, email, password }) {
  const [existing] = await query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) throw conflict('Ya existe una cuenta con ese email');

  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  // Todo registro público crea un atleta; los otros roles los asigna un admin.
  const result = await query('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', [
    name,
    email,
    hash,
    'athlete',
  ]);
  return session(await findUserById(result.insertId));
}

export async function login({ email, password }) {
  const [row] = await query(`SELECT ${USER_COLUMNS} FROM ${USER_FROM} WHERE u.email = ?`, [email]);
  // Mismo mensaje para email o contraseña incorrectos: no revela qué cuentas existen.
  const invalid = unauthorized('Email o contraseña incorrectos', 'INVALID_CREDENTIALS');
  if (!row) throw invalid;
  if (!row.password_hash) {
    throw new HttpError(
      401,
      'SOCIAL_ACCOUNT',
      'Esta cuenta se creó con una red social. Iniciá sesión con Google, Facebook o GitHub.',
    );
  }
  if (!(await bcrypt.compare(password, row.password_hash))) throw invalid;
  return session(row);
}

export async function refresh(refreshToken) {
  const userId = await consumeRefreshToken(refreshToken);
  const row = await findUserById(userId);
  if (!row) throw unauthorized('El usuario ya no existe', 'REFRESH_INVALID');
  return session(row);
}

export async function logout(refreshToken, { allDevices = false, userId } = {}) {
  if (allDevices && userId) await revokeAllForUser(userId);
  else if (refreshToken) await revokeRefreshToken(refreshToken);
}

/**
 * Login social: busca la cuenta vinculada; si no existe, la vincula a un usuario
 * con el mismo email verificado o crea un atleta nuevo.
 */
export async function linkSocialAccount(provider, profile) {
  if (!profile.providerUserId) throw badRequest('El proveedor no devolvió un identificador de usuario');
  // El email del proveedor se normaliza igual que en el registro; si no entra en la columna, se ignora.
  const email = String(profile.email || '').trim().toLowerCase();
  profile = { ...profile, email: email && email.length <= EMAIL_MAX ? email : null };

  const userId = await transaction(async (conn) => {
    const [[linked]] = await conn.query(
      'SELECT user_id FROM social_accounts WHERE provider = ? AND provider_user_id = ?',
      [provider, profile.providerUserId],
    );
    if (linked) return linked.user_id;

    let id;
    if (profile.email) {
      const [[byEmail]] = await conn.query('SELECT id FROM users WHERE email = ?', [profile.email]);
      id = byEmail?.id;
    }
    if (!id) {
      const [created] = await conn.query('INSERT INTO users (name, email, avatar_url, role) VALUES (?, ?, ?, ?)', [
        profile.name.slice(0, 100),
        profile.email,
        profile.avatarUrl,
        'athlete',
      ]);
      id = created.insertId;
    }
    await conn.query('INSERT INTO social_accounts (user_id, provider, provider_user_id) VALUES (?, ?, ?)', [
      id,
      provider,
      profile.providerUserId,
    ]);
    return id;
  });

  const row = await findUserById(userId);
  if (!row.is_active) throw forbidden('Tu cuenta está desactivada');
  return userId;
}

export async function sessionForUser(userId) {
  return session(await findUserById(userId));
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const [row] = await query('SELECT password_hash FROM users WHERE id = ?', [userId]);
  // Si la cuenta es solo social puede definir una contraseña sin dar la anterior.
  if (row.password_hash) {
    if (!currentPassword || !(await bcrypt.compare(currentPassword, row.password_hash))) {
      throw new HttpError(400, 'INVALID_PASSWORD', 'La contraseña actual no es correcta');
    }
  }
  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, userId]);
  await revokeAllForUser(userId);
}
