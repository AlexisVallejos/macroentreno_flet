import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { query } from '../config/db.js';
import { forbidden, unauthorized } from '../utils/httpError.js';

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

  // Se consulta el usuario para reflejar al instante cambios de rol o bajas.
  const [user] = await query('SELECT id, role, coach_id, is_active FROM users WHERE id = ?', [payload.sub]);
  if (!user) throw unauthorized('El usuario ya no existe', 'TOKEN_INVALID');
  if (!user.is_active) throw forbidden('Tu cuenta está desactivada');

  req.user = { id: user.id, role: user.role, coachId: user.coach_id };
  next();
}

/** Restringe la ruta a los roles indicados. Usar después de authenticate. */
export const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!roles.includes(req.user.role)) throw forbidden();
    next();
  };
