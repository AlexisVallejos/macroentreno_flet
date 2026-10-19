import { LM } from './geometry';

// Demo 3D de cada ejercicio: un maniquí que hace la técnica correcta.
// Las poses se calculan con los mismos ángulos que mira el analizador (rules.js): lo que ves es exactamente lo
// que el sistema va a dar por bueno.
// Un punto es { x, y } en el plano del movimiento: x hacia adelante, y hacia arriba, en metros. La figura mira a +x.
// Una figura es { left, right, head }: `left` es el lado más cerca de la cámara, y cada lado tiene
// shoulder, elbow, wrist, hip, knee, ankle y toe. Algunos ejercicios usan las dos piernas distinto (estocada, patada).

const THIGH = 0.45;
const SHIN = 0.44;
const TORSO = 0.55;
const UPPER = 0.3;
const FORE = 0.27;
const BODY = THIGH + SHIN + TORSO;
const ANKLE_Y = 0.08;

const rad = (degrees) => (degrees * Math.PI) / 180;
const lerp = (a, b, t) => a + (b - a) * t;
const add = (a, x, y) => ({ x: a.x + x, y: a.y + y });

/** El punto a `length` de `from`, `deg` grados en sentido horario desde arriba (90 = adelante, 180 = abajo, -90 = atrás). */
function polar(from, length, deg) {
  return { x: from.x + length * Math.sin(rad(deg)), y: from.y + length * Math.cos(rad(deg)) };
}

/** La rodilla o el codo entre `a` y `c` para dos segmentos de largo l1 y l2, doblado hacia `toward`. */
function bend(a, c, l1, l2, toward) {
  const dx = c.x - a.x;
  const dy = c.y - a.y;
  const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 1e-6) || 1e-6;
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const ux = dx / d;
  const uy = dy / d;
  const px = -uy;
  const py = ux;
  const sign = px * toward.x + py * toward.y >= 0 ? 1 : -1;
  return { x: a.x + ux * along + px * h * sign, y: a.y + uy * along + py * h * sign };
}

function limbs(shoulder, elbow, wrist, hip, knee, ankle, toe) {
  return { shoulder, elbow, wrist, hip, knee, ankle, toe };
}

/** Brazo estirado desde el hombro a `deg`, con un leve doblez para que no se vea trabado. */
function armAt(shoulder, deg) {
  const elbow = polar(shoulder, UPPER, deg);
  return { elbow, wrist: polar(elbow, FORE, deg) };
}

const headOver = (shoulder, deg) => polar(shoulder, 0.22, deg);

function squat(p) {
  const K = lerp(172, 92, p);
  const shin = (180 - K) * 0.28;
  const lean = lerp(8, 38, p);
  const ankle = { x: 0, y: ANKLE_Y };
  const knee = polar(ankle, SHIN, shin);
  const hip = polar(knee, THIGH, shin + 180 + K);
  const shoulder = polar(hip, TORSO, lean);
  const arm = armAt(shoulder, lerp(172, 85, p));
  const side = limbs(shoulder, arm.elbow, arm.wrist, hip, knee, ankle, add(ankle, 0.17, -ANKLE_Y));
  return { left: side, right: side, head: headOver(shoulder, lean) };
}

function lunge(p) {
  const hipY = lerp(0.905, 0.68, p);
  const hip = { x: 0, y: hipY };
  const shoulder = polar(hip, TORSO, 4);
  const arm = armAt(shoulder, 176);
  const leg = (footX) => {
    const ankle = { x: footX, y: ANKLE_Y };
    return { ankle, knee: bend(hip, ankle, THIGH, SHIN, { x: 1, y: 0 }) };
  };
  const front = leg(0.32);
  const back = leg(-0.32);
  return {
    left: limbs(shoulder, arm.elbow, arm.wrist, hip, front.knee, front.ankle, add(front.ankle, 0.17, -ANKLE_Y)),
    right: limbs(shoulder, arm.elbow, arm.wrist, hip, back.knee, back.ankle, add(back.ankle, 0.17, -ANKLE_Y)),
    head: headOver(shoulder, 4),
  };
}

