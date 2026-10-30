import { query } from '../config/db.js';
import { forbidden, notFound } from './httpError.js';

/**
 * Decide sobre qué usuario actúa la petición y si el que la hace tiene permiso.
 *  - Sin userId (o el propio): siempre se permite.
 *  - admin: puede actuar sobre cualquiera.
 *  - coach: solo sobre atletas asignados a él, y solo si `coachCan` lo habilita.
 *  - athlete: nunca sobre otros.
 */
export async function resolveTargetUser(req, requestedUserId, { coachCan = false } = {}) {
  const me = req.user;
  if (!requestedUserId || Number(requestedUserId) === me.id) return me.id;

  const targetId = Number(requestedUserId);
  const [target] = await query('SELECT id, role, coach_id FROM users WHERE id = ?', [targetId]);
  if (!target) throw notFound('Usuario no encontrado');

  if (me.role === 'admin') return targetId;
  if (me.role === 'coach' && coachCan && target.role === 'athlete' && target.coach_id === me.id) return targetId;
  throw forbidden('No tenés acceso a los datos de este usuario');
}
