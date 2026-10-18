import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../config/db.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { notFound } from '../../utils/httpError.js';
import { idParam } from '../../utils/validation.js';

const router = Router();
router.use(authenticate);

const toExercise = (row) => ({
  id: row.id,
  name: row.name,
  muscleGroup: row.muscle_group,
  equipment: row.equipment,
  imageUrl: row.image_url,
});

const listQuery = z.object({
  muscleGroup: z.string().trim().max(40).optional(),
  search: z.string().trim().max(100).optional(),
});

const exerciseSchema = z.object({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(120),
  muscleGroup: z.string().trim().min(2, 'Indicá el grupo muscular').max(40),
  equipment: z.string().trim().max(60).nullable().optional(),
  imageUrl: z.url('URL inválida').max(500).nullable().optional(),
});

const COLUMNS = { name: 'name', muscleGroup: 'muscle_group', equipment: 'equipment', imageUrl: 'image_url' };

async function getExercise(id) {
  const [row] = await query('SELECT * FROM exercises WHERE id = ?', [id]);
  if (!row) throw notFound('Ejercicio no encontrado');
  return toExercise(row);
}

// Lectura: todos los roles.
router.get('/', validate({ query: listQuery }), async (req, res) => {
  const { muscleGroup, search } = req.valid.query;
  const where = [];
  const params = [];
  if (muscleGroup) {
    where.push('muscle_group = ?');
    params.push(muscleGroup);
  }
  if (search) {
    where.push('name LIKE ?');
    params.push(`%${search}%`);
  }
  const rows = await query(
    `SELECT * FROM exercises ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY muscle_group, name`,
    params,
  );
  res.json({ data: rows.map(toExercise) });
});

router.get('/muscle-groups', async (_req, res) => {
  const rows = await query('SELECT DISTINCT muscle_group FROM exercises ORDER BY muscle_group');
  res.json({ data: rows.map((r) => r.muscle_group) });
});

router.get('/:id', validate({ params: idParam }), async (req, res) => {
  res.json({ data: await getExercise(req.valid.params.id) });
});

// Escritura: el catálogo lo mantienen entrenadores y administradores.
router.post('/', authorize('coach', 'admin'), validate({ body: exerciseSchema }), async (req, res) => {
  const keys = Object.keys(COLUMNS).filter((k) => req.valid.body[k] !== undefined);
  const result = await query(
    `INSERT INTO exercises (${keys.map((k) => COLUMNS[k]).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
    keys.map((k) => req.valid.body[k]),
  );
  res.status(201).json({ data: await getExercise(result.insertId) });
});

router.put(
  '/:id',
  authorize('coach', 'admin'),
  validate({ params: idParam, body: exerciseSchema.partial() }),
  async (req, res) => {
    const { id } = req.valid.params;
    await getExercise(id);
    const keys = Object.keys(COLUMNS).filter((k) => req.valid.body[k] !== undefined);
    if (keys.length) {
      await query(`UPDATE exercises SET ${keys.map((k) => `${COLUMNS[k]} = ?`).join(', ')} WHERE id = ?`, [
        ...keys.map((k) => req.valid.body[k]),
        id,
      ]);
    }
    res.json({ data: await getExercise(id) });
  },
);

router.delete('/:id', authorize('coach', 'admin'), validate({ params: idParam }), async (req, res) => {
  const result = await query('DELETE FROM exercises WHERE id = ?', [req.valid.params.id]);
  if (!result.affectedRows) throw notFound('Ejercicio no encontrado');
  res.status(204).end();
});

export default router;
