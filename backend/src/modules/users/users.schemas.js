import { z } from 'zod';
import { pagination } from '../../utils/validation.js';

const goals = z
  .object({
    kcal: z.coerce.number().int().min(800).max(10000),
    protein: z.coerce.number().int().min(0).max(1000),
    carbs: z.coerce.number().int().min(0).max(2000),
    fat: z.coerce.number().int().min(0).max(1000),
  })
  .partial();

export const roleEnum = z.enum(['admin', 'coach', 'athlete'], { message: 'Rol inválido' });

export const listUsersQuery = z.object({
  ...pagination,
  role: roleEnum.optional(),
  search: z.string().trim().max(100).optional(),
});

export const updateMeSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    avatarUrl: z.url('URL inválida').max(500).nullable(),
    goals,
  })
  .partial();

export const goalsSchema = z.object({ goals });

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email('Email inválido').trim().toLowerCase(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(72),
  role: roleEnum.default('athlete'),
  coachId: z.coerce.number().int().positive().nullable().optional(),
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.email('Email inválido').trim().toLowerCase(),
    role: roleEnum,
    coachId: z.coerce.number().int().positive().nullable(),
    isActive: z.boolean(),
    goals,
  })
  .partial();