/** Un cuerpo recto de los tobillos a los hombros, con los hombros a la altura `shoulder` sobre el piso. */
function board(shoulder, elbow, wrist) {
  const rise = shoulder.y - ANKLE_Y;
  const ankle = { x: shoulder.x - Math.sqrt(BODY * BODY - rise * rise), y: ANKLE_Y };
  const at = (distance) => ({ x: ankle.x + ((shoulder.x - ankle.x) * distance) / BODY, y: ankle.y + ((shoulder.y - ankle.y) * distance) / BODY });
  const hip = at(THIGH + SHIN);
  const knee = at(SHIN);
  const toe = { x: ankle.x - 0.06, y: 0 };
  const forward = { x: shoulder.x - hip.x, y: shoulder.y - hip.y };
  const length = Math.hypot(forward.x, forward.y);
  const head = { x: shoulder.x + (forward.x / length) * 0.22, y: shoulder.y + (forward.y / length) * 0.22 + 0.03 };
  return { side: limbs(shoulder, elbow, wrist, hip, knee, ankle, toe), head };
}

function pushup(p) {
  const H = lerp(0.6, 0.36, p);
  const shoulder = { x: 0, y: H };
  const wrist = { x: 0, y: 0.03 };
  const elbow = bend(shoulder, wrist, UPPER, FORE, { x: -1, y: 0.3 });
  const { side, head } = board(shoulder, elbow, wrist);
  return { left: side, right: side, head };
}

function plank(p) {
  const breathe = 0.008 * Math.sin(p * Math.PI);
  const elbow = { x: 0, y: 0.03 };
  const shoulder = { x: 0, y: 0.33 + breathe };
  const { side, head } = board(shoulder, elbow, { x: 0.27, y: 0.03 });
  return { left: side, right: side, head };
}

function sidePlank(p) {
  const breathe = 0.008 * Math.sin(p * Math.PI);
  const shoulder = { x: 0, y: 0.33 + breathe };
  const elbow = { x: 0, y: 0.03 };
  const { side, head } = board(shoulder, elbow, { x: 0.06, y: 0.03 });
  // El brazo libre apunta al techo.
  const free = armAt(shoulder, 8);
  return { left: side, right: { ...side, elbow: free.elbow, wrist: free.wrist }, head };
}

function bridge(p) {
  const shoulder = { x: -0.9, y: ANKLE_Y };
  const phi = lerp(0, 26, p);
  const hip = { x: shoulder.x + TORSO * Math.cos(rad(phi)), y: shoulder.y + TORSO * Math.sin(rad(phi)) };
  const ankle = { x: 0, y: ANKLE_Y };
  const knee = bend(hip, ankle, THIGH, SHIN, { x: 0, y: 1 });
  const elbow = { x: shoulder.x + 0.3, y: 0.05 };
  const wrist = { x: shoulder.x + 0.57, y: 0.04 };
  const side = limbs(shoulder, elbow, wrist, hip, knee, ankle, add(ankle, 0.17, -ANKLE_Y));
  return { left: side, right: side, head: { x: shoulder.x - 0.21, y: 0.13 } };
}

function legRaise(p) {
  const hip = { x: 0, y: 0.07 };
  const shoulder = { x: -TORSO, y: 0.07 };
  const theta = rad(lerp(0, 90, p));
  const along = (length) => ({ x: hip.x + length * Math.cos(theta), y: hip.y + length * Math.sin(theta) });
  const knee = along(THIGH);
  const ankle = along(THIGH + SHIN);
  const toe = { x: ankle.x - 0.14 * Math.sin(theta), y: ankle.y + 0.14 * Math.cos(theta) };
  const elbow = { x: shoulder.x + 0.3, y: 0.05 };
  const wrist = { x: shoulder.x + 0.57, y: 0.04 };
  const side = limbs(shoulder, elbow, wrist, hip, knee, ankle, toe);
  return { left: side, right: side, head: { x: shoulder.x - 0.21, y: 0.12 } };
}

