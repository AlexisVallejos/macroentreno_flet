import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { query } from '../../config/db.js';
import { unauthorized } from '../../utils/httpError.js';

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

// Se fija el algoritmo: un token con otro "alg" (incluido "none") se rechaza aunque la firma cierre.
export const JWT_ALGORITHMS = ['HS256'];

export function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, type: 'access' }, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiresIn,
  });
}

/** Crea un token de renovación (JWT) y guarda su hash en la base. */
async function createRefreshToken(userId) {
  const days = env.jwt.refreshExpiresDays;
  const token = jwt.sign({ sub: userId, type: 'refresh', jti: crypto.randomUUID() }, env.jwt.refreshSecret, {
    expiresIn: `${days}d`,
  });
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await query('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)', [
    userId,
    sha256(token),
    expiresAt,
  ]);
  return token;
}

/** Par de tokens que se devuelve en login, registro, social y refresh. */
export async function issueTokens(user) {
  return {
    accessToken: signAccessToken(user),
    refreshToken: await createRefreshToken(user.id),
    tokenType: 'Bearer',
    expiresIn: env.jwt.accessExpiresIn,
  };
}

/**
 * Rotación: valida el token de renovación, lo revoca y devuelve el id del usuario.
 * Si alguien reutiliza un token ya revocado se asume robo y se cierran todas sus sesiones.
 */
export async function consumeRefreshToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, env.jwt.refreshSecret, { algorithms: JWT_ALGORITHMS });
  } catch {
    throw unauthorized('Token de renovación inválido o vencido', 'REFRESH_INVALID');
  }
  if (payload.type !== 'refresh') throw unauthorized('Token de renovación inválido', 'REFRESH_INVALID');

  const [stored] = await query('SELECT id, user_id, revoked_at FROM refresh_tokens WHERE token_hash = ?', [
    sha256(token),
  ]);
  if (!stored) throw unauthorized('Token de renovación desconocido', 'REFRESH_INVALID');
  if (stored.revoked_at) {
    await revokeAllForUser(stored.user_id);
    throw unauthorized('Token de renovación reutilizado; iniciá sesión de nuevo', 'REFRESH_REUSED');
  }
  await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?', [stored.id]);
  return stored.user_id;
}

export async function revokeRefreshToken(token) {
  await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL', [
    sha256(token),
  ]);
}

export async function revokeAllForUser(userId) {
  await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [userId]);
}
