import { angle, bestSide, inclination, isAboveLine, JOINTS } from './geometry';

/*
 * Cada regla describe un ejercicio que el analizador sabe juzgar:
 *  - id, name, view ('side' | 'front'), setup (cómo ubicar la cámara)
 *  - required(lm, side): puntos que tienen que verse antes de juzgar nada
 *  - checks: [{ message, joints(lm, side), ok(lm, side) }]. joints son los puntos que se pintan de rojo si falla
 *  - mode 'reps': una repetición va de `rest` a `peak` grados en `metric` y vuelve. `measured` es el ángulo
 *    (tres puntos, el vértice en el medio) que se dibuja en vivo sobre el cuerpo; `shallow` es la corrección
 *    cuando no llega a la profundidad
 *  - mode 'hold': acumula `target` segundos con todos los checks bien
 * Todas las funciones reciben el lado del cuerpo a juzgar: el tracker lo fija para que no cambie entre cuadros
 * en medio de una repetición; si no viene, se usa el lado que la cámara ve mejor en ese momento.
 */

const pick = (lm, s) => JOINTS[s ?? bestSide(lm)];
const at = (lm, [a, b, c]) => angle(lm[a], lm[b], lm[c]);
const knee = (lm, j) => angle(lm[j.hip], lm[j.knee], lm[j.ankle]);
const hip = (lm, j) => angle(lm[j.shoulder], lm[j.hip], lm[j.knee]);
const torso = (lm, s) => {
  const j = pick(lm, s);
  return inclination(lm[j.hip], lm[j.shoulder]);
};
/** Hombro–cadera–tobillo: 180 cuando el cuerpo es una tabla recta. */
const bodyLine = (lm, s) => {
  const j = pick(lm, s);
  return angle(lm[j.shoulder], lm[j.hip], lm[j.ankle]);
};
const hipAbove = (lm, s) => {
  const j = pick(lm, s);
  return isAboveLine(lm[j.hip], lm[j.shoulder], lm[j.ankle]);
};
const lying = (lm, s) => {
  const j = pick(lm, s);
  return inclination(lm[j.ankle], lm[j.shoulder]) > 55;
};
const chain =
  (...names) =>
  (lm, s) => {
    const j = pick(lm, s);
    return names.map((name) => j[name]);
  };
const triple = (a, b, c) => (lm, s) => {
  const j = pick(lm, s);
  return [j[a], j[b], j[c]];
};

/** Las reglas de repeticiones miden un ángulo; `metric` es siempre ese ángulo, así lo que se dibuja es lo que se cuenta. */
const reps = (rule) => ({ ...rule, mode: 'reps', metric: (lm, s) => at(lm, rule.measured(lm, s)) });

/** El torso tiene que mostrarle el costado a la cámara: visto de frente el cuerpo parece corto y todos los ángulos mienten. */
const PROFILE = 'Ponete de costado a la cámara.';
const profile = (min, a, b) => ({
  message: PROFILE,
  joints: () => [],
  ok: (lm, s) => {
    const j = pick(lm, s);
    return Math.abs(lm[j[a]].x - lm[j[b]].x) >= min;
  },
});

const board = (sag, pike) => [
  profile(0.2, 'shoulder', 'ankle'),
  { message: 'Ponete en posición: cuerpo horizontal.', joints: () => [], ok: lying },
  { message: sag, joints: chain('hip'), ok: (lm, s) => bodyLine(lm, s) >= 160 || hipAbove(lm, s) },
  { message: pike, joints: chain('hip'), ok: (lm, s) => bodyLine(lm, s) >= 160 || !hipAbove(lm, s) },
];

