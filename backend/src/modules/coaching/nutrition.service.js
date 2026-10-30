import { query, transaction } from '../../config/db.js';
import { badRequest, notFound } from '../../utils/httpError.js';
import { MICRO_COLUMNS, scaleMicros } from '../nutrition/micros.js';
import { argentinaToday } from '../reports/periods.js';
const parse = (v) => typeof v === 'string' ? JSON.parse(v) : v;
const round = (n) => Math.round(n * 10) / 10;

export async function getPlan(id) {
  const [p] = await query(`SELECT p.*, u.name AS athlete_name, c.name AS coach_name FROM meal_plans p
    JOIN users u ON u.id = p.athlete_id LEFT JOIN users c ON c.id = p.coach_id WHERE p.id = ?`, [id]);
  if (!p) throw notFound('Plan no encontrado');
  const items = await query('SELECT * FROM meal_plan_items WHERE plan_id = ? ORDER BY day_of_week, FIELD(meal, \'desayuno\', \'almuerzo\', \'merienda\', \'cena\', \'snack\'), id', [id]);
  return { id: p.id, athleteId: p.athlete_id, athleteName: p.athlete_name, coachId: p.coach_id, coachName: p.coach_name,
    title: p.title, notes: p.notes, startDate: p.start_date, endDate: p.end_date, archived: Boolean(p.archived_at), createdAt: p.created_at,
    items: items.map((i) => ({ id: i.id, foodId: i.food_id, dayOfWeek: i.day_of_week, meal: i.meal, name: i.name,
      grams: i.grams, kcal: i.kcal, protein: i.protein, carbs: i.carbs, fat: i.fat, micros: parse(i.micros) })) };
}
export async function listPlans(athleteId) {
  const plans = await query('SELECT id FROM meal_plans WHERE athlete_id = ? ORDER BY created_at DESC, id DESC LIMIT 100', [athleteId]);
  return Promise.all(plans.map((p) => getPlan(p.id)));
}
export async function createPlan(athleteId, coachId, data) {
  const id = await transaction(async (conn) => {
    const ids = [...new Set(data.items.map((i) => i.foodId))];
    const [foods] = await conn.query('SELECT * FROM foods WHERE id IN (?) AND (owner_id IS NULL OR owner_id = ?)', [ids, athleteId]);
    if (foods.length !== ids.length) throw badRequest('Hay alimentos inexistentes o privados de otro usuario');
    const [result] = await conn.query(`INSERT INTO meal_plans (athlete_id, coach_id, title, notes, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?)`, [athleteId, coachId, data.title, data.notes || null, data.startDate, data.endDate]);
    for (const item of data.items) {
      const food = foods.find((f) => f.id === item.foodId);
      const factor = item.grams / food.portion_grams;
      await conn.query(`INSERT INTO meal_plan_items
        (plan_id, food_id, day_of_week, meal, name, grams, kcal, protein, carbs, fat, micros) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [result.insertId, food.id, item.dayOfWeek, item.meal, food.name, item.grams,
          ...['kcal', 'protein', 'carbs', 'fat'].map((k) => round(food[k] * factor)), JSON.stringify(scaleMicros(food, factor))]);
    }
    return result.insertId;
  });
  return getPlan(id);
}
export async function archivePlan(id) {
  await query('UPDATE meal_plans SET archived_at = COALESCE(archived_at, NOW()) WHERE id = ?', [id]);
  return getPlan(id);
}
export async function applyPlan(plan, athleteId, date) {
  if (date > argentinaToday()) throw badRequest('Registrá comidas consumidas hasta el día de hoy');
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay() || 7;
  const items = plan.items.filter((i) => i.dayOfWeek === 0 || i.dayOfWeek === weekday);
  if (!items.length) throw badRequest('Este plan no tiene comidas para ese día de la semana');
  return transaction(async (conn) => {
    const [[locked]] = await conn.query('SELECT * FROM meal_plans WHERE id = ? FOR UPDATE', [plan.id]);
    if (!locked || locked.archived_at || date < locked.start_date || date > locked.end_date) throw badRequest('El plan no está vigente para esa fecha');
    const [[existing]] = await conn.query('SELECT id FROM meal_plan_applications WHERE plan_id = ? AND athlete_id = ? AND entry_date = ?', [plan.id, athleteId, date]);
    if (existing) return { added: 0, alreadyApplied: true, date };
    for (const item of items) {
      await conn.query(`INSERT INTO diary_entries
        (user_id, food_id, entry_date, meal, name, grams, kcal, protein, carbs, fat, ${MICRO_COLUMNS.join(', ')})
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${MICRO_COLUMNS.map(() => '?').join(', ')})`,
        [athleteId, item.foodId, date, item.meal, item.name, item.grams, item.kcal, item.protein, item.carbs, item.fat,
          ...MICRO_COLUMNS.map((k) => item.micros[k] ?? null)]);
    }
    await conn.query('INSERT INTO meal_plan_applications (plan_id, athlete_id, entry_date) VALUES (?, ?, ?)', [plan.id, athleteId, date]);
    return { added: items.length, alreadyApplied: false, date };
  });
}
