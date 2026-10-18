import { z } from 'zod';

const password = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(72, 'La contraseña no puede superar 72 caracteres')
  .regex(/[A-Za-z]/, 'La contraseña debe incluir al menos una letra')
  .regex(/\d/, 'La contraseña debe incluir al menos un número');

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  email: z.email('Email inválido').trim().toLowerCase(),
  password,
});

export const loginSchema = z.object({
  email: z.email('Email inválido').trim().toLowerCase(),
  password: z.string().min(1, 'Ingresá la contraseña'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Falta refreshToken'),
});

export const oauthParams = z.object({
  provider: z.enum(['google', 'facebook', 'github'], { message: 'Proveedor no soportado' }),
});

export const oauthStartQuery = z.object({
  redirect_uri: z.string().min(1, 'Falta redirect_uri'),
  code_challenge: z.string().regex(/^[a-f0-9]{64}$/, 'code_challenge debe ser un SHA-256 en hexadecimal'),
});

export const oauthExchangeSchema = z.object({
  code: z.string().min(1, 'Falta code'),
  codeVerifier: z.string().min(43, 'code_verifier inválido').max(128),
});
export const changePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: password,
});
