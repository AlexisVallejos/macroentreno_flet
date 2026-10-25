import mysql from 'mysql2/promise';
import { env } from './env.js';

/** Pool de conexiones compartido por toda la API. */
export const pool = mysql.createPool({
  ...env.db,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true, // DATE -> 'YYYY-MM-DD' sin conversiones de zona horaria
  decimalNumbers: true, // DECIMAL -> number
  charset: 'utf8mb4',
});

// MySQL usa el mismo día de negocio que los informes automáticos.
pool.on('connection', (connection) => { connection.query("SET time_zone = '-03:00'"); });

/** Ejecuta una consulta parametrizada y devuelve las filas. */
export async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

/** Ejecuta `work(conn)` dentro de una transacción. */
export async function transaction(work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
