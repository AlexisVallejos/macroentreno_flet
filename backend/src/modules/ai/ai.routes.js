import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { authenticate } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import * as service from './ai.service.js';
import { aiStatus } from './openai.js';

const router = Router();
// Las fotos y audios llegan en base64: este módulo acepta cuerpos más grandes que el resto de la API.
router.use(express.json({ limit: '12mb' }));
router.use(authenticate);

// Antes del límite de uso: no llama a OpenAI, solo dice si hay clave (la app lo consulta al abrir el chat).
router.get('/status', (_req, res) => {
  res.json({ data: aiStatus() });
});

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

/** Largo máximo de un mensaje (la app usa el mismo tope en el campo de texto). */
const MAX_MESSAGE_CHARS = 4000;
/** Mensajes de historial que acepta el servidor; después se recortan por tamaño (ver trimHistory). */
const MAX_MESSAGES = 30;

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        text: z.string().trim().max(MAX_MESSAGE_CHARS, `El mensaje es demasiado largo (máximo ${MAX_MESSAGE_CHARS} caracteres)`).default(''),
        image: image.optional(),
      }),
    )
    .min(1, 'Escribí un mensaje')
    .max(MAX_MESSAGES, `La conversación es muy larga: mandá como máximo ${MAX_MESSAGES} mensajes`)
    .refine((m) => m.at(-1)?.role === 'user' && Boolean(m.at(-1).text || m.at(-1).image), {
      message: 'El último mensaje debe ser del usuario y tener texto o una foto',
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