export const RULES = {
  squat: reps({
    id: 'squat',
    name: 'Sentadilla',
    view: 'side',
    target: 10,
    setup: 'Ponete de costado a la cámara, a 2–3 metros, que se te vea de la cabeza a los pies.',
    required: chain('shoulder', 'hip', 'knee', 'ankle'),
    measured: triple('hip', 'knee', 'ankle'),
    rest: 160,
    peak: 100,
    shallow: 'Bajá más: muslos paralelos al piso.',
    checks: [{ message: 'Mantené el pecho arriba.', joints: chain('shoulder', 'hip'), ok: (lm, s) => torso(lm, s) < 50 }],
  }),
  lunge: reps({
    id: 'lunge',
    name: 'Estocada',
    view: 'side',
    target: 10,
    setup: 'De costado a la cámara, con lugar para dar un paso largo hacia adelante.',
    required: chain('shoulder', 'hip', 'knee', 'ankle'),
    // Se doblan las dos piernas: la más flexionada es la que marca la profundidad.
    measured: (lm) => {
      const j = knee(lm, JOINTS.left) <= knee(lm, JOINTS.right) ? JOINTS.left : JOINTS.right;
      return [j.hip, j.knee, j.ankle];
    },
    rest: 160,
    peak: 105,
    shallow: 'Bajá más: la rodilla de atrás cerca del piso.',
    checks: [{ message: 'Torso erguido.', joints: chain('shoulder', 'hip'), ok: (lm, s) => torso(lm, s) < 30 }],
  }),
  pushup: reps({
    id: 'pushup',
    name: 'Flexión de brazos',
    view: 'side',
    target: 10,
    setup: 'Cámara al costado y a la altura del piso, que se vea el cuerpo entero.',
    required: chain('shoulder', 'elbow', 'wrist', 'hip', 'ankle'),
    measured: triple('shoulder', 'elbow', 'wrist'),
    rest: 155,
    peak: 95,
    shallow: 'Bajá el pecho más cerca del piso.',
    checks: [profile(0.2, 'shoulder', 'ankle'), { message: 'Cuerpo recto: alineá la cadera.', joints: chain('hip'), ok: (lm, s) => bodyLine(lm, s) > 150 }],
  }),
  plank: {
    id: 'plank',
    name: 'Plancha',
    mode: 'hold',
    view: 'side',
    target: 30,
    setup: 'Cámara al costado y a la altura del piso. Apoyá antebrazos y puntas de los pies.',
    required: chain('shoulder', 'hip', 'ankle'),
    checks: board('Subí la cadera.', 'Bajá la cadera.'),
  },
  sidePlank: {
    id: 'sidePlank',
    name: 'Plancha lateral',
    mode: 'hold',
    view: 'front',
    target: 30,
    setup: 'Mirando a la cámara, apoyado en un antebrazo, con el cuerpo cruzando la pantalla.',
    required: chain('shoulder', 'hip', 'ankle'),
    checks: board('No dejes caer la cadera.', 'Bajá un poco la cadera.'),
  },
  bridge: reps({
    id: 'bridge',
    name: 'Puente de glúteo',
    view: 'side',
    target: 12,
    setup: 'Acostate boca arriba de costado a la cámara, rodillas flexionadas y pies apoyados.',
    required: chain('shoulder', 'hip', 'knee'),
    measured: triple('shoulder', 'hip', 'knee'),
    rest: 135,
    peak: 165,
    shallow: 'Subí más la cadera, hasta alinearla con hombros y rodillas.',
    checks: [profile(0.1, 'shoulder', 'hip')],
  }),
  legRaise: reps({
    id: 'legRaise',
    name: 'Elevación de piernas',
    view: 'side',
    target: 10,
    setup: 'Acostate boca arriba de costado a la cámara, con las piernas estiradas.',
    required: chain('shoulder', 'hip', 'knee', 'ankle'),
    measured: triple('shoulder', 'hip', 'ankle'),
    rest: 160,
    peak: 110,
    shallow: 'Subí las piernas hasta casi 90°.',
    checks: [profile(0.1, 'shoulder', 'hip'), { message: 'Piernas más estiradas.', joints: chain('knee'), ok: (lm, s) => knee(lm, pick(lm, s)) > 140 }],
  }),
  kick: reps({
    id: 'kick',
    name: 'Patada de glúteo',
    view: 'side',
    target: 12,
    setup: 'En cuadrupedia (manos y rodillas), de costado a la cámara.',
    required: chain('shoulder', 'hip', 'knee'),
    // La pierna que patea es la de la cadera abierta, sea del lado que sea.
    measured: (lm) => {
      const j = hip(lm, JOINTS.left) >= hip(lm, JOINTS.right) ? JOINTS.left : JOINTS.right;
      return [j.shoulder, j.hip, j.knee];
    },
    rest: 110,
    peak: 150,
    shallow: 'Elevá más la pierna, hasta la altura de la cadera.',
    checks: [profile(0.1, 'shoulder', 'hip')],
  }),
};
