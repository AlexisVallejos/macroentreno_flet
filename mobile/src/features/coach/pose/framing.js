import { isVisible } from './geometry';

// "Alejate" es el consejo correcto solo a veces. Mirando dónde está el cuerpo visible se sabe cuál es:
// no hay nadie, está cortado por un borde, está tan lejos que no se lo ve bien, o simplemente falta una parte.

export const NO_PERSON = 'No te veo: ponete frente a la cámara.';
export const STEP_BACK = 'Alejate un poco: necesito verte de la cabeza a los pies.';
export const CENTER = 'Correte al centro de la imagen.';
export const CLOSER = 'Acercate un poco a la cámara.';

/** Partes del cuerpo como las nombraría la persona, de la cabeza a los pies. */
const PARTS = [
  [[11, 12], 'hombros'],
  [[13, 14], 'codos'],
  [[15, 16], 'manos'],
  [[23, 24], 'cadera'],
  [[25, 26], 'rodillas'],
  [[27, 28], 'pies'],
];

/** Más cerca que esto de un borde de la imagen cuenta como cortado. */
const EDGE = 0.03;
/** Un cuerpo así de bajo en pantalla está demasiado lejos: MediaPipe adivina las articulaciones en vez de verlas. */
const MIN_HEIGHT = 0.35;
const SEEN = 0.5;

/** Qué partes del cuerpo, entre las `required`, la cámara no ve lo suficiente. */
export function missingParts(lm, required, min) {
  const hidden = new Set(required.filter((index) => !lm || !isVisible(lm, index, min)));
  return PARTS.filter(([indices]) => indices.some((index) => hidden.has(index))).map(([, name]) => name);
}

/** Si la persona está bien encuadrada para juzgarla y, si no, la única cosa que tiene que hacer. */
export function checkFraming(lm, required, min) {
  const missing = missingParts(lm, required, min);
  if (!lm) return { ok: false, message: NO_PERSON, missing };
  if (missing.length === 0) return { ok: true, message: '', missing };

  const seen = lm.filter((point) => (point.visibility ?? 1) >= SEEN);
  if (seen.length === 0) return { ok: false, message: NO_PERSON, missing };
  const xs = seen.map((point) => point.x);
  const ys = seen.map((point) => point.y);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  if (Math.min(...xs) < EDGE || Math.max(...xs) > 1 - EDGE) return { ok: false, message: CENTER, missing };
  if (top < EDGE || bottom > 1 - EDGE) return { ok: false, message: STEP_BACK, missing };
  if (bottom - top < MIN_HEIGHT) return { ok: false, message: CLOSER, missing };
  return { ok: false, message: STEP_BACK, missing };
}
