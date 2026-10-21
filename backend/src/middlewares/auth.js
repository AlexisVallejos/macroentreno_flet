import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { query } from '../config/db.js';
import { forbidden, paymentRequired, unauthorized } from '../utils/httpError.js';

/** Exige un token de acceso válido en "Authorization: Bearer <token>". */
export async function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw unauthorized('Falta el token de acceso');

  let payload;
  try {
    payload = jwt.verify(token, env.jwt.accessSecret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw unauthorized('El token de acceso venció', 'TOKEN_EXPIRED');
    throw unauthorized('Token de acceso inválido', 'TOKEN_INVALID');
  }
  if (payload.type !== 'access') throw unauthorized('Token de acceso inválido', 'TOKEN_INVALID');

  // Se consulta el usuario para reflejar al instante cambios de rol, bajas o el vencimiento de Pro.
  const [user] = await query(
    'SELECT id, role, coach_id, is_active, (pro_until IS NOT NULL AND pro_until > NOW()) AS pro_active FROM users WHERE id = ?',
    [payload.sub],
  );
  if (!user) throw unauthorized('El usuario ya no existe', 'TOKEN_INVALID');
  if (!user.is_active) throw forbidden('Tu cuenta está desactivada');

  // Entrenadores y administradores tienen las funciones Pro incluidas: las usan para seguir a sus atletas.
  req.user = { id: user.id, role: user.role, coachId: user.coach_id, pro: user.role !== 'athlete' || Boolean(user.pro_active) };
  next();
}

/** Exige MacroEntreno Pro (402 PRO_REQUIRED). Usar después de authenticate. */
export function requirePro(req, _res, next) {
  if (!req.user.pro) throw paymentRequired();
  next();
}

/** Restringe la ruta a los roles indicados. Usar después de authenticate. */
export const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!roles.includes(req.user.role)) throw forbidden();
    next();
  };
