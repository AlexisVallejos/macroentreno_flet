import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../config/db.js';
import { authenticate } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { resolveTargetUser } from '../../utils/access.js';
import { addDays, dateRange, today } from '../../utils/dates.js';
import { isoDate } from '../../utils/validation.js';
import { MICRO_COLUMNS, summarizeMicros } from '../nutrition/micros.js';

const router = Router();
router.use(authenticate);

const progressQuery = z.object({
  to: isoDate.optional(), // la app manda su fecha local para evitar desfasajes de zona horaria
  days: z.coerce.number().int().min(1).max(90).default(7),
  exerciseDays: z.coerce.number().int().min(7).max(180).default(30),
  userId: z.coerce.number().int().positive().optional(),
});

const round = (n) => Math.round(Number(n) * 10) / 10;

/** Agrupa las series por sesión y compara las dos últimas sesiones de cada ejercicio. */
function exerciseProgress(rows) {
  const byExercise = new Map();
  for (const r of rows) {
    const key = r.exercise_id ? `id:${r.exercise_id}` : `name:${r.exercise_name.toLowerCase()}`;
    if (!byExercise.has(key)) byExercise.set(key, { name: r.exercise_name, exerciseId: r.exercise_id, sessions: new Map() });
    const sessions = byExercise.get(key).sessions;
    if (!sessions.has(r.wex_id)) sessions.set(r.wex_id, { date: r.workout_date, sets: [] });
    sessions.get(r.wex_id).sets.push(r);
  }

  const summarize = (session) => {
    const reps = session.sets.reduce((acc, s) => acc + s.reps, 0);
    return {
      date: session.date,
      sets: session.sets.length,
      reps,
      volume: round(session.sets.reduce((acc, s) => acc + s.reps * s.weight, 0)),
      bestWeight: Math.max(0, ...session.sets.map((s) => s.weight)),
    };
  };

  const result = [];
  for (const { name, exerciseId, sessions } of byExercise.values()) {
    const ordered = [...sessions.values()].sort((a, b) => a.date.localeCompare(b.date));
    const latest = summarize(ordered.at(-1));
    const previous = ordered.length > 1 ? summarize(ordered.at(-2)) : null;
    result.push({
      exerciseId,
      name,
      sessions: ordered.length,
      latest,
      previous,
      delta: previous
        ? { volume: round(latest.volume - previous.volume), bestWeight: round(latest.bestWeight - previous.bestWeight) }
        : null,
    });
  }
  return result.sort((a, b) => b.latest.date.localeCompare(a.latest.date));
}

router.get('/', validate({ query: progressQuery }), async (req, res) => {
  const { days, exerciseDays } = req.valid.query;
  const userId = await resolveTargetUser(req, req.valid.query.userId, { coachCan: true });
  const to = req.valid.query.to || today();
  const from = addDays(to, -(days - 1));

  // Todas estas consultas filtran por (user_id, fecha) y usan los índices compuestos.
  const [nutritionRows, workoutRows, [goals], setRows] = await Promise.all([
    query(
      `SELECT entry_date, SUM(kcal) AS kcal, SUM(protein) AS protein, SUM(carbs) AS carbs, SUM(fat) AS fat
       FROM diary_entries WHERE user_id = ? AND entry_date BETWEEN ? AND ? GROUP BY entry_date`,
      [userId, from, to],
    ),
    query(
      `SELECT workout_date, COUNT(*) AS workouts FROM workouts
       WHERE user_id = ? AND workout_date BETWEEN ? AND ? GROUP BY workout_date`,
      [userId, from, to],
    ),
    query(
      'SELECT kcal_goal AS kcal, protein_goal AS protein, carbs_goal AS carbs, fat_goal AS fat FROM users WHERE id = ?',
      [userId],
    ),
    query(
      `SELECT w.workout_date, we.id AS wex_id, we.exercise_id, we.exercise_name, ws.reps, ws.weight
       FROM workouts w
       JOIN workout_exercises we ON we.workout_id = w.id
       JOIN workout_sets ws ON ws.workout_exercise_id = we.id
       WHERE w.user_id = ? AND w.workout_date BETWEEN ? AND ?`,
      [userId, addDays(to, -(exerciseDays - 1)), to],
    ),
  ]);

  const nutritionByDate = new Map(nutritionRows.map((r) => [r.entry_date, r]));
  const workoutsByDate = new Map(workoutRows.map((r) => [r.workout_date, Number(r.workouts)]));

  const daily = dateRange(from, to).map((date) => {
    const n = nutritionByDate.get(date);
    return {
      date,
      kcal: round(n?.kcal ?? 0),
      protein: round(n?.protein ?? 0),
      carbs: round(n?.carbs ?? 0),
      fat: round(n?.fat ?? 0),
      workouts: workoutsByDate.get(date) ?? 0,
    };
  });

  const loggedDays = daily.filter((d) => d.kcal > 0);
  const avg = (key) => (loggedDays.length ? round(loggedDays.reduce((a, d) => a + d[key], 0) / loggedDays.length) : 0);
  // Día "en objetivo": calorías dentro de ±10 % de la meta.
  const onTarget = loggedDays.filter((d) => Math.abs(d.kcal - goals.kcal) <= goals.kcal * 0.1).length;

  res.json({
    data: {
      from,
      to,
      goals,
      daily,
      summary: {
        loggedDays: loggedDays.length,
        daysOnTarget: onTarget,
        avgKcal: avg('kcal'),
        avgProtein: avg('protein'),
        avgCarbs: avg('carbs'),
        avgFat: avg('fat'),
        totalWorkouts: daily.reduce((a, d) => a + d.workouts, 0),
      },
      exercises: exerciseProgress(setRows),
      micros: req.user.pro ? await microsAverage(userId, from, to) : null,
    },
  });
});

/** MacroEntreno Pro: promedio diario de cada micronutriente en los días con registros del período. */
async function microsAverage(userId, from, to) {
  const rows = await query(
    `SELECT entry_date, ${MICRO_COLUMNS.join(', ')} FROM diary_entries WHERE user_id = ? AND entry_date BETWEEN ? AND ?`,
    [userId, from, to],
  );
  const days = new Set(rows.map((r) => r.entry_date)).size;
  return { days, nutrients: summarizeMicros(rows, { days: Math.max(days, 1) }) };
}

export default router;
