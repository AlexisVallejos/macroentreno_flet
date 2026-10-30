/**
 * Función serverless de Vercel: sirve la misma API de Express que backend/src/server.js,
 * pero sin app.listen() ni tareas programadas (cada pedido levanta o reutiliza una instancia).
 * Vercel redirige /api/* a este archivo (ver vercel.json).
 */
import { createApp } from '../backend/src/app.js';
import { pool } from '../backend/src/config/db.js';
import { runMigrations } from '../backend/src/config/migrations.js';

const app = createApp();

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
    res.status(503).json({ error: { code: 'DATABASE_UNAVAILABLE', message: 'No se pudo conectar con la base de datos' } });
    return;
  }
  return app(req, res);
}
