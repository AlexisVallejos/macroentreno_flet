import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { HttpError, badRequest, unauthorized } from '../../utils/httpError.js';
import { socialProviders } from './socialProviders.js';

/**
 * Flujo de login social:
 *  1. La app abre en el navegador  GET /api/auth/oauth/:provider/start?redirect_uri=...&code_challenge=...
 *  2. El backend redirige al proveedor; el usuario inicia sesión y el proveedor vuelve a
 *     GET /api/auth/oauth/:provider/callback?code=...&state=...
 *  3. El backend obtiene el perfil, crea/vincula el usuario y redirige a la app con un
 *     código de un solo uso:  macroentreno://oauth-callback?code=XYZ
 *  4. La app canjea ese código (POST /api/auth/oauth/exchange) enviando el code_verifier
 *     original (PKCE), así ninguna otra app que intercepte el deep link puede usarlo.
 */

const LOGIN_CODE_TTL_MS = 2 * 60 * 1000;
const loginCodes = new Map(); // code -> { userId, challenge, expiresAt }

const sha256Hex = (value) => crypto.createHash('sha256').update(value).digest('hex');

export function getProvider(name) {
  const provider = socialProviders[name];
  if (!provider) throw badRequest('Proveedor no soportado. Usá google, facebook o github');
  if (!provider.isConfigured()) {
    throw new HttpError(
      501,
      'PROVIDER_NOT_CONFIGURED',
      `El inicio de sesión con ${provider.label} no está configurado en el servidor`,
    );
  }
  return provider;
}

/** Solo se devuelve el control a esquemas de la app (evita redirecciones abiertas). */
export function assertAppRedirect(uri) {
  let scheme;
  try {
    scheme = new URL(uri).protocol.replace(':', '');
  } catch {
    throw badRequest('redirect_uri inválida');
  }
  if (!env.oauth.appSchemes.includes(scheme)) {
    throw badRequest(`redirect_uri debe usar uno de estos esquemas: ${env.oauth.appSchemes.join(', ')}`);
  }
}

export const callbackUrl = (req, providerName) =>
  `${env.oauth.publicApiUrl || `${req.protocol}://${req.get('host')}`}/api/auth/oauth/${providerName}/callback`;

/** El "state" viaja firmado: proveedor, URI de la app y desafío PKCE. Vence en 10 minutos. */
export const signState = (data) => jwt.sign({ ...data, type: 'oauth_state' }, env.jwt.accessSecret, { expiresIn: '10m' });

export function verifyState(state) {
  try {
    const payload = jwt.verify(state, env.jwt.accessSecret);
    if (payload.type !== 'oauth_state') throw new Error('tipo');
    return payload;
  } catch {
    throw badRequest('La sesión de inicio expiró o es inválida; volvé a intentarlo');
  }
}

export function createLoginCode(userId, challenge) {
  const now = Date.now();
  for (const [code, data] of loginCodes) if (data.expiresAt < now) loginCodes.delete(code);
  const code = crypto.randomBytes(32).toString('hex');
  loginCodes.set(code, { userId, challenge, expiresAt: now + LOGIN_CODE_TTL_MS });
  return code;
}

export function consumeLoginCode(code, codeVerifier) {
  const data = loginCodes.get(code);
  loginCodes.delete(code); // un solo uso, aunque falle la verificación
  if (!data || data.expiresAt < Date.now() || sha256Hex(codeVerifier) !== data.challenge) {
    throw unauthorized('Código de inicio de sesión inválido o vencido', 'SOCIAL_LOGIN_FAILED');
  }
  return data.userId;
}

export function appRedirect(appUri, params) {
  const url = new URL(appUri);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}
