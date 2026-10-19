import { RULES } from './pose/rules';

/** Sin tildes y en minúsculas, para comparar nombres de ejercicios escritos de cualquier forma. */
export const fold = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const exercise = (rule, name, group, muscles, icon, lines, tip, easier) => ({ rule, name, group, muscles, icon, lines, tip, easier });

/** Ejercicios con análisis de postura (los mismos de SpotSport). Se hacen sin equipo, frente a la cámara. */
export const COACH_EXERCISES = [
  exercise('squat', 'Sentadilla profunda', 'Piernas', ['Cuádriceps', 'Glúteos'], 'body', ['Pies al ancho de caderas, puntas apenas abiertas.', 'Llevá las caderas atrás y abajo.', 'Bajá manteniendo el pecho arriba.', 'Subí empujando con talones.'], 'Las rodillas acompañan la dirección de los pies.', 'Bajá hasta un rango cómodo.'),
  exercise('lunge', 'Estocadas', 'Piernas', ['Cuádriceps', 'Glúteos'], 'walk', ['Da un paso largo hacia adelante.', 'Bajá la rodilla trasera cerca del piso.', 'Volvé y alterná piernas.'], 'Mantené el torso vertical.', 'Sujetate de una pared.'),
  exercise('pushup', 'Flexiones de brazos', 'Pecho', ['Pecho', 'Tríceps'], 'barbell', ['Manos al ancho de hombros.', 'Formá una línea recta de talones a cabeza.', 'Bajá el pecho hacia el piso con los codos cerca del cuerpo.', 'Empujá hasta extender los brazos.'], 'Priorizá técnica antes que velocidad.', 'Hacelas desde rodillas.'),
  exercise('plank', 'Plancha abdominal', 'Abdomen', ['Abdomen'], 'timer', ['Apoyá antebrazos y puntas de los pies.', 'Mantené cabeza, caderas y talones en una línea.', 'Sostené 30 segundos sin dejar caer la cadera.'], 'Contraé el abdomen todo el tiempo.', 'Apoyá las rodillas.'),
  exercise('sidePlank', 'Plancha lateral', 'Abdomen', ['Oblicuos', 'Abdomen'], 'timer', ['Apoyá antebrazo y codo debajo del hombro.', 'Elevá caderas hasta formar una línea recta.', 'Sostené y repetí del otro lado.'], 'No dejes caer la cadera.', 'Apoyá las rodillas.'),
  exercise('bridge', 'Puente de glúteo', 'Piernas', ['Glúteos', 'Isquiotibiales'], 'trending-up', ['Acostate boca arriba con las rodillas flexionadas.', 'Pies firmes en el piso.', 'Empujá con talones y elevá caderas.', 'Contraé glúteos arriba y bajá controlado.'], 'No hiperextiendas la espalda.', 'Reducí el rango de movimiento.'),
  exercise('legRaise', 'Levantamiento de piernas', 'Abdomen', ['Abdomen'], 'arrow-up', ['Acostate con las palmas apoyadas al costado.', 'Subí ambas piernas hasta 90 grados.', 'Bajá lento sin apoyar los pies.'], 'Mantené la espalda baja cerca del piso.', 'Flexioná ligeramente las rodillas.'),
  exercise('kick', 'Patada de glúteo', 'Piernas', ['Glúteos'], 'flash', ['En cuadrupedia, alineá manos y hombros.', 'Elevá una pierna doblada a 90 grados.', 'Contraé arriba y bajá sin tocar el piso.', 'Cambiá de pierna al terminar.'], 'El movimiento es pequeño y controlado.', 'Reducí el rango.'),
];

export const coachExercise = (ruleId) => COACH_EXERCISES.find((e) => e.rule === ruleId) ?? null;

/** El orden importa: gana el primer patrón que coincide ("plancha lateral" antes que "plancha"). */
const PATTERNS = [
  [/plancha (lateral|de lado)|side plank/, 'sidePlank'],
  [/plancha|plank/, 'plank'],
  [/sentadilla|squat/, 'squat'],
  [/estocada|zancada|lunge/, 'lunge'],
  [/puente|hip thrust|glute bridge/, 'bridge'],
  [/(elevacion|levantamiento)(es)? de piernas|leg raise/, 'legRaise'],
  [/patadas? (de gluteo|traseras?|de burro)|donkey kick/, 'kick'],
  [/\bflexion|push.?up|lagartija/, 'pushup'],
];

/** "Flexión" también nombra curls, inclinaciones, estiramientos y verticales: esos no son flexiones de brazos. */
const NOT_PUSHUP = /biceps|rodilla|pierna|plantar|cadera|muneca|tronco|isquio|femoral|nordic|curl|lateral|pino|burpee|estiramiento|escapular/;

/** La regla de análisis que corresponde a un ejercicio por su nombre, o null si la cámara no lo sabe juzgar. */
export function ruleFor(name) {
  const text = fold(name ?? '');
  for (const [pattern, id] of PATTERNS) {
    if (!pattern.test(text)) continue;
    if (id === 'pushup' && NOT_PUSHUP.test(text)) return null;
    return RULES[id];
  }
  return null;
}
