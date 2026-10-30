import { z } from 'zod';
import { emailField, nameField, pagination, passwordField } from '../../utils/validation.js';

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
    name: nameField,
    avatarUrl: z.url('URL inválida').max(500).nullable(),
    goals,
  })
  .partial();

export const goalsSchema = z.object({ goals });

export const createUserSchema = z.object({
  // Mismas reglas que el registro público: un admin tampoco puede crear cuentas con datos inválidos.
  name: nameField,
  email: emailField,
  password: passwordField,
  role: roleEnum.default('athlete'),
  coachId: z.coerce.number().int().positive().nullable().optional(),
});

export const updateUserSchema = z
  .object({
    name: nameField,
    email: emailField,
    role: roleEnum,
    coachId: z.coerce.number().int().positive().nullable(),
    isActive: z.boolean(),
    goals,
  })
  .partial();
