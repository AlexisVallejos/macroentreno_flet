import { query } from '../../config/db.js';
import { forbidden, notFound } from '../../utils/httpError.js';
import { getFood } from '../foods/foods.service.js';
import { MEALS } from './diary.schemas.js';

const round = (n) => Math.round(n * 10) / 10;

function toEntry(row) {
  return {
    id: row.id,
    userId: row.user_id,
    foodId: row.food_id,
    date: row.entry_date,
    meal: row.meal,
    name: row.name,
    grams: row.grams,
    kcal: row.kcal,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
  };
}

/** Macros de un alimento escalados a los gramos consumidos. */
function scaleFood(food, grams) {
  const factor = grams / Number(food.portion_grams || 100);
  return {
    kcal: round(food.kcal * factor),
    protein: round(food.protein * factor),
    carbs: round(food.carbs * factor),
    fat: round(food.fat * factor),
  };
}

const sum = (entries, key) => round(entries.reduce((acc, e) => acc + Number(e[key] || 0), 0));

export async function getDay(userId, date) {
  const rows = await query(
    `SELECT * FROM diary_entries WHERE user_id = ? AND entry_date = ?
     ORDER BY FIELD(meal, ${MEALS.map(() => '?').join(', ')}), id`,
    [userId, date, ...MEALS],
  );
  const entries = rows.map(toEntry);
  const [goals] = await query(
    'SELECT kcal_goal AS kcal, protein_goal AS protein, carbs_goal AS carbs, fat_goal AS fat FROM users WHERE id = ?',
    [userId],
  );
  return {
    date,
    entries,
    totals: { kcal: sum(entries, 'kcal'), protein: sum(entries, 'protein'), carbs: sum(entries, 'carbs'), fat: sum(entries, 'fat') },
    goals,
  };
}

async function getOwnedEntry(user, id) {
  const [row] = await query('SELECT * FROM diary_entries WHERE id = ?', [id]);
  if (!row) throw notFound('Registro no encontrado');
  if (row.user_id !== user.id && user.role !== 'admin') throw forbidden('Solo podés modificar tu propio diario');
  return row;
}

export async function createEntry(user, data) {
  let { name } = data;
  let macros = { kcal: data.kcal ?? 0, protein: data.protein ?? 0, carbs: data.carbs ?? 0, fat: data.fat ?? 0 };
  if (data.foodId) {
    const food = await getFood(user, data.foodId);
    name = name || food.name;
    macros = scaleFood(food, data.grams);
  }
  const result = await query(
    `INSERT INTO diary_entries (user_id, food_id, entry_date, meal, name, grams, kcal, protein, carbs, fat)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [user.id, data.foodId ?? null, data.date, data.meal, name, data.grams, macros.kcal, macros.protein, macros.carbs, macros.fat],
  );
  const [row] = await query('SELECT * FROM diary_entries WHERE id = ?', [result.insertId]);
  return toEntry(row);
}

export async function updateEntry(user, id, data) {
  const row = await getOwnedEntry(user, id);
  const next = { ...data };
  next.entry_date = data.date;
  delete next.date;

  // Si cambian los gramos y viene de un alimento del catálogo, se recalculan los macros.
  const macrosGiven = ['kcal', 'protein', 'carbs', 'fat'].some((k) => data[k] !== undefined);
  if (data.grams !== undefined && row.food_id && !macrosGiven) {
    const [food] = await query('SELECT * FROM foods WHERE id = ?', [row.food_id]);
    if (food) Object.assign(next, scaleFood(food, data.grams));
  }

  const keys = Object.keys(next).filter((k) => next[k] !== undefined);
  if (keys.length) {
    await query(`UPDATE diary_entries SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [
      ...keys.map((k) => next[k]),
      id,
    ]);
  }
  const [updated] = await query('SELECT * FROM diary_entries WHERE id = ?', [id]);
  return toEntry(updated);
}

export async function deleteEntry(user, id) {
  await getOwnedEntry(user, id);
  await query('DELETE FROM diary_entries WHERE id = ?', [id]);
}