function kick(p) {
  const wrist = { x: 0.5, y: 0.03 };
  const shoulder = { x: 0.5, y: 0.6 };
  const hip = { x: -0.05, y: 0.48 };
  const elbow = bend(shoulder, wrist, UPPER, FORE, { x: -1, y: 0 });
  // Pierna de apoyo: rodilla en el piso bajo la cadera, canilla apoyada.
  const supportKnee = { x: hip.x, y: 0.03 };
  const supportAnkle = { x: hip.x - 0.44, y: 0.05 };
  const support = limbs(shoulder, elbow, wrist, hip, supportKnee, supportAnkle, { x: supportAnkle.x - 0.12, y: 0.03 });
  // Pierna que trabaja: el muslo sube hasta la altura de la cadera y la canilla apunta al techo.
  const thigh = rad(lerp(-90, -188, p));
  const knee = { x: hip.x + THIGH * Math.cos(thigh), y: hip.y + THIGH * Math.sin(thigh) };
  const shin = rad(lerp(180, 90, p));
  const ankle = { x: knee.x + SHIN * Math.cos(shin), y: knee.y + SHIN * Math.sin(shin) };
  const toe = { x: ankle.x + 0.12 * Math.cos(shin + Math.PI / 2), y: Math.max(0, ankle.y + 0.12 * Math.sin(shin + Math.PI / 2)) };
  const working = limbs(shoulder, elbow, wrist, hip, knee, ankle, toe);
  return { left: working, right: support, head: { x: shoulder.x + 0.18, y: shoulder.y + 0.04 } };
}

const FIGURES = { squat, lunge, pushup, plank, sidePlank, bridge, legRaise, kick };

/** La figura en `p` (0 = posición de inicio, 1 = punto más profundo de la repetición; las planchas casi no se mueven). */
export function figureAt(id, p) {
  return FIGURES[id](Math.min(1, Math.max(0, p)));
}

/** Ida y vuelta suave 0 → 1 → 0 para una fase en [0, 1). */
export function loop(phase) {
  return (1 - Math.cos(2 * Math.PI * phase)) / 2;
}

/** La figura como los puntos que lee el analizador, para poder comprobar la demo contra las reglas reales. */
export function toLandmarks(figure) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
  const put = (index, point) => {
    lm[index] = { x: 0.5 + point.x * 0.3, y: 0.95 - point.y * 0.3, visibility: 1 };
  };
  const sides = [
    [figure.left, LM.leftShoulder, LM.leftElbow, LM.leftWrist, LM.leftHip, LM.leftKnee, LM.leftAnkle],
    [figure.right, LM.rightShoulder, LM.rightElbow, LM.rightWrist, LM.rightHip, LM.rightKnee, LM.rightAnkle],
  ];
  for (const [side, shoulder, elbow, wrist, hip, knee, ankle] of sides) {
    put(shoulder, side.shoulder);
    put(elbow, side.elbow);
    put(wrist, side.wrist);
    put(hip, side.hip);
    put(knee, side.knee);
    put(ankle, side.ankle);
  }
  put(LM.nose, figure.head);
  return lm;
}

const CUES = {
  squat: { start: 'Arriba: pies al ancho de caderas, pecho alto.', peak: 'Abajo: muslos paralelos al piso, espalda recta.' },
  lunge: { start: 'Arriba: torso derecho, un paso largo.', peak: 'Abajo: las dos rodillas cerca de 90 grados.' },
  pushup: { start: 'Arriba: cuerpo en línea, brazos estirados.', peak: 'Abajo: pecho casi al piso, codos cerca del cuerpo.' },
  plank: { start: 'Cuerpo recto de la cabeza a los talones.', peak: 'No dejes caer la cadera: aguantá.' },
  sidePlank: { start: 'Codo bajo el hombro, cuerpo en línea.', peak: 'Cadera arriba, no la dejes caer.' },
  bridge: { start: 'Abajo: pies firmes, rodillas flexionadas.', peak: 'Arriba: cadera alineada con hombros y rodillas.' },
  legRaise: { start: 'Abajo: piernas estiradas, espalda baja pegada.', peak: 'Arriba: piernas casi a 90 grados, sin doblar rodillas.' },
  kick: { start: 'Abajo: manos bajo los hombros, rodillas bajo la cadera.', peak: 'Arriba: la pierna sube hasta la altura de la cadera.' },
};

export function cuesFor(id) {
  return CUES[id];
}
