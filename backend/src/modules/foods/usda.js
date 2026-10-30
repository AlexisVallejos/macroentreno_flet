import { env } from '../../config/env.js';
import { badGateway, badRequest } from '../../utils/httpError.js';

/**
 * Cliente de USDA FoodData Central (https://fdc.nal.usda.gov): base pública y gratuita del
 * Departamento de Agricultura de EE. UU., con análisis de laboratorio de alimentos genéricos
 * (carnes, frutas, verduras, cereales). Los nombres están en inglés. Clave gratuita: 1000 consultas
 * por hora; sin clave se usa DEMO_KEY, que alcanza para probar.
 */
const URL = 'https://api.nal.usda.gov/fdc/v1';
const TIMEOUT_MS = 10_000;
// Foundation y SR Legacy: alimentos genéricos analizados en laboratorio, valores cada 100 g.
const DATA_TYPES = ['Foundation', 'SR Legacy'];

let fetcher = (...args) => fetch(...args);
/** Para las pruebas: reemplaza el fetch real por uno simulado (sin argumento vuelve al real). */
export function setUsdaFetch(fn) {
  fetcher = fn ?? ((...args) => fetch(...args));
}

async function call(path, body) {
  let res;
  try {
    res = await fetcher(`${URL}${path}${path.includes('?') ? '&' : '?'}api_key=${encodeURIComponent(env.foodSources.usdaApiKey)}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw badGateway('USDA_ERROR', 'No se pudo conectar con USDA FoodData Central');
  }
  if (res.status === 404) return null;
  if (res.status === 429) throw badGateway('USDA_RATE_LIMIT', 'USDA alcanzó el límite de consultas: configurá USDA_API_KEY o probá en un rato');
  const json = await res.json().catch(() => null);
  if (!res.ok || !json) throw badGateway('USDA_ERROR', 'USDA FoodData Central no respondió');
  return json;
}

/** Número de nutriente de USDA → columna de la tabla foods (las unidades ya coinciden: g, mg, µg). */
const NUTRIENTS = {
  fiber: ['291'],
  sugar: ['269', '269.3'],
  saturated_fat: ['606'],
  cholesterol: ['601'],
  sodium: ['307'],
  potassium: ['306'],
  calcium: ['301'],
  iron: ['303'],
  vitamin_a: ['320'], // RAE, µg
  vitamin_c: ['401'],
  vitamin_d: ['328'], // D2 + D3, µg
};

const round = (n, digits = 2) => (n === null ? null : Math.round(n * 10 ** digits) / 10 ** digits);

/** La búsqueda y el detalle traen los nutrientes con formas distintas: se unifican por número. */
function nutrientMap(food) {
  const map = new Map();
  for (const n of food.foodNutrients ?? []) {
    const number = n.nutrientNumber ?? n.nutrient?.number;
    const value = n.value ?? n.amount;
    const unit = (n.unitName ?? n.nutrient?.unitName ?? '').toUpperCase();
    if (number && value !== undefined && value !== null) map.set(`${number}|${unit}`, Number(value)).set(number, Number(value));
  }
  return map;
}

/** Un alimento de USDA con sus valores cada 100 g, en el formato de la tabla foods. */
export function normalizeFood(food) {
  const n = nutrientMap(food);
  const pick = (numbers) => {
    for (const number of numbers) if (n.has(number)) return n.get(number);
    return null;
  };
  // Energía: kcal (208) o, en Foundation, los factores de Atwater (957/958).
  const kcal = n.get('208|KCAL') ?? n.get('957') ?? n.get('958') ?? (n.has('268') ? n.get('268') / 4.184 : null);
  if (kcal === null || kcal === undefined) return null;
  return {
    externalId: String(food.fdcId),
    barcode: null,
    name: food.description,
    brand: null,
    portionGrams: 100,
    portionDescription: 'por 100 g',
    servingGrams: null,
    kcal: round(kcal, 1),
    protein: round(pick(['203']) ?? 0),
    carbs: round(pick(['205']) ?? 0),
    fat: round(pick(['204']) ?? 0),
    micros: Object.fromEntries(Object.entries(NUTRIENTS).map(([column, numbers]) => [column, round(pick(numbers))])),
  };
}

/** Busca alimentos genéricos (en inglés: "chicken breast", "banana", "oats"). */
export async function searchFoods(search, { limit = 20 } = {}) {
  const json = await call('/foods/search', { query: search, pageSize: limit, dataType: DATA_TYPES });
  return (json?.foods ?? []).map(normalizeFood).filter(Boolean);
}

/** El detalle de un alimento por su fdcId, listo para guardar. */
export async function getFood(fdcId) {
  const json = await call(`/food/${encodeURIComponent(fdcId)}`);
  const food = json ? normalizeFood(json) : null;
  if (!food) throw badRequest('Ese alimento de USDA no informa sus calorías: no se puede registrar');
  return food;
}
