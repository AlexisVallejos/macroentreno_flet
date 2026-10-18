import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { idParam } from '../../utils/validation.js';
import * as schemas from './foods.schemas.js';
import * as service from './foods.service.js';

const router = Router();
router.use(authenticate);

router.get('/', validate({ query: schemas.listFoodsQuery }), async (req, res) => {
  res.json(await service.listFoods(req.user.id, req.valid.query));
});

router.get('/categories', async (_req, res) => {
  res.json({ data: await service.listCategories() });
});

router.get('/:id', validate({ params: idParam }), async (req, res) => {
  res.json({ data: service.toFood(await service.getFood(req.user, req.valid.params.id)) });
});

router.post('/', validate({ body: schemas.foodSchema }), async (req, res) => {
  res.status(201).json({ data: await service.createFood(req.user, req.valid.body) });
});

router.put('/:id', validate({ params: idParam, body: schemas.updateFoodSchema }), async (req, res) => {
  res.json({ data: await service.updateFood(req.user, req.valid.params.id, req.valid.body) });
});

router.delete('/:id', validate({ params: idParam }), async (req, res) => {
  await service.deleteFood(req.user, req.valid.params.id);
  res.status(204).end();
});

export default router;
