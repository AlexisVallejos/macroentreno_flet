import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool, query } from './config/db.js';

const app = createApp();

// 0.0.0.0 para que el celular pueda llegar a la API por la red local.
const server = app.listen(env.port, '0.0.0.0', () => {
  console.log(`MacroEntreno API escuchando en http://localhost:${env.port}/api`);
});

// Limpieza diaria de refresh tokens vencidos (usa el índice idx_refresh_expires).
const purgeExpiredTokens = () =>
  query('DELETE FROM refresh_tokens WHERE expires_at < NOW() - INTERVAL 1 DAY').catch((err) =>
    console.error('[tokens] no se pudieron limpiar:', err.message),
  );
purgeExpiredTokens();
const purgeTimer = setInterval(purgeExpiredTokens, 24 * 60 * 60 * 1000);
purgeTimer.unref();

function shutdown() {
  clearInterval(purgeTimer);
  server.close(() => pool.end().then(() => process.exit(0)));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
