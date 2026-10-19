// Geometría sobre los puntos que devuelve MediaPipe: x/y normalizados entre 0 y 1, la y crece hacia abajo.
// Un punto es { x, y, z?, visibility? } y una pose (landmarks) es la lista de los 33 puntos de BlazePose.

/** Índices de BlazePose que usan las reglas. */
export const LM = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
};

/** Articulaciones de cada lado del cuerpo ('left' | 'right'). */
export const JOINTS = {
  left: { shoulder: LM.leftShoulder, elbow: LM.leftElbow, wrist: LM.leftWrist, hip: LM.leftHip, knee: LM.leftKnee, ankle: LM.leftAnkle },
  right: { shoulder: LM.rightShoulder, elbow: LM.rightElbow, wrist: LM.rightWrist, hip: LM.rightHip, knee: LM.rightKnee, ankle: LM.rightAnkle },
};

const DEGREES = 180 / Math.PI;

/** Ángulo en b formado por a–b–c, en grados (0–180). */
export function angle(a, b, c) {
  const ax = a.x - b.x;
  const ay = a.y - b.y;
  const cx = c.x - b.x;
  const cy = c.y - b.y;
  const length = Math.hypot(ax, ay) * Math.hypot(cx, cy);
  if (length === 0) return 0;
  const cos = (ax * cx + ay * cy) / length;
  return Math.acos(Math.min(1, Math.max(-1, cos))) * DEGREES;
}

/** Grados entre el segmento from→to y la vertical: 0 = vertical, 90 = horizontal. */
export function inclination(from, to) {
  return angle({ x: from.x, y: from.y - 1 }, from, to);
}

export function isVisible(lm, index, min = 0.5) {
  const point = lm[index];
  return !!point && (point.visibility ?? 1) >= min;
}

/** Qué tan bien ve la cámara un lado del cuerpo: 0–4, la suma de la visibilidad de sus articulaciones principales. */
export function sideScore(lm, side) {
  const joints = JOINTS[side];
  return [joints.shoulder, joints.hip, joints.knee, joints.ankle].reduce((sum, index) => sum + (lm[index]?.visibility ?? 0), 0);
}

/** El lado del cuerpo que la cámara ve mejor (para los ejercicios de perfil). */
export function bestSide(lm) {
  return sideScore(lm, 'left') >= sideScore(lm, 'right') ? 'left' : 'right';
}

/** Si p queda por encima de la recta de a a c (y menor = más arriba en pantalla). */
export function isAboveLine(p, a, c) {
  const t = c.x === a.x ? 0.5 : (p.x - a.x) / (c.x - a.x);
  return p.y < a.y + (c.y - a.y) * t;
}
