/**
 * Micronutrientes que registra MacroEntreno Pro, con las unidades en que los informa FatSecret
 * y el valor diario de referencia para adultos (Daily Values de la FDA, dieta de 2000 kcal).
 *  - goal: conviene llegar (fibra, vitaminas, minerales)
 *  - limit: conviene no pasarse (azúcares, grasas saturadas, colesterol, sodio)
 * El orden es el de la lista que ve el usuario.
 */
export const MICROS = [
  { key: 'fiber', column: 'fiber', label: 'Fibra', unit: 'g', daily: 28, kind: 'goal' },
  { key: 'sugar', column: 'sugar', label: 'Azúcares', unit: 'g', daily: 50, kind: 'limit' },
  { key: 'saturatedFat', column: 'saturated_fat', label: 'Grasas saturadas', unit: 'g', daily: 20, kind: 'limit' },
  { key: 'cholesterol', column: 'cholesterol', label: 'Colesterol', unit: 'mg', daily: 300, kind: 'limit' },
  { key: 'sodium', column: 'sodium', label: 'Sodio', unit: 'mg', daily: 2300, kind: 'limit' },
  { key: 'potassium', column: 'potassium', label: 'Potasio', unit: 'mg', daily: 4700, kind: 'goal' },
  { key: 'calcium', column: 'calcium', label: 'Calcio', unit: 'mg', daily: 1300, kind: 'goal' },
  { key: 'iron', column: 'iron', label: 'Hierro', unit: 'mg', daily: 18, kind: 'goal' },
  { key: 'vitaminA', column: 'vitamin_a', label: 'Vitamina A', unit: 'µg', daily: 900, kind: 'goal' },
  { key: 'vitaminC', column: 'vitamin_c', label: 'Vitamina C', unit: 'mg', daily: 90, kind: 'goal' },
  { key: 'vitaminD', column: 'vitamin_d', label: 'Vitamina D', unit: 'µg', daily: 20, kind: 'goal' },
];

export const MICRO_COLUMNS = MICROS.map((m) => m.column);

const round = (n, digits = 1) => {
  const f = 10 ** digits;
  return Math.round(Number(n) * f) / f;
};

const known = (value) => value !== null && value !== undefined;

/** Los micronutrientes de una fila (alimento o registro) con nombres de la API; null si no se conocen. */
export function microsOf(row) {
  return Object.fromEntries(MICROS.map((m) => [m.key, known(row[m.column]) ? Number(row[m.column]) : null]));
}

/** Los micronutrientes de un alimento escalados por `factor`, con nombres de columna (para guardarlos). */
export function scaleMicros(food, factor) {
  return Object.fromEntries(MICRO_COLUMNS.map((c) => [c, known(food[c]) ? round(food[c] * factor, 2) : null]));
}

/** Columnas en NULL: lo que se guarda en una carga manual. */
export const noMicros = () => Object.fromEntries(MICRO_COLUMNS.map((c) => [c, null]));

/**
 * Resumen de un conjunto de registros: el total de cada micronutriente, el porcentaje del valor diario
 * y la cobertura (cuántos registros traían el dato). Lo desconocido no suma cero: queda afuera y se informa.
 * `days` divide los totales para dar un promedio diario.
 */
export function summarizeMicros(rows, { days = 1 } = {}) {
  return MICROS.map((m) => {
    const values = rows.map((r) => r[m.column]).filter(known).map(Number);
    const value = values.length ? round(values.reduce((a, b) => a + b, 0) / days) : null;
    return {
      key: m.key,
      label: m.label,
      unit: m.unit,
      daily: m.daily,
      kind: m.kind,
      value,
      percent: value === null ? null : Math.round((value / m.daily) * 100),
      known: values.length,
      entries: rows.length,
    };
  });
}
