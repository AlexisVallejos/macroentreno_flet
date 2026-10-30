import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { authenticate } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import * as service from './ai.service.js';

const router = Router();
// Las fotos y audios llegan en base64: este módulo acepta cuerpos más grandes que el resto de la API.
router.use(express.json({ limit: '12mb' }));
router.use(authenticate);

// Cada llamada cuesta dinero en OpenAI: tope por usuario.
router.use(
  rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: env.nodeEnv === 'test' ? 10_000 : 60,
    keyGenerator: (req) => String(req.user.id),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Usaste mucho el asistente: esperá unos minutos' } },
  }),
);

const MAX_IMAGE = 9 * 1024 * 1024; // ~6,5 MB de imagen en base64
const image = z
  .string()
  .max(MAX_IMAGE, 'La foto es demasiado grande')
  .regex(/^data:image\/(jpeg|jpg|png|webp|heic|heif);base64,/, 'La imagen debe ser JPG, PNG o WebP');

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        text: z.string().trim().max(4000).default(''),
        image: image.optional(),
      }),
    )
    .min(1)
    .max(30)
    .refine((m) => m.at(-1).role === 'user' && (m.at(-1).text || m.at(-1).image), {
      message: 'El último mensaje debe ser del usuario',
    }),
});

router.post('/chat', validate({ body: chatSchema }), async (req, res) => {
  res.json({ data: await service.chat(req.user, req.valid.body.messages) });
});

router.post('/food-photo', validate({ body: z.object({ image, note: z.string().trim().max(300).optional() }) }), async (req, res) => {
  res.json({ data: await service.analyzeFoodPhoto(req.valid.body.image, req.valid.body.note) });
});

const audioSchema = z.object({
  audio: z.string().min(10).max(MAX_IMAGE, 'El audio es demasiado largo'),
  mimeType: z.string().regex(/^audio\/[\w.+-]+(;.*)?$/, 'Formato de audio inválido'),
});

router.post('/transcribe', validate({ body: audioSchema }), async (req, res) => {
  res.json({ data: await service.transcribeAudio(req.valid.body.audio, req.valid.body.mimeType) });
});

router.post('/speech', validate({ body: z.object({ text: z.string().trim().min(1).max(1500) }) }), async (req, res) => {
  res.json({ data: await service.textToSpeech(req.valid.body.text) });
});

export default router;
