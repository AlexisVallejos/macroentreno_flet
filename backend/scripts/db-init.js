/**
 * Crea la base de datos, aplica database/schema.sql y carga los datos iniciales.
 *   npm run db:init     -> borra y recrea todo
 *   npm run db:seed     -> solo vuelve a cargar los datos de ejemplo (tablas existentes)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { migrateCoaching } from '../src/config/migrations.js';
import { env } from '../src/config/env.js';
import { MICROS, MICRO_COLUMNS } from '../src/modules/nutrition/micros.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const readJson = async (file) => JSON.parse(await fs.readFile(path.join(root, 'database/seeds', file), 'utf8'));

export const DEMO_PASSWORD = 'Demo1234';

export async function initDatabase({ seedOnly = false, config = env.db } = {}) {
  const conn = await mysql.createConnection({ ...config, database: undefined, multipleStatements: true });
  try {
    await conn.query("SET time_zone = '-03:00'");
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await conn.changeUser({ database: config.database });
    if (!seedOnly) await conn.query(await fs.readFile(path.join(root, 'database/schema.sql'), 'utf8'));
    await migrateCoaching(conn);
    await seed(conn);
    await migrateCoaching(conn);
  } finally {
    await conn.end();
  }
}

async function seed(conn) {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of ['weekly_reports', 'meal_plan_applications', 'meal_plan_items', 'meal_plans', 'coach_assignments', 'workout_sets', 'workout_exercises', 'workouts', 'exercises', 'diary_entries', 'foods', 'subscriptions', 'refresh_tokens', 'social_accounts', 'users']) {
    await conn.query(`TRUNCATE TABLE ${table}`);
  }
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');

  // Usuarios de demostración, uno por rol (+ un segundo atleta sin entrenador).
  // Alexis tiene MacroEntreno Pro por 30 días (para ver micronutrientes); Martina está en el plan gratis.
  await conn.query(
    `INSERT INTO users (id, name, email, password_hash, role, coach_id, kcal_goal, protein_goal, carbs_goal, fat_goal) VALUES
     (1, 'Admin MacroEntreno', 'admin@macroentreno.com', ?, 'admin', NULL, 2200, 150, 250, 70),
     (2, 'Coach Laura', 'coach@macroentreno.com', ?, 'coach', NULL, 2000, 140, 220, 65),
     (3, 'Alexis Atleta', 'atleta@macroentreno.com', ?, 'athlete', 2, 1800, 140, 180, 60),
     (4, 'Martina Atleta', 'martina@macroentreno.com', ?, 'athlete', NULL, 2100, 130, 240, 70)`,
    [hash, hash, hash, hash],
  );

  await conn.query('UPDATE users SET pro_until = NOW() + INTERVAL 30 DAY WHERE id = 3');

  // Los micronutrientes del seed (por porción) vienen de FatSecret: ver "microsFrom" en foods.json.
  const foods = await readJson('foods.json');
  const microValues = (f) => MICROS.map((m) => f.micros?.[m.key] ?? null);
  await conn.query(
    `INSERT INTO foods (owner_id, name, category, brand, portion_grams, portion_description, kcal, protein, carbs, fat, ${MICRO_COLUMNS.join(', ')}) VALUES ?`,
    [foods.map((f) => [null, f.name, f.category, f.brand, f.portionGrams, f.portionDescription, f.kcal, f.protein, f.carbs, f.fat, ...microValues(f)])],
  );
  await conn.query(
    `INSERT INTO foods (owner_id, name, category, portion_grams, portion_description, kcal, protein, carbs, fat)
     VALUES (3, 'Licuado post entreno', 'Personal', 350, '1 vaso grande', 320, 30, 38, 5)`,
  );

  const exercises = await readJson('exercises.json');
  await conn.query('INSERT INTO exercises (name, muscle_group, image_url) VALUES ?', [
    exercises.map((e) => [e.name, e.muscleGroup, e.imageUrl]),
  ]);

  // Un poco de historia para que el atleta demo tenga progreso que mostrar.
  const day = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  // Micronutrientes de un alimento del seed escalados a los gramos del registro.
  const microsFor = (name, grams) => {
    const food = foods.find((f) => f.name === name);
    return MICROS.map((m) => {
      const value = food?.micros?.[m.key];
      return value === null || value === undefined ? null : Math.round(((value * grams) / food.portionGrams) * 100) / 100;
    });
  };
  const diary = [];
  for (let offset = -6; offset <= 0; offset += 1) {
    const rice = 150 + offset * 10;
    diary.push(
      [3, day(offset), 'desayuno', 'Avena en hojuelas', 60, 233.4, 10.1, 39.8, 4.1, ...microsFor('Avena en hojuelas', 60)],
      [3, day(offset), 'almuerzo', 'Pollo pechuga cocida', 200, 330, 62, 0, 7.2, ...microsFor('Pollo pechuga cocida', 200)],
      [3, day(offset), 'cena', 'Arroz integral cocido', rice, 184.5, 4.1, 38.4, 1.5, ...microsFor('Arroz integral cocido', rice)],
    );
  }
  await conn.query(
    `INSERT INTO diary_entries (user_id, entry_date, meal, name, grams, kcal, protein, carbs, fat, ${MICRO_COLUMNS.join(', ')}) VALUES ?`,
    [diary],
  );

  const [[bench]] = await conn.query("SELECT id, name FROM exercises WHERE name LIKE 'Press de banca%' LIMIT 1");
  const [[squat]] = await conn.query("SELECT id, name FROM exercises WHERE name LIKE 'Sentadilla%' LIMIT 1");
  const sessions = [
    { date: day(-7), title: 'Pecho y piernas', by: 3, bench: 60, squat: 80 },
    { date: day(-3), title: 'Pecho y piernas', by: 3, bench: 62.5, squat: 85 },
    { date: day(1), title: 'Rutina asignada por Coach Laura', by: 2, bench: 65, squat: 87.5 },
  ];
  for (const s of sessions) {
    const [w] = await conn.query(
      'INSERT INTO workouts (user_id, created_by, workout_date, title) VALUES (3, ?, ?, ?)',
      [s.by, s.date, s.title],
    );
    for (const [position, ex, weight] of [[1, bench, s.bench], [2, squat, s.squat]]) {
      const [we] = await conn.query(
        'INSERT INTO workout_exercises (workout_id, exercise_id, exercise_name, position) VALUES (?, ?, ?, ?)',
        [w.insertId, ex.id, ex.name, position],
      );
      await conn.query('INSERT INTO workout_sets (workout_exercise_id, set_number, reps, weight, rpe) VALUES ?', [
        [1, 2, 3].map((n) => [we.insertId, n, 10 - n, weight, 7 + (n === 3 ? 1 : 0)]),
      ]);
    }
  }
  await conn.query("UPDATE workouts SET status = 'planned' WHERE created_by <> user_id");
}

// Ejecución directa por CLI.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const seedOnly = process.argv.includes('--seed-only');
  initDatabase({ seedOnly })
    .then(() => {
      console.log(`Base "${env.db.database}" lista. Usuarios demo (contraseña ${DEMO_PASSWORD}):`);
      console.log('  admin@macroentreno.com · coach@macroentreno.com · atleta@macroentreno.com · martina@macroentreno.com');
    })
    .catch((err) => {
      console.error('No se pudo inicializar la base:', err.message);
      process.exit(1);
    });
}
