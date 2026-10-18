import { query, transaction } from '../../config/db.js';
import { notFound } from '../../utils/httpError.js';

/** Trae ejercicios y series de varias sesiones en 2 consultas (evita N+1). */
async function hydrate(workoutRows) {
  if (!workoutRows.length) return [];
  const ids = workoutRows.map((w) => w.id);
  const exercises = await query(
    `SELECT we.*, e.muscle_group, e.image_url FROM workout_exercises we
     LEFT JOIN exercises e ON e.id = we.exercise_id
     WHERE we.workout_id IN (?) ORDER BY we.workout_id, we.position`,
    [ids],
  );
  const sets = exercises.length
    ? await query('SELECT * FROM workout_sets WHERE workout_exercise_id IN (?) ORDER BY set_number', [
        exercises.map((e) => e.id),
      ])
    : [];

  const setsByExercise = new Map();
  for (const s of sets) {
    if (!setsByExercise.has(s.workout_exercise_id)) setsByExercise.set(s.workout_exercise_id, []);
    setsByExercise.get(s.workout_exercise_id).push({ setNumber: s.set_number, reps: s.reps, weight: s.weight, rpe: s.rpe });
  }
  const exercisesByWorkout = new Map();
  for (const e of exercises) {
    if (!exercisesByWorkout.has(e.workout_id)) exercisesByWorkout.set(e.workout_id, []);
    exercisesByWorkout.get(e.workout_id).push({
      id: e.id,
      exerciseId: e.exercise_id,
      name: e.exercise_name,
      muscleGroup: e.muscle_group,
      imageUrl: e.image_url,
      notes: e.notes,
      sets: setsByExercise.get(e.id) || [],
    });
  }
  return workoutRows.map((w) => ({
    id: w.id,
    userId: w.user_id,
    createdBy: w.created_by,
    createdByName: w.created_by_name,
    date: w.workout_date,
    title: w.title,
    notes: w.notes,
    exercises: exercisesByWorkout.get(w.id) || [],
  }));
}

const SELECT_WORKOUT = `SELECT w.*, cb.name AS created_by_name FROM workouts w
  LEFT JOIN users cb ON cb.id = w.created_by`;

export async function listWorkouts(userId, { from, to, limit }) {
  const where = ['w.user_id = ?'];
  const params = [userId];
  if (from) {
    where.push('w.workout_date >= ?');
    params.push(from);
  }
  if (to) {
    where.push('w.workout_date <= ?');
    params.push(to);
  }
  const rows = await query(
    `${SELECT_WORKOUT} WHERE ${where.join(' AND ')} ORDER BY w.workout_date DESC, w.id DESC LIMIT ?`,
    [...params, limit],
  );
  return hydrate(rows);
}

export async function getWorkoutRow(id) {
  const [row] = await query(`${SELECT_WORKOUT} WHERE w.id = ?`, [id]);
  if (!row) throw notFound('Entrenamiento no encontrado');
  return row;
}

export async function getWorkout(id) {
  const [workout] = await hydrate([await getWorkoutRow(id)]);
  return workout;
}

/** Inserta ejercicios y series de una sesión (dentro de una transacción). */
async function insertExercises(conn, workoutId, exercises) {
  const catalogIds = exercises.map((e) => e.exerciseId).filter(Boolean);
  const names = new Map();
  if (catalogIds.length) {
    const [rows] = await conn.query('SELECT id, name FROM exercises WHERE id IN (?)', [catalogIds]);
    for (const r of rows) names.set(r.id, r.name);
  }
  for (const [index, exercise] of exercises.entries()) {
    const exerciseId = exercise.exerciseId && names.has(exercise.exerciseId) ? exercise.exerciseId : null;
    const name = exercise.name || names.get(exercise.exerciseId) || 'Ejercicio';
    const [inserted] = await conn.query(
      'INSERT INTO workout_exercises (workout_id, exercise_id, exercise_name, position, notes) VALUES (?, ?, ?, ?, ?)',
      [workoutId, exerciseId, name, index + 1, exercise.notes ?? null],
    );
    const values = exercise.sets.map((s, i) => [inserted.insertId, i + 1, s.reps, s.weight, s.rpe ?? null]);
    await conn.query('INSERT INTO workout_sets (workout_exercise_id, set_number, reps, weight, rpe) VALUES ?', [values]);
  }
}

export async function createWorkout(ownerId, creatorId, data) {
  const id = await transaction(async (conn) => {
    const [result] = await conn.query(
      'INSERT INTO workouts (user_id, created_by, workout_date, title, notes) VALUES (?, ?, ?, ?, ?)',
      [ownerId, creatorId, data.date, data.title, data.notes ?? null],
    );
    await insertExercises(conn, result.insertId, data.exercises);
    return result.insertId;
  });
  return getWorkout(id);
}

/** Reemplaza la sesión completa (PUT): datos generales + ejercicios + series. */
export async function replaceWorkout(id, data) {
  await transaction(async (conn) => {
    await conn.query('UPDATE workouts SET workout_date = ?, title = ?, notes = ? WHERE id = ?', [
      data.date,
      data.title,
      data.notes ?? null,
      id,
    ]);
    await conn.query('DELETE FROM workout_exercises WHERE workout_id = ?', [id]); // las series caen en cascada
    await insertExercises(conn, id, data.exercises);
  });
  return getWorkout(id);
}

export async function deleteWorkout(id) {
  await query('DELETE FROM workouts WHERE id = ?', [id]);
}
