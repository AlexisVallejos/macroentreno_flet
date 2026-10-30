import { env } from '../../config/env.js';
import { badGateway } from '../../utils/httpError.js';

/**
 * Cliente de Open Food Facts (https://world.openfoodfacts.org): base libre y gratuita de productos
 * envasados, con muy buena cobertura de marcas argentinas. No usa clave, pero pide un User-Agent
 * propio y limita a ~15 consultas de producto y ~10 búsquedas por minuto: por eso el buscador de la
 * app busca al confirmar (no letra por letra) y los productos encontrados se guardan en el catálogo.
 * Datos © colaboradores de Open Food Facts, licencia ODbL.
 */
const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product';
const SEARCH_URL = 'https://search.openfoodfacts.org/search';
const TIMEOUT_MS = 10_000;
const FIELDS = 'code,product_name,product_name_es,brands,quantity,serving_size,serving_quantity,nutriments';

let fetcher = (...args) => fetch(...args);
/** Para las pruebas: reemplaza el fetch real por uno simulado (sin argumento vuelve al real). */
export function setOpenFoodFactsFetch(fn) {
  fetcher = fn ?? ((...args) => fetch(...args));
}

async function get(url) {
  let res;
  try {
    res = await fetcher(url, { headers: { 'User-Agent': env.foodSources.userAgent }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw badGateway('OPENFOODFACTS_ERROR', 'No se pudo conectar con Open Food Facts');
  }
  if (res.status === 404) return null;
  const json = await res.json().catch(() => null);
  if (!res.ok || !json) throw badGateway('OPENFOODFACTS_ERROR', 'Open Food Facts no respondió, probá en un rato');
  return json;
}

const num = (value) => (value === undefined || value === null || value === '' || Number.isNaN(Number(value)) ? null : Number(value));
const round = (n, digits = 2) => (n === null ? null : Math.round(n * 10 ** digits) / 10 ** digits);
/** Open Food Facts informa los minerales en gramos; la tabla los guarda en mg o µg. */
const scaled = (value, factor) => (value === null ? null : round(value * factor));

/**
 * Topes físicamente posibles cada 100 g. Los datos los cargan voluntarios y a veces ponen mg donde
 * va g (ej. "11 g de colesterol" en un alfajor): un valor imposible se descarta en vez de guardarse.
 */
const MAX_PER_100G = {
  fiber: 100, sugar: 100, saturated_fat: 100, cholesterol: 3000, sodium: 40000, potassium: 10000,
  calcium: 5000, iron: 100, vitamin_a: 30000, vitamin_c: 3000, vitamin_d: 300,
};
const plausible = (micros) =>
  Object.fromEntries(Object.entries(micros).map(([k, v]) => [k, v !== null && (v < 0 || v > MAX_PER_100G[k]) ? null : v]));

/** Un producto de Open Food Facts con sus valores cada 100 g, en el formato de la tabla foods. */
export function normalizeProduct(product) {
  const n = product?.nutriments ?? {};
  const kj = num(n['energy-kj_100g']) ?? num(n.energy_100g);
  const kcal = num(n['energy-kcal_100g']) ?? (kj === null ? null : kj / 4.184);
  const name = (product.product_name_es || product.product_name || '').trim();
  if (!name || kcal === null) return null;
  const brands = Array.isArray(product.brands) ? product.brands : String(product.brands ?? '').split(',');
  const liquid = /\b(ml|l|cl)\b/i.test(product.quantity ?? '');
  return {
    externalId: String(product.code),
    barcode: String(product.code),
    name,
    brand: brands.map((b) => b.trim()).find(Boolean) ?? null,
    portionGrams: 100,
    portionDescription: liquid ? 'por 100 ml' : 'por 100 g',
    servingGrams: num(product.serving_quantity),
    kcal: round(kcal, 1),
    protein: round(num(n.proteins_100g) ?? 0),
    carbs: round(num(n.carbohydrates_100g) ?? 0),
    fat: round(num(n.fat_100g) ?? 0),
    micros: plausible({
      fiber: round(num(n.fiber_100g)),
      sugar: round(num(n.sugars_100g)),
      saturated_fat: round(num(n['saturated-fat_100g'])),
      cholesterol: scaled(num(n.cholesterol_100g), 1000),
      sodium: scaled(num(n.sodium_100g), 1000),
      potassium: scaled(num(n.potassium_100g), 1000),
      calcium: scaled(num(n.calcium_100g), 1000),
      iron: scaled(num(n.iron_100g), 1000),
      vitamin_a: scaled(num(n['vitamin-a_100g']), 1_000_000),
      vitamin_c: scaled(num(n['vitamin-c_100g']), 1000),
      vitamin_d: scaled(num(n['vitamin-d_100g']), 1_000_000),
    }),
  };
}

/** Busca un producto por su código de barras (EAN-13, EAN-8, UPC). null si no existe o no tiene calorías. */
export async function getProductByBarcode(code) {
  const json = await get(`${PRODUCT_URL}/${encodeURIComponent(code)}.json?fields=${FIELDS}`);
  if (!json || json.status === 0 || !json.product) return null;
  return normalizeProduct({ ...json.product, code: json.product.code || code });
}

/** Búsqueda por texto, priorizando productos vendidos en Argentina. */
export async function searchProducts(search, { limit = 20 } = {}) {
  const terms = search.replace(/[:"()]/g, ' ').trim();
  const url = (q) => `${SEARCH_URL}?q=${encodeURIComponent(q)}&page_size=${limit}&fields=${FIELDS}`;
  let hits = (await get(url(`${terms} countries_tags:"en:argentina"`)))?.hits ?? [];
  // Si no hay productos argentinos, se busca en todo el mundo.
  if (!hits.length) hits = (await get(url(terms)))?.hits ?? [];
  return hits.map(normalizeProduct).filter(Boolean);
}
