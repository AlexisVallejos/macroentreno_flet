import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { resolveTargetUser } from '../../utils/access.js';
import { badRequest } from '../../utils/httpError.js';
import { idParam } from '../../utils/validation.js';
import * as schemas from './users.schemas.js';
import * as service from './users.service.js';

const router = Router();
router.use(authenticate);

// --- Perfil propio (todos los roles) ---
router.get('/me', async (req, res) => {
  res.json({ data: await service.getUser(req.user.id) });
});

router.patch('/me', validate({ body: schemas.updateMeSchema }), async (req, res) => {
  res.json({ data: await service.updateUser(req.user.id, req.valid.body) });
});

// --- Listado: admin ve todos; coach ve solo sus atletas ---
router.get('/', authorize('admin', 'coach'), validate({ query: schemas.listUsersQuery }), async (req, res) => {
  const filters = { ...req.valid.query };
  if (req.user.role === 'coach') {
    filters.coachId = req.user.id;
    filters.role = 'athlete';
  }
  res.json(await service.listUsers(filters));
});

router.get('/:id', authorize('admin', 'coach'), validate({ params: idParam }), async (req, res) => {
  const id = await resolveTargetUser(req, req.valid.params.id, { coachCan: true });
  res.json({ data: await service.getUser(id) });
});

// El coach puede ajustar los objetivos de sus atletas.
router.put(
  '/:id/goals',
  authorize('admin', 'coach'),
  validate({ params: idParam, body: schemas.goalsSchema }),
  async (req, res) => {
    const id = await resolveTargetUser(req, req.valid.params.id, { coachCan: true });
    res.json({ data: await service.updateUser(id, { goals: req.valid.body.goals }) });
  },
);

// --- Gestión completa: solo admin ---
router.post('/', authorize('admin'), validate({ body: schemas.createUserSchema }), async (req, res) => {
  res.status(201).json({ data: await service.createUser(req.valid.body) });
});

router.put(
  '/:id',
  authorize('admin'),
  validate({ params: idParam, body: schemas.updateUserSchema }),
  async (req, res) => {
    const { id } = req.valid.params;
    const body = req.valid.body;
    if (id === req.user.id && ((body.role && body.role !== 'admin') || body.isActive === false)) {
      throw badRequest('No podés quitarte el rol de admin ni desactivar tu propia cuenta');
    }
    res.json({ data: await service.updateUser(id, body) });
  },
);

router.delete('/:id', authorize('admin'), validate({ params: idParam }), async (req, res) => {
  if (req.valid.params.id === req.user.id) throw badRequest('No podés eliminar tu propia cuenta');
  await service.deleteUser(req.valid.params.id);
  res.status(204).end();
});

export default router;
