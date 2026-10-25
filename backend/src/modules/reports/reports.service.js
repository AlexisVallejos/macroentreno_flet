import { query } from '../../config/db.js';
import { addDays, dateRange } from '../../utils/dates.js';
import { notFound } from '../../utils/httpError.js';
import { argentinaToday, mondayOf, monthPeriod } from './periods.js';
import { weeklyPdf } from './reports.pdf.js';

const round = (n) => Math.round(Number(n || 0) * 10) / 10;
const json = (value) => typeof value === 'string' ? JSON.parse(value) : value;

export async function weeklySnapshot(userId, week = mondayOf(argentinaToday())) {
  const to = addDays(week, 6);
  const previousFrom = addDays(week, -7);
  const [athlete] = await query(`SELECT u.id, u.name, u.email, c.name AS coachName,
    u.kcal_goal AS kcal, u.protein_goal AS protein, u.carbs_goal AS carbs, u.fat_goal AS fat
    FROM users u LEFT JOIN users c ON c.id = u.coach_id WHERE u.id = ? AND u.role = 'athlete'`, [userId]);
  if (!athlete) throw notFound('Atleta no encontrado');
  const cutoff = argentinaToday();
  const [nutrition, workouts, exerciseRows] = await Promise.all([
    query(`SELECT entry_date AS date, COUNT(*) AS meals, SUM(kcal) AS kcal, SUM(protein) AS protein,
      SUM(carbs) AS carbs, SUM(fat) AS fat FROM diary_entries
      WHERE user_id = ? AND entry_date BETWEEN ? AND LEAST(?, ?) GROUP BY entry_date`, [userId, previousFrom, to, cutoff]),
    query(`SELECT w.workout_date AS date, w.status, COUNT(DISTINCT w.id) AS sessions,
      COUNT(ws.id) AS sets, COALESCE(SUM(ws.reps * ws.weight), 0) AS volume
      FROM workouts w LEFT JOIN workout_exercises we ON we.workout_id = w.id
      LEFT JOIN workout_sets ws ON ws.workout_exercise_id = we.id
      WHERE w.user_id = ? AND w.workout_date BETWEEN ? AND LEAST(?, ?)
      GROUP BY w.workout_date, w.status`, [userId, previousFrom, to, cutoff]),
    query(`SELECT we.exercise_name AS name, we.exercise_id AS exerciseId,
      CASE WHEN w.workout_date >= ? THEN 'current' ELSE 'previous' END AS period,
      MAX(ws.weight) AS bestWeight, SUM(ws.reps * ws.weight) AS volume, COUNT(DISTINCT w.id) AS sessions
      FROM workouts w JOIN workout_exercises we ON we.workout_id = w.id
      JOIN workout_sets ws ON ws.workout_exercise_id = we.id
      WHERE w.user_id = ? AND w.status = 'completed' AND w.workout_date BETWEEN ? AND LEAST(?, ?)
      GROUP BY we.exercise_id, we.exercise_name, period`, [week, userId, previousFrom, to, cutoff]),
  ]);
  const build = (from) => {
    const daily = dateRange(from, addDays(from, 6)).map((date) => {
      const n = nutrition.find((r) => r.date === date);
      const done = workouts.find((r) => r.date === date && r.status === 'completed');
      const planned = workouts.find((r) => r.date === date && r.status === 'planned');
      return { date, meals: Number(n?.meals || 0), kcal: round(n?.kcal), protein: round(n?.protein),
        carbs: round(n?.carbs), fat: round(n?.fat), sessions: Number(done?.sessions || 0),
        planned: Number(planned?.sessions || 0), sets: Number(done?.sets || 0), volume: round(done?.volume) };
    });
    const logged = daily.filter((d) => d.meals > 0);
    const avg = (key) => logged.length ? round(logged.reduce((sum, d) => sum + d[key], 0) / logged.length) : null;
    return { from, to: addDays(from, 6), daily, summary: {
      loggedDays: logged.length, daysOnTarget: logged.filter((d) => Math.abs(d.kcal - athlete.kcal) <= athlete.kcal * .1).length,
      avgKcal: avg('kcal'), avgProtein: avg('protein'), avgCarbs: avg('carbs'), avgFat: avg('fat'),
      sessions: daily.reduce((n, d) => n + d.sessions, 0), volume: round(daily.reduce((n, d) => n + d.volume, 0)),
      sets: daily.reduce((n, d) => n + d.sets, 0), planned: daily.reduce((n, d) => n + d.planned, 0),
    } };
  };
  const current = build(week);
  const previous = build(previousFrom);
  const exercises = exerciseRows.filter((e) => e.period === 'current').map((e) => {
    const prev = exerciseRows.find((p) => p.period === 'previous' && (e.exerciseId ? p.exerciseId === e.exerciseId : p.name === e.name));
    return { name: e.name, bestWeight: round(e.bestWeight), volume: round(e.volume), sessions: Number(e.sessions),
      previousWeight: prev ? round(prev.bestWeight) : null, deltaWeight: prev ? round(e.bestWeight - prev.bestWeight) : null };
  });
  const comparable = exercises.filter((e) => e.deltaWeight !== null);
  const improved = comparable.filter((e) => e.deltaWeight > 0).length;
  return { athlete: { id: athlete.id, name: athlete.name, email: athlete.email, coachName: athlete.coachName },
    goals: { kcal: athlete.kcal, protein: athlete.protein, carbs: athlete.carbs, fat: athlete.fat },
    ...current, previous: { from: previous.from, to: previous.to, summary: previous.summary }, exercises,
    comparison: { sessions: current.summary.sessions - previous.summary.sessions,
      volume: round(current.summary.volume - previous.summary.volume), improvedExercises: improved, comparableExercises: comparable.length },
    assessment: comparable.length
      ? `${improved} de ${comparable.length} ejercicios comparables aumentaron su carga máxima registrada.`
      : 'No hay ejercicios repetidos en ambas semanas para comparar cargas.',
    partial: to >= cutoff, generatedAt: new Date().toISOString(),
    methodology: 'Promedios nutricionales solo sobre días con comidas registradas. Objetivo calórico: margen de +/-10%. Se comparan cargas máximas por ejercicio y semanas completas; más volumen no demuestra por sí solo progreso físico. Las rutinas pendientes no cuentan como realizadas. No se infiere consumo en días sin registros.',
  };
}

