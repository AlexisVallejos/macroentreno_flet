import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { resolveTargetUser } from '../../utils/access.js';
import { idParam } from '../../utils/validation.js';
import * as schemas from './diary.schemas.js';
import * as service from './diary.service.js';

const router = Router();
router.use(authenticate);

// Lectura: el propio usuario, su coach o un admin.
router.get('/', validate({ query: schemas.dayQuery }), async (req, res) => {
  const userId = await resolveTargetUser(req, req.valid.query.userId, { coachCan: true });
  res.json({ data: await service.getDay(userId, req.valid.query.date) });
});

// Escritura: solo sobre el diario propio (admin puede corregir cualquiera).
router.post('/', validate({ body: schemas.createEntrySchema }), async (req, res) => {
  res.status(201).json({ data: await service.createEntry(req.user, req.valid.body) });
});

router.put('/:id', validate({ params: idParam, body: schemas.updateEntrySchema }), async (req, res) => {
  res.json({ data: await service.updateEntry(req.user, req.valid.params.id, req.valid.body) });
});

router.delete('/:id', validate({ params: idParam }), async (req, res) => {
  await service.deleteEntry(req.user, req.valid.params.id);
  res.status(204).end();
});

export default router;
