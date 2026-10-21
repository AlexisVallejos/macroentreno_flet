import { z } from 'zod';
import { pagination } from '../../utils/validation.js';

const macro = z.coerce.number().min(0, 'No puede ser negativo').max(5000);

export const listFoodsQuery = z.object({
  ...pagination,
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().max(60).optional(),
  scope: z.enum(['all', 'global', 'mine']).default('all'),
});

export const foodSchema = z.object({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(150),
  category: z.string().trim().max(60).default('General'),
  brand: z.string().trim().max(80).nullable().optional(),
  portionGrams: z.coerce.number().positive('La porción debe ser mayor a 0').max(5000).default(100),
  portionDescription: z.string().trim().max(120).nullable().optional(),
  kcal: macro,
  protein: macro,
  carbs: macro,
  fat: macro,
  // Solo coach/admin pueden crear alimentos del catálogo global.
  isGlobal: z.boolean().default(false),
});

export const updateFoodSchema = foodSchema.omit({ isGlobal: true }).partial();

export const fatSecretSearchQuery = z.object({
  search: z.string().trim().min(2, 'Escribí al menos 2 letras').max(100),
  page: z.coerce.number().int().min(0).max(50).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const fatSecretImportSchema = z.object({
  externalId: z.string().trim().regex(/^\d{1,20}$/, 'Id de FatSecret inválido'),
});
