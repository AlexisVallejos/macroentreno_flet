import fs from 'node:fs/promises';

/** Migración aditiva: conserva usuarios, comidas y sesiones existentes. */
export async function migrateCoaching(conn) {
  await conn.query("SET time_zone = '-03:00'");
  const sql = await fs.readFile(new URL('../../database/migrations/001-coaching.sql', import.meta.url), 'utf8');
  for (const statement of sql.split(';').map((s) => s.trim()).filter(Boolean)) await conn.query(statement);
  const [columns] = await conn.query("SHOW COLUMNS FROM workouts LIKE 'status'");
  if (!columns.length) {
    await conn.query("ALTER TABLE workouts ADD COLUMN status ENUM('planned','completed') NOT NULL DEFAULT 'completed'");
    await conn.query("UPDATE workouts SET status = 'planned' WHERE created_by <> user_id");
  }
  // No inventamos fechas de altas de clientes anteriores a esta migración.
  await conn.query(`INSERT INTO coach_assignments (athlete_id, coach_id, is_baseline)
    SELECT u.id, u.coach_id, 1 FROM users u
    WHERE u.role = 'athlete' AND u.coach_id IS NOT NULL AND NOT EXISTS
      (SELECT 1 FROM coach_assignments a WHERE a.athlete_id = u.id AND a.ended_at IS NULL)`);
}
