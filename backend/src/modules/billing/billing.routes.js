import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { unauthorized } from '../../utils/httpError.js';
import * as service from './billing.service.js';
import { verifyWebhookSignature } from './mercadopago.js';

const router = Router();

/**
 * Notificaciones de Mercado Pago (configurar en el panel: <PUBLIC_API_URL>/api/billing/webhook,
 * eventos "Planes y suscripciones"). Sin login: se valida la firma si hay clave secreta y,
 * de todos modos, el estado se vuelve a consultar en Mercado Pago antes de aplicarlo.
 */
router.post('/webhook', async (req, res) => {
  const type = req.body?.type || req.query.type || req.query.topic;
  const dataId = req.query['data.id'] || req.body?.data?.id || req.query.id;
  if (env.billing.mpWebhookSecret) {
    const valid = verifyWebhookSignature({
      signature: req.get('x-signature'),
      requestId: req.get('x-request-id'),
      dataId: req.query['data.id'] ?? req.body?.data?.id,
      secret: env.billing.mpWebhookSecret,
    });
    if (!valid) throw unauthorized('Firma de Mercado Pago inválida', 'INVALID_SIGNATURE');
  }
  if (!type || !dataId) return res.json({ data: { received: true, ignored: true } });
  await service.handleWebhook(type, String(dataId));
  res.json({ data: { received: true } });
});

router.use(authenticate);

router.get('/plan', async (req, res) => {
  res.json({ data: await service.getPlan(req.user.id) });
});

router.post('/subscribe', async (req, res) => {
  res.status(201).json({ data: await service.subscribe(req.user.id) });
});

// La app lo llama al volver de Mercado Pago: no espera al webhook (que en desarrollo no llega a localhost).
router.post('/sync', async (req, res) => {
  res.json({ data: await service.sync(req.user.id) });
});

router.post('/cancel', async (req, res) => {
  res.json({ data: await service.cancel(req.user.id) });
});

const grantSchema = z.object({
  userId: z.coerce.number().int().positive(),
  days: z.coerce.number().int().min(0).max(365),
});

router.post('/grant', authorize('admin'), validate({ body: grantSchema }), async (req, res) => {
  res.json({ data: await service.grant(req.valid.body.userId, req.valid.body.days) });
});

export default router;
