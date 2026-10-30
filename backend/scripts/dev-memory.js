/**
 * Levanta la API con un MySQL 8 temporal (descargado por mysql-memory-server).
 * Sirve para probar sin instalar MySQL: los datos se pierden al cerrar.
 *   npm run dev:memory
 */
import { createDB } from 'mysql-memory-server';

const db = await createDB({ version: '8.4.x' });
Object.assign(process.env, {
  DB_HOST: '127.0.0.1',
  DB_PORT: String(db.port),
  DB_USER: db.username,
  DB_PASSWORD: '',
  DB_NAME: 'macroentreno',
});

const { initDatabase, DEMO_PASSWORD } = await import('./db-init.js');
const { env } = await import('../src/config/env.js');
await initDatabase({ config: env.db });
console.log(`MySQL temporal en el puerto ${db.port}. Usuarios demo con contraseña ${DEMO_PASSWORD}.`);
await import('../src/server.js');

const stop = async () => {
  await db.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
