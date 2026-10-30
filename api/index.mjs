/**
 * Función serverless de Vercel: sirve la misma API de Express que backend/src/server.js,
 * pero sin app.listen() (cada pedido levanta o reutiliza una instancia).
 * Vercel redirige /api/* a este archivo (ver vercel.json). Las tareas que server.js corre con
 * setInterval acá las dispara el cron diario de Vercel en /api/cron/diario.
 */
import { createApp } from '../backend/src/app.js';
import { pool, query } from '../backend/src/config/db.js';
import { runMigrations } from '../backend/src/config/migrations.js';
import { generateDueWeeklyReports } from '../backend/src/modules/reports/reports.service.js';

const app = createApp();

/** Respuesta JSON sin depender de los helpers de Vercel (así también corre en Node puro). */
function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

// Las migraciones son aditivas y se corren una vez por instancia, en el primer pedido.
let ready;
function prepare() {
  ready ??= pool
    .getConnection()
    .then(async (conn) => {
      try {
        await runMigrations(conn);
      } finally {
        conn.release();
      }
    })
    .catch((err) => {
      ready = undefined; // el próximo pedido vuelve a intentar
      throw err;
    });
  return ready;
}

export default async function handler(req, res) {
  try {
    await prepare();
  } catch (err) {
    console.error('[db] no se pudo preparar la base:', err.message);
    send(res, 503, { error: { code: 'DATABASE_UNAVAILABLE', message: 'No se pudo conectar con la base de datos' } });
    return;
  }
  if (req.url.startsWith('/api/cron/diario')) return dailyTasks(req, res);
  return app(req, res);
}

/** Informes semanales pendientes y limpieza de refresh tokens vencidos. Solo lo llama el cron de Vercel. */
async function dailyTasks(req, res) {
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    send(res, 401, { error: { code: 'UNAUTHORIZED', message: 'Solo el cron de Vercel puede ejecutar esta tarea' } });
    return;
  }
  try {
    await generateDueWeeklyReports();
    const purged = await query('DELETE FROM refresh_tokens WHERE expires_at < NOW() - INTERVAL 1 DAY');
    send(res, 200, { data: { reports: 'ok', purgedTokens: purged.affectedRows } });
  } catch (err) {
    console.error('[cron]', err.message);
    send(res, 500, { error: { code: 'CRON_FAILED', message: 'No se pudieron completar las tareas diarias' } });
  }
}
