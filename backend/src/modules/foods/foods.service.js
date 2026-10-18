import { query } from '../../config/db.js';
import { forbidden, notFound } from '../../utils/httpError.js';
import { paginationMeta } from '../../utils/validation.js';

export function toFood(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    brand: row.brand,
    portionGrams: row.portion_grams,
    portionDescription: row.portion_description,
    kcal: row.kcal,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    isGlobal: row.owner_id === null,
    ownerId: row.owner_id,
  };
}

/**
 * Convierte "pollo cocido" en "+pollo* +cocido*" para el índice FULLTEXT.
 * Las palabras de menos de 3 letras se ignoran (mínimo de InnoDB) y se buscan con LIKE.
 */
function buildSearch(search) {
  const words = search
    .replace(/[+\-<>()~*"@]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const longWords = words.filter((w) => w.length >= 3);
  const shortWords = words.filter((w) => w.length < 3);
  const clauses = [];
  const params = [];
  if (longWords.length) {
    clauses.push('MATCH(f.name, f.brand) AGAINST (? IN BOOLEAN MODE)');
    params.push(longWords.map((w) => `+${w}*`).join(' '));
  }
  for (const w of shortWords) {
    clauses.push('f.name LIKE ?');
    params.push(`%${w}%`);
  }
  return { clauses, params };
}

/** Catálogo visible para un usuario: globales + los propios. */
export async function listFoods(userId, { page, limit, search, category, scope }) {
  const where = [];
  const params = [];
  if (scope === 'global') where.push('f.owner_id IS NULL');
  else if (scope === 'mine') {
    where.push('f.owner_id = ?');
    params.push(userId);
  } else {
    where.push('(f.owner_id IS NULL OR f.owner_id = ?)');
    params.push(userId);
  }
  if (category) {
    where.push('f.category = ?');
    params.push(category);
  }
  if (search) {
    const s = buildSearch(search);
    where.push(...s.clauses);
    params.push(...s.params);
  }
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM foods f ${whereSql}`, params);
  const rows = await query(`SELECT f.* FROM foods f ${whereSql} ORDER BY f.name LIMIT ? OFFSET ?`, [
    ...params,
    limit,
    (page - 1) * limit,
  ]);
  return { data: rows.map(toFood), meta: paginationMeta(page, limit, total) };
}

export async function listCategories() {
  const rows = await query('SELECT DISTINCT category FROM foods WHERE owner_id IS NULL ORDER BY category');
  return rows.map((r) => r.category);
}

/** Devuelve el alimento si el usuario puede verlo (global o propio). */
export async function getFood(user, id) {
  const [row] = await query('SELECT * FROM foods WHERE id = ?', [id]);
  if (!row) throw notFound('Alimento no encontrado');
  if (row.owner_id !== null && row.owner_id !== user.id && user.role !== 'admin') {
    throw notFound('Alimento no encontrado');
  }
  return row;
}

/** Globales: coach/admin. Propios: el dueño o admin. */
function assertCanEdit(user, row) {
  const isGlobal = row.owner_id === null;
  if (isGlobal && !['coach', 'admin'].includes(user.role)) {
    throw forbidden('Solo entrenadores y administradores pueden modificar el catálogo global');
  }
  if (!isGlobal && row.owner_id !== user.id && user.role !== 'admin') throw forbidden();
}

const COLUMNS = {
  name: 'name',
  category: 'category',
  brand: 'brand',
  portionGrams: 'portion_grams',
  portionDescription: 'portion_description',
  kcal: 'kcal',
  protein: 'protein',
  carbs: 'carbs',
  fat: 'fat',
};

export async function createFood(user, data) {
  if (data.isGlobal && !['coach', 'admin'].includes(user.role)) {
    throw forbidden('Solo entrenadores y administradores pueden agregar al catálogo global');
  }
  const ownerId = data.isGlobal ? null : user.id;
  const keys = Object.keys(COLUMNS).filter((k) => data[k] !== undefined);
  const result = await query(
    `INSERT INTO foods (owner_id, ${keys.map((k) => COLUMNS[k]).join(', ')}) VALUES (?, ${keys.map(() => '?').join(', ')})`,
    [ownerId, ...keys.map((k) => data[k])],
  );
  return toFood(await getFood(user, result.insertId));
}

export async function updateFood(user, id, data) {
  const row = await getFood(user, id);
  assertCanEdit(user, row);
  const keys = Object.keys(COLUMNS).filter((k) => data[k] !== undefined);
  if (keys.length) {
    await query(`UPDATE foods SET ${keys.map((k) => `${COLUMNS[k]} = ?`).join(', ')} WHERE id = ?`, [
      ...keys.map((k) => data[k]),
      id,
    ]);
  }
  return toFood(await getFood(user, id));
}

export async function deleteFood(user, id) {
  const row = await getFood(user, id);
  assertCanEdit(user, row);
  await query('DELETE FROM foods WHERE id = ?', [id]);
}
