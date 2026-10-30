import bcrypt from 'bcryptjs';
import { query, transaction } from '../../config/db.js';
import { badRequest, notFound } from '../../utils/httpError.js';
import { paginationMeta } from '../../utils/validation.js';
import { revokeAllForUser } from '../auth/tokens.js';
import { USER_COLUMNS, USER_FROM, toPublicUser } from './users.mapper.js';

const GOAL_COLUMNS = { kcal: 'kcal_goal', protein: 'protein_goal', carbs: 'carbs_goal', fat: 'fat_goal' };

export async function getUser(id) {
  const [row] = await query(`SELECT ${USER_COLUMNS} FROM ${USER_FROM} WHERE u.id = ?`, [id]);
  if (!row) throw notFound('Usuario no encontrado');
  return toPublicUser(row);
}

/** Listado paginado. Si se pasa coachId, solo devuelve los atletas de ese entrenador. */
export async function listUsers({ page, limit, role, search, coachId }) {
  const where = [];
  const params = [];
  if (role) {
    where.push('u.role = ?');
    params.push(role);
  }
  if (coachId) {
    where.push('u.coach_id = ?');
    params.push(coachId);
  }
  if (search) {
    where.push('(u.name LIKE ? OR u.email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM ${USER_FROM} ${whereSql}`, params);
  const rows = await query(`SELECT ${USER_COLUMNS} FROM ${USER_FROM} ${whereSql} ORDER BY u.name LIMIT ? OFFSET ?`, [
    ...params,
    limit,
    (page - 1) * limit,
  ]);
  return { data: rows.map(toPublicUser), meta: paginationMeta(page, limit, total) };
}

async function assertCoach(coachId) {
  if (coachId == null) return;
  const [coach] = await query('SELECT role, is_active FROM users WHERE id = ?', [coachId]);
  if (!coach || coach.role !== 'coach' || !coach.is_active) throw badRequest('coachId debe corresponder a un usuario con rol coach');
}

/** Arma "SET col = ?, ..." solo con los campos presentes. */
function buildUpdate(data) {
  const sets = [];
  const params = [];
  const map = { name: 'name', email: 'email', role: 'role', coachId: 'coach_id', avatarUrl: 'avatar_url' };
  for (const [key, column] of Object.entries(map)) {
    if (data[key] !== undefined) {
      sets.push(`${column} = ?`);
      params.push(data[key]);
    }
  }
  if (data.isActive !== undefined) {
    sets.push('is_active = ?');
    params.push(data.isActive ? 1 : 0);
  }
  for (const [key, column] of Object.entries(GOAL_COLUMNS)) {
    if (data.goals?.[key] !== undefined) {
      sets.push(`${column} = ?`);
      params.push(data.goals[key]);
    }
  }
  return { sets, params };
}

export async function updateUser(id, body) {
  const data = { ...body };
  let revoke = false;
  await transaction(async (conn) => {
    const [[current]] = await conn.query('SELECT * FROM users WHERE id = ? FOR UPDATE', [id]);
    if (!current) throw notFound('Usuario no encontrado');
    const finalRole = data.role ?? current.role;
    if (finalRole !== 'athlete') data.coachId = null;
    else await assertCoach(data.coachId);
    const { sets, params } = buildUpdate(data);
    if (sets.length) await conn.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
    if (data.coachId !== undefined && data.coachId !== current.coach_id) {
      await conn.query('UPDATE coach_assignments SET ended_at = NOW() WHERE athlete_id = ? AND ended_at IS NULL', [id]);
      if (data.coachId != null) await conn.query(
        'INSERT INTO coach_assignments (athlete_id, coach_id) VALUES (?, ?)', [id, data.coachId]);
    }
    if (current.role === 'coach' && finalRole !== 'coach') {
      await conn.query('UPDATE coach_assignments SET ended_at = NOW() WHERE coach_id = ? AND ended_at IS NULL', [id]);
      await conn.query('UPDATE users SET coach_id = NULL WHERE coach_id = ?', [id]);
    }
    revoke = data.isActive === false || finalRole !== current.role;
  });
  if (revoke) await revokeAllForUser(id);
  return getUser(id);
}

export async function createUser({ name, email, password, role, coachId }) {
  if (role === 'athlete') await assertCoach(coachId);
  const hash = await bcrypt.hash(password, 10);
  const id = await transaction(async (conn) => {
    const [result] = await conn.query(
      'INSERT INTO users (name, email, password_hash, role, coach_id) VALUES (?, ?, ?, ?, ?)',
      [name, email, hash, role, role === 'athlete' ? (coachId ?? null) : null]);
    if (role === 'athlete' && coachId) await conn.query(
      'INSERT INTO coach_assignments (athlete_id, coach_id) VALUES (?, ?)', [result.insertId, coachId]);
    return result.insertId;
  });
  return getUser(id);
}

export async function deleteUser(id) {
  const result = await query('DELETE FROM users WHERE id = ?', [id]);
  if (!result.affectedRows) throw notFound('Usuario no encontrado');
}
