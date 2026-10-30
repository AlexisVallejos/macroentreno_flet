import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { badGateway, badRequest, unavailable } from '../../utils/httpError.js';
import { MICROS } from '../nutrition/micros.js';

/**
 * Cliente de FatSecret Platform (https://platform.fatsecret.com).
 * Usa OAuth 1.0 firmado (HMAC-SHA1) con la consumer key: a diferencia de OAuth 2.0, no exige
 * registrar la IP del servidor en FatSecret.
 */
const URL = 'https://platform.fatsecret.com/rest/server.api';
const TIMEOUT_MS = 10_000;

let fetcher = (...args) => fetch(...args);
/** Para las pruebas: reemplaza el fetch real por uno simulado (sin argumento vuelve al real). */
export function setFatSecretFetch(fn) {
  fetcher = fn ?? ((...args) => fetch(...args));
}

export const fatSecretConfigured = () => Boolean(env.fatsecret.consumerKey && env.fatsecret.consumerSecret);

/** Codificación RFC 3986 que exige la firma OAuth 1.0. */
const enc = (value) => encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

function signedQuery(params) {
  const all = {
    ...params,
    format: 'json',
    oauth_consumer_key: env.fatsecret.consumerKey,
    oauth_nonce: crypto.randomBytes(12).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_version: '1.0',
  };
  const normalized = Object.keys(all)
    .sort()
    .map((k) => `${enc(k)}=${enc(all[k])}`)
    .join('&');
  const base = ['GET', enc(URL), enc(normalized)].join('&');
  all.oauth_signature = crypto.createHmac('sha1', `${enc(env.fatsecret.consumerSecret)}&`).update(base).digest('base64');
  return Object.keys(all)
    .map((k) => `${enc(k)}=${enc(all[k])}`)
    .join('&');
}

async function call(method, params) {
  if (!fatSecretConfigured()) throw unavailable('FATSECRET_NOT_CONFIGURED', 'La búsqueda en FatSecret no está configurada en el servidor');
  const locale = env.fatsecret.region ? { region: env.fatsecret.region, ...(env.fatsecret.language ? { language: env.fatsecret.language } : {}) } : {};
  let res;
  try {
    res = await fetcher(`${URL}?${signedQuery({ method, ...locale, ...params })}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw badGateway('FATSECRET_ERROR', 'No se pudo conectar con FatSecret');
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json) throw badGateway('FATSECRET_ERROR', 'FatSecret no respondió');
  if (json.error) throw badGateway('FATSECRET_ERROR', `FatSecret: ${json.error.message}`);
  return json;
}

// FatSecret devuelve un objeto suelto cuando hay un solo elemento y un array cuando hay varios.
const list = (value) => (value === undefined || value === null ? [] : [].concat(value));
const num = (value) => (value === undefined || value === null || value === '' ? null : Number(value));
const round = (n, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits;
const OZ_TO_G = 28.3495;

/** Gramos (o ml, que se toman como gramos) de una porción; null si no informa una medida métrica. */
function metricGrams(serving) {
  const amount = num(serving.metric_serving_amount);
  if (!amount) return null;
  if (serving.metric_serving_unit === 'g' || serving.metric_serving_unit === 'ml') return amount;
  if (serving.metric_serving_unit === 'oz') return amount * OZ_TO_G;
  return null;
}

/** La porción para pasar a 100 g: la estándar de 100 g si existe, si no la sugerida, si no la primera con medida. */
function baseServing(servings) {
  const metric = servings.filter((s) => metricGrams(s));
  return (
    metric.find((s) => metricGrams(s) === 100) ??
    metric.find((s) => s.is_default === '1') ??
    metric[0] ??
    null
  );
}

/** Un alimento de FatSecret con sus valores cada 100 g, en el formato de la tabla foods. */
function normalize(food) {
  const serving = baseServing(list(food.servings?.serving));
  if (!serving) return null;
  const factor = 100 / metricGrams(serving);
  const per100 = (field) => {
    const value = num(serving[field]);
    return value === null ? null : round(value * factor);
  };
  const micros = Object.fromEntries(MICROS.map((m) => [m.column, per100(m.column)]));
  return {
    externalId: String(food.food_id),
    name: food.food_name,
    brand: food.brand_name ?? null,
    type: food.food_type,
    portionGrams: 100,
    portionDescription: serving.metric_serving_unit === 'ml' ? 'por 100 ml' : 'por 100 g',
    kcal: per100('calories') ?? 0,
    protein: per100('protein') ?? 0,
    carbs: per100('carbohydrate') ?? 0,
    fat: per100('fat') ?? 0,
    micros,
  };
}

/** Busca alimentos. Cada resultado viene con macros y micronutrientes cada 100 g y cuántos micros informa. */
export async function searchFoods(search, { page = 0, limit = 20 } = {}) {
  const json = await call('foods.search.v5', { search_expression: search, page_number: String(page), max_results: String(limit) });
  const result = json.foods_search ?? {};
  const foods = list(result.results?.food)
    .map(normalize)
    .filter(Boolean)
    .map((food) => ({ ...food, microsCount: Object.values(food.micros).filter((v) => v !== null).length }));
  return { total: Number(result.total_results ?? foods.length), page: Number(result.page_number ?? page), foods };
}

/** El detalle de un alimento, listo para guardar. */
export async function getFoodDetail(externalId) {
  const json = await call('food.get.v5', { food_id: String(externalId) });
  const food = normalize(json.food ?? {});
  if (!food) throw badRequest('Ese alimento de FatSecret no informa sus gramos: no se puede registrar');
  return food;
}
