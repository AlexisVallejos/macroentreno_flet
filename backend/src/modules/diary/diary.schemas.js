import { z } from 'zod';
import { isoDate } from '../../utils/validation.js';

export const MEALS = ['desayuno', 'almuerzo', 'merienda', 'cena', 'snack'];
const meal = z.enum(MEALS, { message: `La comida debe ser una de: ${MEALS.join(', ')}` });
const macro = z.coerce.number().min(0, 'No puede ser negativo').max(10000);

export const dayQuery = z.object({
  date: isoDate,
  userId: z.coerce.number().int().positive().optional(),
});

/**
 * Con foodId los macros se calculan a partir del alimento y los gramos.
 * Sin foodId es una carga manual: nombre y macros son obligatorios.
 */
export const createEntrySchema = z
  .object({
    date: isoDate,
    meal,
    grams: z.coerce.number().positive('Los gramos deben ser mayores a 0').max(5000),
    foodId: z.coerce.number().int().positive().optional(),
    name: z.string().trim().min(2).max(150).optional(),
    kcal: macro.optional(),
    protein: macro.optional(),
    carbs: macro.optional(),
    fat: macro.optional(),
  })
  .refine((v) => v.foodId || (v.name && v.kcal !== undefined), {
    message: 'Indicá foodId o, para una carga manual, name y kcal',
    path: ['foodId'],
  });

export const updateEntrySchema = z
  .object({
    date: isoDate,
    meal,
    grams: z.coerce.number().positive().max(5000),
    name: z.string().trim().min(2).max(150),
    kcal: macro,
    protein: macro,
    carbs: macro,
    fat: macro,
  })
  .partial();
