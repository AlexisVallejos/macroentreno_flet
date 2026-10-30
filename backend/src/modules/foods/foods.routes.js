import { Router } from 'express';
import { authenticate, requirePro } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { idParam } from '../../utils/validation.js';
import { searchFoods } from './fatsecret.js';
import * as schemas from './foods.schemas.js';
import * as service from './foods.service.js';

const router = Router();
router.use(authenticate);

router.get('/', validate({ query: schemas.listFoodsQuery }), async (req, res) => {
  res.json(await service.listFoods(req.user, req.valid.query));
});

router.get('/categories', async (_req, res) => {
  res.json({ data: await service.listCategories() });
});

// Base de FatSecret (MacroEntreno Pro): buscar e importar alimentos con micronutrientes.
router.get('/fatsecret/search', requirePro, validate({ query: schemas.fatSecretSearchQuery }), async (req, res) => {
  const { search, page, limit } = req.valid.query;
  res.json({ data: await searchFoods(search, { page, limit }) });
});

router.post('/fatsecret/import', requirePro, validate({ body: schemas.fatSecretImportSchema }), async (req, res) => {
  res.status(201).json({ data: await service.importFatSecretFood(req.user, req.valid.body.externalId) });
});

// Bases gratuitas (todos los usuarios): Open Food Facts (productos envasados) y USDA (genéricos).
router.get('/external/search', validate({ query: schemas.externalSearchQuery }), async (req, res) => {
  const { source, search, limit } = req.valid.query;
  res.json({ data: await service.searchExternal(source, search, { limit }) });
});

router.post('/external/import', validate({ body: schemas.externalImportSchema }), async (req, res) => {
  const { source, externalId } = req.valid.body;
  res.status(201).json({ data: await service.importExternal(req.user, source, externalId) });
});

// Escáner de código de barras de la app.
router.get('/barcode/:code', validate({ params: schemas.barcodeParam }), async (req, res) => {
  res.json({ data: await service.findByBarcode(req.user, req.valid.params.code) });
});

router.get('/:id', validate({ params: idParam }), async (req, res) => {
  res.json({ data: service.toFood(await service.getFood(req.user, req.valid.params.id), { micros: req.user.pro }) });
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
