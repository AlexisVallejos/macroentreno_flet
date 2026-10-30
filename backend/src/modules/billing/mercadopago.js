import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { badGateway, unavailable } from '../../utils/httpError.js';

/**
 * Cliente mínimo de la API de Mercado Pago para suscripciones (preapproval).
 * https://www.mercadopago.com.ar/developers/es/docs/subscriptions
 */
const BASE_URL = 'https://api.mercadopago.com';
const TIMEOUT_MS = 15_000;

let fetcher = (...args) => fetch(...args);
/** Para las pruebas: reemplaza el fetch real por uno simulado (sin argumento vuelve al real). */
export function setMercadoPagoFetch(fn) {
  fetcher = fn ?? ((...args) => fetch(...args));
}

export const mercadoPagoConfigured = () => Boolean(env.billing.mpAccessToken);

async function mp(path, { method = 'GET', body, idempotencyKey } = {}) {
  if (!mercadoPagoConfigured()) throw unavailable('BILLING_NOT_CONFIGURED', 'Los pagos no están configurados en el servidor');
  const headers = { Authorization: `Bearer ${env.billing.mpAccessToken}`, 'Content-Type': 'application/json' };
  if (idempotencyKey) headers['X-Idempotency-Key'] = idempotencyKey;
  let res;
  try {
    res = await fetcher(`${BASE_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw badGateway('MERCADOPAGO_ERROR', 'No se pudo conectar con Mercado Pago');
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw badGateway('MERCADOPAGO_ERROR', `Mercado Pago: ${json.message || `error ${res.status}`}`);
  return json;
}

/** Crea una suscripción "pendiente": devuelve init_point, la página donde la persona elige cómo pagar. */
export const createPreapproval = (body, idempotencyKey) => mp('/preapproval', { method: 'POST', body, idempotencyKey });
export const getPreapproval = (id) => mp(`/preapproval/${encodeURIComponent(id)}`);
export const updatePreapproval = (id, body) => mp(`/preapproval/${encodeURIComponent(id)}`, { method: 'PUT', body });
/** Cada cobro mensual de una suscripción; trae el preapproval_id al que pertenece. */
export const getAuthorizedPayment = (id) => mp(`/authorized_payments/${encodeURIComponent(id)}`);

/**
 * Verifica la firma de un webhook (encabezado x-signature: "ts=…,v1=…").
 * Igual que el SDK oficial: HMAC-SHA256 en hex, con la clave secreta del panel, de
 * "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" (lo que falte se omite).
 */
export function verifyWebhookSignature({ signature, requestId, dataId, secret }) {
  if (!signature || !secret) return false;
  const parts = Object.fromEntries(
    String(signature)
      .split(',')
      .map((part) => part.split('=').map((s) => s.trim()))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [key.toLowerCase(), value]),
  );
  if (!parts.ts || !parts.v1 || !/^\d+$/.test(parts.ts)) return false;
  const manifest = [dataId && `id:${dataId}`, requestId && `request-id:${requestId}`, `ts:${parts.ts}`].filter(Boolean).join(';') + ';';
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  return expected.length === parts.v1.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}
