import { query } from '../../config/db.js';
import { forbidden, notFound } from '../../utils/httpError.js';
import { paginationMeta } from '../../utils/validation.js';
import { MICRO_COLUMNS, microsOf } from '../nutrition/micros.js';
import { getFoodDetail } from './fatsecret.js';
import * as openFoodFacts from './openfoodfacts.js';
import * as usda from './usda.js';

/** Los micronutrientes y el origen solo se incluyen para quien tiene Pro (`micros: true`). */
export function toFood(row, { micros = false } = {}) {
  const food = {
    id: row.id,
    name: row.name,
    category: row.category,
    brand: row.brand,
    portionGrams: row.portion_grams,
    portionDescription: row.portion_description,
    barcode: row.barcode,
    kcal: row.kcal,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    isGlobal: row.owner_id === null,
    ownerId: row.owner_id,
  };
  if (micros) {
    food.micros = microsOf(row);
    food.source = row.external_source ? { name: row.external_source, id: row.external_id } : null;
  }
  return food;
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
export async function listFoods(user, { page, limit, search, category, scope }) {
  const userId = user.id;
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
  return { data: rows.map((row) => toFood(row, { micros: user.pro })), meta: paginationMeta(page, limit, total) };
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
  barcode: 'barcode',
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
  return toFood(await getFood(user, result.insertId), { micros: user.pro });
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
  return toFood(await getFood(user, id), { micros: user.pro });
}

/**
 * Trae un alimento de FatSecret y lo guarda en el catálogo global (los datos son de la fuente, no del usuario).
 * Si ya se había importado, se actualizan sus valores en lugar de duplicarlo.
 */
export async function importFatSecretFood(user, externalId) {
  return saveExternalFood(user, 'fatsecret', await getFoodDetail(externalId));
}

const SOURCE_CATEGORY = { fatsecret: 'FatSecret', openfoodfacts: 'Open Food Facts', usda: 'USDA' };

/**
 * Guarda un alimento de una fuente externa en el catálogo global (los datos son de la fuente, no
 * del usuario). Si ya se había importado, se actualizan sus valores en lugar de duplicarlo.
 */
async function saveExternalFood(user, source, food) {
  const values = {
    name: food.name.slice(0, 150),
    category: SOURCE_CATEGORY[source],
    barcode: food.barcode ?? null,
    brand: food.brand?.slice(0, 80) ?? null,
    portion_grams: food.portionGrams,
    portion_description: food.portionDescription,
    kcal: food.kcal,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    ...Object.fromEntries(MICRO_COLUMNS.map((c) => [c, food.micros[c]])),
  };
  const columns = Object.keys(values);
  await query(
    `INSERT INTO foods (owner_id, external_source, external_id, ${columns.join(', ')})
     VALUES (NULL, ?, ?, ${columns.map(() => '?').join(', ')})
     ON DUPLICATE KEY UPDATE ${columns.map((c) => `${c} = VALUES(${c})`).join(', ')}`,
    [source, food.externalId, ...columns.map((c) => values[c])],
  );
  const [row] = await query('SELECT * FROM foods WHERE external_source = ? AND external_id = ?', [source, food.externalId]);
  return toFood(row, { micros: user.pro });
}

/** Busca en las bases gratuitas. Los resultados traen macros y micronutrientes cada 100 g. */
export async function searchExternal(source, search, { limit }) {
  const foods = source === 'usda' ? await usda.searchFoods(search, { limit }) : await openFoodFacts.searchProducts(search, { limit });
  return foods.map((food) => ({ ...food, source, microsCount: Object.values(food.micros).filter((v) => v !== null).length }));
}

/** Importa al catálogo un alimento de Open Food Facts (por código) o de USDA (por fdcId). */
export async function importExternal(user, source, externalId) {
  const food = source === 'usda' ? await usda.getFood(externalId) : await openFoodFacts.getProductByBarcode(externalId);
  if (!food) throw notFound('Ese producto no está en Open Food Facts o no informa sus calorías');
  return saveExternalFood(user, source, food);
}

/**
 * Código de barras escaneado: primero el catálogo (propios del usuario y globales), después Open
 * Food Facts, que si lo encuentra se guarda para que el próximo escaneo no salga de la app.
 * `found: false` si no está en ningún lado (la app ofrece cargarlo a mano con ese código).
 */
export async function findByBarcode(user, barcode) {
  const [row] = await query(
    'SELECT * FROM foods WHERE barcode = ? AND (owner_id IS NULL OR owner_id = ?) ORDER BY owner_id IS NULL, id LIMIT 1',
    [barcode, user.id],
  );
  if (row) return { found: true, source: 'catalog', food: toFood(row, { micros: user.pro }) };
  const product = await openFoodFacts.getProductByBarcode(barcode);
  if (!product) return { found: false, barcode };
  return { found: true, source: 'openfoodfacts', food: await saveExternalFood(user, 'openfoodfacts', product) };
}

export async function deleteFood(user, id) {
  const row = await getFood(user, id);
  assertCanEdit(user, row);
  await query('DELETE FROM foods WHERE id = ?', [id]);
}
