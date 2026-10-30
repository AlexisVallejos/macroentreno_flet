// De qué está hecha una sesión con cámara (series, objetivo, descanso), elegida por ejercicio, y qué se hizo en cada serie.
// Los ajustes quedan en este navegador; lo que se hizo se guarda como sesión de entrenamiento en la API.

const LIMIT = (min, max, step) => ({ min, max, step });
export const LIMITS = {
  sets: LIMIT(1, 5, 1),
  reps: LIMIT(5, 30, 1),
  hold: LIMIT(10, 90, 5),
  rest: LIMIT(10, 90, 5),
};

export const DEFAULT_SETS = 3;
export const DEFAULT_REST_S = 15;

const CONFIG_KEY = 'macroentreno:coach:ajustes';

const fit = (value, { min, max, step }) => Math.min(max, Math.max(min, Math.round(value / step) * step));
export const targetRange = (rule) => (rule.mode === 'reps' ? LIMITS.reps : LIMITS.hold);

export function defaultConfig(rule) {
  return { sets: DEFAULT_SETS, target: rule.target, restS: DEFAULT_REST_S };
}

/** Lo que quede fuera de rango (un ajuste viejo, un storage editado a mano) vuelve adentro. */
export function clampConfig(rule, config) {
  const base = defaultConfig(rule);
  const number = (value, fallback) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
  return {
    sets: fit(number(config.sets, base.sets), LIMITS.sets),
    target: fit(number(config.target, base.target), targetRange(rule)),
    restS: fit(number(config.restS, base.restS), LIMITS.rest),
  };
}

function readJson(key, fallback) {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // Sin storage: dura hasta recargar.
  }
}

export function readConfig(rule) {
  const all = readJson(CONFIG_KEY, {});
  return clampConfig(rule, all[rule.id] ?? {});
}

export function writeConfig(rule, config) {
  const all = readJson(CONFIG_KEY, {});
  writeJson(CONFIG_KEY, { ...all, [rule.id]: clampConfig(rule, config) });
}

/** La regla con el objetivo que eligió la persona: el tracker y el entrenador lo leen de ahí. */
export const withTarget = (rule, target) => ({ ...rule, target });

// ───────────────────────── resultados ─────────────────────────
// Una serie terminada: { reps, badReps, holdMs, log, errors }.

export function sumSets(sets) {
  const errors = {};
  for (const set of sets) for (const [key, count] of Object.entries(set.errors)) errors[key] = (errors[key] ?? 0) + count;
  return {
    reps: sets.reduce((sum, set) => sum + set.reps, 0),
    badReps: sets.reduce((sum, set) => sum + set.badReps, 0),
    holdMs: sets.reduce((sum, set) => sum + set.holdMs, 0),
    errors,
  };
}

/** Tiempo promedio por repetición bien hecha, en ms; null si no hay ninguna. */
export function tempo(log) {
  const good = log.filter((mark) => mark.ok);
  return good.length ? good.reduce((sum, mark) => sum + mark.ms, 0) / good.length : null;
}

/** Proporción de repeticiones que contaron, 0–1; null si no hay ninguna. */
export function quality(totals) {
  const all = totals.reps + totals.badReps;
  return all ? totals.reps / all : null;
}

/** La corrección que más veces se dio, si hubo alguna. */
export function worstError(errors) {
  return Object.entries(errors).sort((a, b) => b[1] - a[1])[0] ?? null;
}
