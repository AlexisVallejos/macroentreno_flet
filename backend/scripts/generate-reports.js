/** Comando opcional para cron/planificadores cuando la API no corre continuamente. */
import { pool } from '../src/config/db.js';
import { migrateCoaching } from '../src/config/migrations.js';
import { generateDueWeeklyReports } from '../src/modules/reports/reports.service.js';
try {
  const conn = await pool.getConnection();
  try { await migrateCoaching(conn); } finally { conn.release(); }
  await generateDueWeeklyReports();
  console.log('Informes semanales actualizados.');
} catch (err) {
  console.error('No se pudieron generar los informes:', err.message);
  process.exitCode = 1;
} finally { await pool.end(); }
