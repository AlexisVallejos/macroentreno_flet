import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { resolveTargetUser } from '../../utils/access.js';
import { idParam } from '../../utils/validation.js';
import * as schemas from './workouts.schemas.js';
import * as service from './workouts.service.js';

const router = Router();
router.use(authenticate);

// El coach puede leer y cargar sesiones de sus atletas; el admin, de cualquiera.
router.get('/', validate({ query: schemas.listQuery }), async (req, res) => {
  const userId = await resolveTargetUser(req, req.valid.query.userId, { coachCan: true });
  res.json({ data: await service.listWorkouts(userId, req.valid.query) });
});

router.get('/:id', validate({ params: idParam }), async (req, res) => {
  const row = await service.getWorkoutRow(req.valid.params.id);
  await resolveTargetUser(req, row.user_id, { coachCan: true });
  res.json({ data: await service.getWorkout(row.id) });
});

router.post('/', validate({ body: schemas.workoutSchema }), async (req, res) => {
  const ownerId = await resolveTargetUser(req, req.valid.body.userId, { coachCan: true });
  res.status(201).json({ data: await service.createWorkout(ownerId, req.user.id, req.valid.body) });
});

router.put('/:id', validate({ params: idParam, body: schemas.workoutSchema }), async (req, res) => {
  const row = await service.getWorkoutRow(req.valid.params.id);
  await resolveTargetUser(req, row.user_id, { coachCan: true });
  res.json({ data: await service.replaceWorkout(row.id, req.valid.body) });
});

router.delete('/:id', validate({ params: idParam }), async (req, res) => {
  const row = await service.getWorkoutRow(req.valid.params.id);
  await resolveTargetUser(req, row.user_id, { coachCan: true });
  await service.deleteWorkout(row.id);
  res.status(204).end();
});

export default router;
