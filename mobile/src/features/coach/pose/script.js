import { FRAMING } from './engine';
import { CENTER, CLOSER, NO_PERSON } from './framing';

// Lo que el entrenador dice en voz alta. Cada línea es { text, urgent }: urgent corta lo que se esté diciendo.

const UNITS = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const TENS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];

/** Números en palabras de 0 a 99 ("veinticuatro", "treinta y uno"); `feminine` cambia "uno" por "una". */
export function numberWords(n, feminine = false) {
  if (!Number.isInteger(n) || n < 0 || n > 99) return String(n);
  const text = n < 30 ? UNITS[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ` y ${UNITS[n % 10]}` : '');
  return feminine ? text.replace(/uno$/, 'una') : text;
}

const word = (n) => numberWords(n);
const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/** Series por defecto de una sesión (se pueden elegir de 1 a 5). */
export const SETS = 3;

// Un entrenador que habla todo el tiempo cansa: pocas palabras y espaciadas. La cuenta está grande en pantalla, no se lee.
/** Tiempo mínimo entre dos frases (los cambios de serie y el resumen no esperan). */
const MIN_GAP_MS = 4500;
const SAME_WORDS_MS = 10_000;
const FRAMING_MS = 15_000;
/** Recién prendida la cámara la persona todavía está en la compu: "no te veo" sería apurado. */
const NO_PERSON_GRACE_MS = 6000;
const HOLD_WARN_MS = 12_000;

export const CHEERS = ['¡Muy bien!', '¡Eso es!', '¡Así, bárbaro!', '¡Buenísimo!'];
export const LAST_REP = ['¡Una más!', 'Una más, dale.'];
export const SEEN = 'Dale, ya te veo.';
export const REST_END = 'Dale, arrancamos.';
export const PLACE_SIDE = 'Ponete de costado a la cámara.';
export const PLACE_FRONT = 'Ponete de frente a la cámara.';
export const PLACE_ANY = 'Ubicate para que se te vea entero.';

/** Versiones habladas (voseo, argentinismos) de las correcciones en pantalla: cortas, una idea. Lo que falta se lee como está escrito. */
export const CORRECTIONS = {
  [FRAMING]: ['Alejate un poco.', 'Pará, alejate un poquito.'],
  [NO_PERSON]: ['No te veo.', 'No te veo, ubicate en cámara.'],
  [CENTER]: ['Correte al centro.', 'Un poco más al centro.'],
  [CLOSER]: ['Acercate un poco.', 'Acercate un poquito.'],
  'Ponete de costado a la cámara.': ['Ponete de costado a la cámara.', 'Girate, de costado.'],
  'Mantené el pecho arriba.': ['Pecho arriba.', 'Subí el pecho.'],
  'Bajá más: muslos paralelos al piso.': ['Bajá un poco más.', 'Dale, más abajo.'],
  'Bajá más: la rodilla de atrás cerca del piso.': ['Bajá un poco más.', 'Más abajo, dale.'],
  'Torso erguido.': ['Torso derecho.', 'Subí el pecho.'],
  'Bajá el pecho más cerca del piso.': ['Bajá un poco más.', 'Más cerca del piso.'],
  'Cuerpo recto: alineá la cadera.': ['Cuerpo derecho.', 'Alineá la cadera.'],
  'Ponete en posición: cuerpo horizontal.': ['Ponete en posición.'],
  'Subí la cadera.': ['Subí la cadera.', 'Cadera arriba.'],
  'Bajá la cadera.': ['Bajá la cadera.', 'Un poco más abajo.'],
  'No dejes caer la cadera.': ['No dejes caer la cadera.', 'Cadera arriba.'],
  'Bajá un poco la cadera.': ['Bajá un poquito la cadera.'],
  'Subí más la cadera, hasta alinearla con hombros y rodillas.': ['Subí más la cadera.', 'Dale, empujá más.'],
  'Subí las piernas hasta casi 90°.': ['Subí más las piernas.', 'Dale, un poco más.'],
  'Piernas más estiradas.': ['Estirá las piernas.', 'Piernas estiradas.'],
  'Elevá más la pierna, hasta la altura de la cadera.': ['Subí más la pierna.', 'Un poco más arriba.'],
};