export async function ensureWeeklyReport(userId, week) {
  if (addDays(week, 6) >= argentinaToday()) return null;
  const [existing] = await query('SELECT id FROM weekly_reports WHERE athlete_id = ? AND week_start = ?', [userId, week]);
  if (existing) return existing.id;
  const snapshot = await weeklySnapshot(userId, week);
  const pdf = await weeklyPdf(snapshot);
  await query('INSERT IGNORE INTO weekly_reports (athlete_id, week_start, snapshot, pdf) VALUES (?, ?, ?, ?)',
    [userId, week, JSON.stringify(snapshot), pdf]);
  const [row] = await query('SELECT id FROM weekly_reports WHERE athlete_id = ? AND week_start = ?', [userId, week]);
  return row.id;
}

export async function listWeeklyReports(userId) {
  return query('SELECT id, week_start AS weekStart, generated_at AS generatedAt FROM weekly_reports WHERE athlete_id = ? ORDER BY week_start DESC LIMIT 104', [userId]);
}
export async function getWeeklyReport(id) {
  const [row] = await query('SELECT * FROM weekly_reports WHERE id = ?', [id]);
  if (!row) throw notFound('Informe no encontrado');
  return { ...row, snapshot: json(row.snapshot) };
}

/** Solo una ejecución por proceso; la clave única evita duplicar informes entre instancias. */
let running = false;
export async function generateDueWeeklyReports() {
  if (running) return;
  running = true;
  try {
    const latest = addDays(mondayOf(argentinaToday()), -7);
    const athletes = await query(`SELECT u.id, LEAST(DATE(u.created_at),
      COALESCE((SELECT MIN(entry_date) FROM diary_entries WHERE user_id = u.id), DATE(u.created_at)),
      COALESCE((SELECT MIN(workout_date) FROM workouts WHERE user_id = u.id), DATE(u.created_at))) AS firstDate
      FROM users u WHERE u.role = 'athlete' AND u.is_active = 1`);
    for (const athlete of athletes) {
      const first = mondayOf(athlete.firstDate);
      const existing = new Set((await query('SELECT week_start FROM weekly_reports WHERE athlete_id = ?', [athlete.id])).map((r) => r.week_start));
      for (let week = first; week <= latest; week = addDays(week, 7)) {
        if (existing.has(week)) continue;
        try { await ensureWeeklyReport(athlete.id, week); }
        catch (err) { console.error(`[reportes] atleta ${athlete.id}, semana ${week}:`, err.message); }
      }
    }
  } finally { running = false; }
}

