import { z } from 'zod';
import { isoDate } from '../../utils/validation.js';

const setSchema = z.object({
  reps: z.coerce.number().int().min(0).max(1000),
  weight: z.coerce.number().min(0).max(2000).default(0),
  rpe: z.coerce.number().int().min(1).max(10).nullable().optional(),
});

const exerciseSchema = z
  .object({
    exerciseId: z.coerce.number().int().positive().nullable().optional(),
    name: z.string().trim().min(2).max(120).optional(),
    notes: z.string().trim().max(500).nullable().optional(),
    sets: z.array(setSchema).min(1, 'Cada ejercicio necesita al menos una serie').max(30),
  })
  .refine((e) => e.exerciseId || e.name, { message: 'Indicá exerciseId o name', path: ['name'] });

export const workoutSchema = z.object({
  date: isoDate,
  title: z.string().trim().min(2, 'El título debe tener al menos 2 caracteres').max(120),
  notes: z.string().trim().max(1000).nullable().optional(),
  // Un coach puede cargar la sesión a uno de sus atletas.
  userId: z.coerce.number().int().positive().optional(),
  exercises: z.array(exerciseSchema).min(1, 'Agregá al menos un ejercicio').max(30),
});

export const listQuery = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  userId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