/** Símbolos y rangos que los motores de voz leen mal. */
export function forSpeech(text) {
  return text
    .replace(/(\d)\s*[–—-]\s*(\d)/g, '$1 o $2')
    .replace(/\s*[–—]\s*/g, ', ')
    .replace(/°/g, ' grados')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Divide una línea en oraciones: cada una es un audio del pack de voz. */
export function splitSentences(text) {
  return forSpeech(text)
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** La clave de una oración en el pack de voz: el texto hablado sin el punto final. */
export function clipKey(sentence) {
  return sentence.trim().replace(/\.$/, '');
}

/**
 * Decide, cuadro a cuadro, qué diría un entrenador… y casi siempre se calla.
 * Habla: que te ve (una vez), una corrección después de una repetición mal hecha, "una más", cada cinco
 * repeticiones, los segundos de una plancha. Puro (sin audio ni DOM): la pantalla le pasa estados y reproduce lo que vuelve.
 */
export function createNarrator(rule) {
  let seen = false;
  let reps = 0;
  let badReps = 0;
  let tens = 0;
  let spoken = {};
  let used = {};
  let lastLine = -Infinity;
  let startedAt = null;

  function reset() {
    startedAt = null;
    seen = false;
    reps = 0;
    badReps = 0;
    tens = 0;
    spoken = {};
    used = {};
    lastLine = -Infinity;
  }

  /** Las mismas palabras de nuevo solo después de una pausa. */
  function fresh(text, now, wait = SAME_WORDS_MS) {
    const before = spoken[text];
    if (before !== undefined && now - before < wait) return false;
    spoken[text] = now;
    return true;
  }

  /** La siguiente variante de una lista, para que la misma situación no suene siempre igual. */
  function rotate(key, options) {
    const index = used[key] ?? 0;
    used[key] = index + 1;
    return options[index % options.length];
  }

  function correction(message) {
    const options = CORRECTIONS[message];
    return options ? rotate(message, options) : message;
  }

  /** Una frase solo se dice si el entrenador no acaba de hablar. */
  function say(text, now) {
    lastLine = now;
    return { text, urgent: false };
  }
  const quiet = (now) => now - lastLine < MIN_GAP_MS;

  function update(state, now) {
    startedAt ??= now;
    if (state.status === 'framing') {
      // Los consejos de encuadre se dicen solo si tienen versión hablada, y no de nuevo por un rato.
      const early = state.message === NO_PERSON && now - startedAt < NO_PERSON_GRACE_MS;
      if (state.tone === 'warn' && CORRECTIONS[state.message] && !early && !quiet(now) && fresh(state.message, now, FRAMING_MS)) return say(correction(state.message), now);
      return null;
    }

    if (!seen) {
      seen = true;
      return say(SEEN, now);
    }

    // Una serie nueva reinicia el tracker: los contadores vuelven a cero sin anunciar nada.
    if (state.reps < reps) reps = state.reps;
    if (state.badReps < badReps) badReps = state.badReps;
    if (state.holdMs < tens * 10_000) tens = Math.floor(state.holdMs / 10_000);

    if (state.badReps > badReps) {
      badReps = state.badReps;
      return !quiet(now) && fresh(state.message, now) ? say(correction(state.message), now) : null;
    }

    if (state.reps > reps) {
      reps = state.reps;
      if (quiet(now)) return null;
      if (rule?.mode === 'reps' && rule.target > 1 && reps === rule.target - 1) return say(rotate('last', LAST_REP), now);
      if (reps % 10 === 0) return say(`${word(reps)}. ${rotate('cheer', CHEERS)}`, now);
      if (reps % 5 === 0) return say(word(reps), now);
      return null;
    }

    if (rule?.mode === 'hold') {
      if (state.tone === 'warn' && state.message && !quiet(now) && fresh(state.message, now, HOLD_WARN_MS)) return say(correction(state.message), now);
      const seconds = Math.floor(state.holdMs / 1000);
      if (Math.floor(seconds / 10) > tens) {
        tens = Math.floor(seconds / 10);
        return say(`${word(seconds)} segundos.`, now);
      }
    }

    return null;
  }

  return { update, reset };
}

/**
 * Lo que se lee al abrir la preparación: dos oraciones cortas, qué hacemos y dónde ubicarse. La distancia, los pasos
 * y las series están en pantalla y en la demo 3D, así que no se leen. Nunca incluye nombres ni textos de afuera,
 * así cada oración puede estar grabada de antemano.
 */
export function introText(rule) {
  if (!rule) return forSpeech(`Vamos. ${PLACE_ANY}`);
  const name = `${rule.name.charAt(0).toLowerCase()}${rule.name.slice(1)}`;
  return forSpeech(`Vamos con ${name}. ${rule.view === 'side' ? PLACE_SIDE : PLACE_FRONT}`);
}

export function setDoneText(set, sets) {
  if (set >= sets) return `Muy bien, serie ${word(set)} lista.`;
  return `Muy bien, serie ${word(set)} lista. Descansá.`;
}

/** Lo que se dice al arrancar la serie siguiente, nombrándola una vez para que quede claro dónde estás. */
export function nextSetText(set) {
  return `${REST_END} Serie ${word(set)}.`;
}

/** Cuentas dichas durante una serie ("cinco", "diez"…): el objetivo llega hasta 30. */
export const COUNT_MAX = 40;
/** Totales del resumen: hasta 5 series de 20 entran en palabras por debajo de 100. */
export const SUMMARY_MAX = 99;

/** Cuánto duró una plancha, como lo diría una persona: segundos hasta 95, después minutos y medios. */
function holdLine(seconds) {
  if (seconds < 3) return 'Casi no aguantaste, probemos de nuevo.';
  if (seconds < 97.5) return `Aguantaste unos ${word(Math.max(5, Math.round(seconds / 5) * 5))} segundos.`;
  const halves = Math.round(seconds / 30);
  const whole = Math.floor(halves / 2);
  const half = halves % 2 === 1 ? ' y medio' : '';
  return whole === 1 ? `Aguantaste un minuto${half}.` : `Aguantaste unos ${word(whole)} minutos${half}.`;
}

export function summaryText(rule, totals) {
  if (!rule) return 'Listo, terminaste.';
  const worst = Object.entries(totals.errors).sort((a, b) => b[1] - a[1])[0];
  const learned = worst ? ` ${CORRECTIONS[worst[0]]?.[0] ?? worst[0]}` : '';
  if (rule.mode === 'hold') return `Listo, terminaste. ${holdLine(totals.holdMs / 1000)}${learned}`;
  const reps = Math.min(SUMMARY_MAX, totals.reps);
  const bad = Math.min(SUMMARY_MAX, totals.badReps);
  const good = reps === 0 ? 'Ninguna repetición bien hecha.' : reps === 1 ? 'Una repetición bien hecha.' : `${capital(numberWords(reps, true))} repeticiones bien hechas.`;
  const fix = bad === 0 ? '' : ` ${capital(numberWords(bad, true))} para corregir.`;
  return `Listo, terminaste. ${good}${fix}${learned}`;
}
