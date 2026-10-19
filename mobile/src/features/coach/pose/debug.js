import { bestSide } from './geometry';

/**
 * Lo que el analizador está mirando ahora, para calibrar los umbrales contra un cuerpo y una cámara reales:
 * lado, puntos visibles, visibilidad mínima, el ángulo de la repetición con su reposo y profundidad, y cada check.
 */
export function measure(rule, lm, side = bestSide(lm)) {
  const required = rule.required(lm, side);
  const scores = required.map((index) => lm[index]?.visibility ?? 0);
  const reps = rule.mode === 'reps' ? rule : null;
  const metric = reps ? reps.metric(lm, side) : null;
  return {
    side,
    visible: scores.filter((score) => score >= 0.5).length,
    total: required.length,
    minVisibility: scores.length ? Math.min(...scores) : 0,
    metric,
    rest: reps?.rest ?? null,
    peak: reps?.peak ?? null,
    progress: reps && metric !== null ? Math.min(1, Math.max(0, (reps.rest - metric) / (reps.rest - reps.peak))) : null,
    checks: rule.checks.map((check) => ({ message: check.message, ok: check.ok(lm, side) })),
  };
}