export async function monthlyCoaches(month) {
  const period = monthPeriod(month);
  const coaches = await query(`SELECT id, name, email, is_active AS isActive FROM users WHERE role = 'coach' ORDER BY name`);
  const rows = [];
  for (const coach of coaches) {
    const [[assignments], [activity], [work], [plans]] = await Promise.all([
      query(`SELECT COUNT(DISTINCT athlete_id) AS clientsServed,
        COUNT(DISTINCT CASE WHEN started_at >= ? AND is_baseline = 0 THEN athlete_id END) AS newClients,
        COUNT(DISTINCT CASE WHEN ended_at IS NULL OR ended_at >= ? THEN athlete_id END) AS clientsAtEnd,
        COUNT(DISTINCT CASE WHEN is_baseline = 1 THEN athlete_id END) AS baselineClients
        FROM coach_assignments WHERE coach_id = ? AND started_at < ? AND (ended_at IS NULL OR ended_at >= ?)`,
        [period.from, period.next, coach.id, period.next, period.from]),
      query(`SELECT COUNT(*) AS meals, COUNT(DISTINCT d.user_id) AS activeClients,
        COUNT(DISTINCT d.user_id, d.entry_date) AS loggedDays
        FROM diary_entries d WHERE d.entry_date BETWEEN ? AND LEAST(?, ?) AND EXISTS (
          SELECT 1 FROM coach_assignments a WHERE a.athlete_id = d.user_id AND a.coach_id = ?
          AND d.entry_date >= DATE(a.started_at) AND (a.ended_at IS NULL OR d.entry_date < DATE(a.ended_at)))`,
        [period.from, period.to, argentinaToday(), coach.id]),
      query(`SELECT COUNT(*) AS workouts, COUNT(DISTINCT w.user_id) AS trainingClients FROM workouts w
        WHERE w.status = 'completed' AND w.workout_date BETWEEN ? AND LEAST(?, ?) AND EXISTS (
          SELECT 1 FROM coach_assignments a WHERE a.athlete_id = w.user_id AND a.coach_id = ?
          AND w.workout_date >= DATE(a.started_at) AND (a.ended_at IS NULL OR w.workout_date < DATE(a.ended_at)))`,
        [period.from, period.to, argentinaToday(), coach.id]),
      query(`SELECT (SELECT COUNT(*) FROM meal_plans WHERE coach_id = ? AND created_at >= ? AND created_at < ?) AS plans,
        (SELECT COUNT(*) FROM workouts WHERE created_by = ? AND user_id <> created_by AND created_at >= ? AND created_at < ?) AS routines`,
        [coach.id, period.from, period.next, coach.id, period.from, period.next]),
    ]);
    const metrics = Object.fromEntries(Object.entries({ ...assignments, ...activity, ...work, ...plans }).map(([k, v]) => [k, Number(v || 0)]));
    rows.push({ ...coach, isActive: Boolean(coach.isActive), ...metrics });
  }
  return { ...period, partial: period.to >= argentinaToday(), coaches: rows,
    methodology: 'Clientes nuevos: atletas asignados durante el mes, contados una vez por entrenador. Clientes atendidos: asignaciones vigentes en algún momento del mes. Actividad atribuida por fecha del diario o entrenamiento y período de asignación; un cambio de entrenador se atribuye al nuevo desde ese día. La base histórica se empieza a registrar al instalar esta actualización; las asignaciones previas no se cuentan como clientes nuevos. Clientes al cierre en meses abiertos significa clientes actuales. Estas métricas describen actividad, no ingresos ni resultados clínicos.' };
}
