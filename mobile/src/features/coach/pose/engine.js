import { checkFraming, STEP_BACK } from './framing';
import { bestSide, isVisible, sideScore } from './geometry';

/*
 * Estado del tracker en cada cuadro:
 *  - status: 'framing' (todavía no se ve bien el cuerpo) | 'active'
 *  - ready: false hasta que la persona mantiene la posición de inicio un momento; antes no cuenta nada
 *  - reps / badReps: repeticiones que contaron y las que llegaron abajo con mala técnica o quedaron a medias
 *  - holdMs: tiempo sostenido con buena postura (modo 'hold')
 *  - progress: 0–1, qué tan adentro de la repetición actual está (modo 'reps')
 *  - message / tone ('ok' | 'warn' | 'info'): qué decirle ahora
 *  - failing: puntos a pintar de rojo · errors: cuántas veces se dio cada corrección
 *  - missing: partes del cuerpo que la cámara no ve, mientras encuadra
 *  - side: el lado del cuerpo que se juzga, fijo para que no cambie en medio de una repetición
 *  - log: cada repetición de la serie, en orden: { ok, ms }
 */

export const FRAMING = STEP_BACK;
export const GET_READY = 'Ponete en posición de inicio y quedate quieto un segundo.';
export const GO = '¡Listo! Arrancá cuando quieras.';

const SMOOTHING = 5;
const BAD_FRAMES = 3;
const REP_START = 0.25;
const REP_END = 0.1;
const PARTIAL = 0.35;
const MAX_STEP_MS = 200;
/** Tiempo en la posición de inicio antes de empezar a contar (así sentarse o entrar caminando no cuenta). */
const ARM_MS = 1000;
const HOLD_ARM_MS = 800;
/** Una repetición real tarda más que esto; más rápido es ruido o un sacudón. */
const MIN_REP_MS = 600;
/** Los puntos tienen que verse así de bien para confiar en ellos: un tobillo adivinado da ángulos locos. */
const MIN_VISIBILITY = 0.6;
/**
 * Una vez que sigue un cuerpo, alcanza con una vara más baja: abajo de la sentadilla las rodillas y los tobillos
 * se pliegan y su visibilidad baja, justo cuando se decide la profundidad.
 */
const KEEP_VISIBILITY = 0.4;
/** Un cuadro no puede mover un ángulo más que esto: es una falla de detección, no una persona. */
const MAX_JUMP = 55;
/** Una mano que cruza un momento delante de la rodilla no hace perder la repetición en curso. */
const LOST_GRACE_MS = 600;
/** El otro lado tiene que verse así de mejor (escala 0–4), por este tiempo, antes de cambiar de lado. */
const SIDE_MARGIN = 0.5;
const SIDE_SWITCH_MS = 400;

const clamp = (value) => Math.min(1, Math.max(0, value));
const bump = (errors, key) => ({ ...errors, [key]: (errors[key] ?? 0) + 1 });
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

function initial(rule) {
  return {
    status: 'framing',
    ready: false,
    reps: 0,
    badReps: 0,
    holdMs: 0,
    progress: 0,
    message: rule.mode === 'hold' ? 'Ponete en posición.' : 'Empezá cuando quieras.',
    tone: 'info',
    failing: [],
    errors: {},
    missing: [],
    side: null,
    log: [],
  };
}

export function isSetDone(rule, state) {
  return rule.mode === 'reps' ? state.reps >= rule.target : state.holdMs >= rule.target * 1000;
}

/** Convierte una seguidilla de poses en repeticiones, tiempo sostenido y correcciones. Puro: sin cámara ni DOM. */
export function createTracker(rule) {
  let state = initial(rule);
  let recent = [];
  let lastRaw = null;
  let armedAt = null;
  let armed = false;
  let moving = false;
  let moveStart = 0;
  let deepest = 0;
  let faults = {};
  let last = null;
  let lastFault = '';
  let lastSeen = null;
  let side = null;
  let challengerSince = null;

  /** Pide de nuevo la posición de inicio sin perder la cuenta (después de una pausa). */
  function rearm() {
    recent = [];
    lastRaw = null;
    armedAt = null;
    armed = false;
    moving = false;
    deepest = 0;
    faults = {};
    lastFault = '';
  }

  function reset() {
    rearm();
    state = initial(rule);
    last = null;
    lastSeen = null;
    side = null;
    challengerSince = null;
  }

  function lose(lm) {
    rearm();
    lastSeen = null;
    side = null;
    challengerSince = null;
    const framing = checkFraming(lm, lm ? rule.required(lm, bestSide(lm)) : [], MIN_VISIBILITY);
    state = { ...state, status: 'framing', ready: false, message: framing.message || FRAMING, tone: 'warn', failing: [], missing: framing.missing, side: null };
    return state;
  }

  /** Sigue juzgando el mismo lado salvo que el otro se vea claramente mejor por un rato. */
  function lockSide(lm, now) {
    if (!side) return (side = bestSide(lm));
    const other = side === 'left' ? 'right' : 'left';
    if (sideScore(lm, other) - sideScore(lm, side) > SIDE_MARGIN) {
      challengerSince ??= now;
      if (now - challengerSince >= SIDE_SWITCH_MS) {
        side = other;
        challengerSince = null;
        // Los ángulos del otro lado son otra serie: el suavizado empieza de nuevo.
        recent = [];
        lastRaw = null;
      }
    } else {
      challengerSince = null;
    }
    return side;
  }

  function update(lm, now) {
    const step = last === null ? 0 : Math.min(MAX_STEP_MS, Math.max(0, now - last));
    last = now;

    const s = lm ? lockSide(lm, now) : null;
    const bar = state.status === 'active' ? KEEP_VISIBILITY : MIN_VISIBILITY;
    if (!lm || !s || !rule.required(lm, s).every((index) => isVisible(lm, index, bar))) {
      // Una pérdida breve deja todo como estaba; no se juzga nada hasta que vuelve el cuerpo.
      if (state.status === 'active' && lastSeen !== null && now - lastSeen < LOST_GRACE_MS) return state;
      return lose(lm);
    }
    lastSeen = now;

    const failed = rule.checks.filter((check) => !check.ok(lm, s));
    const failing = [...new Set(failed.flatMap((check) => check.joints(lm, s)))];

    // ── Posiciones sostenidas ──
    if (rule.mode === 'hold') {
      if (failed.length > 0) {
        armedAt = null;
        const message = failed[0].message;
        const errors = armed && message !== lastFault ? bump(state.errors, message) : state.errors;
        lastFault = message;
        // Se perdió la postura: el reloj para y hay que ganárselo de nuevo con un momento de buena técnica.
        armed = false;
        state = { ...state, status: 'active', ready: false, message, tone: 'warn', failing, errors, missing: [], side: s };
        return state;
      }
      lastFault = '';
      if (!armed) {
        armedAt ??= now;
        if (now - armedAt < HOLD_ARM_MS) {
          state = { ...state, status: 'active', ready: false, message: GET_READY, tone: 'info', failing: [], missing: [], side: s };
          return state;
        }
        armed = true;
      }
      state = { ...state, status: 'active', ready: true, holdMs: state.holdMs + step, message: '¡Bien! Mantené así.', tone: 'ok', failing: [], missing: [], side: s };
      return state;
    }

    // ── Repeticiones ──
    const raw = rule.metric(lm, s);
    if (lastRaw !== null && Math.abs(raw - lastRaw) > MAX_JUMP) {
      // Un cuadro lejos del anterior: se espera que un segundo cuadro coincida antes de creerle.
      lastRaw = raw;
      return state;
    }
    lastRaw = raw;
    recent.push(raw);
    if (recent.length > SMOOTHING) recent.shift();
    const progress = clamp((rule.rest - median(recent)) / (rule.rest - rule.peak));
    let { reps, badReps, errors, message, tone, log } = state;

    if (!armed) {
      if (progress < REP_END && failed.length === 0) {
        armedAt ??= now;
        if (now - armedAt >= ARM_MS) armed = true;
      } else {
        armedAt = null;
      }
      if (!armed) {
        state = { ...state, status: 'active', ready: false, progress: 0, message: GET_READY, tone: 'info', failing, missing: [], side: s };
        return state;
      }
      // Si no, el "ponete en posición" quedaría en pantalla durante toda la primera repetición.
      message = GO;
      tone = 'info';
    }

    if (moving) for (const check of failed) faults[check.message] = (faults[check.message] ?? 0) + 1;

    if (!moving && progress > REP_START) {
      moving = true;
      moveStart = now;
      deepest = progress;
      faults = {};
    } else if (moving) {
      deepest = Math.max(deepest, progress);
      if (progress < REP_END) {
        moving = false;
        const ms = now - moveStart;
        if (ms >= MIN_REP_MS) {
          const fault = Object.keys(faults).find((key) => faults[key] >= BAD_FRAMES);
          if (deepest >= 1 && !fault) {
            reps += 1;
            log = [...log, { ok: true, ms }];
            message = `¡Bien! Van ${reps}.`;
            tone = 'ok';
          } else if (deepest >= 1 && fault) {
            badReps += 1;
            log = [...log, { ok: false, ms }];
            errors = bump(errors, fault);
            message = fault;
            tone = 'warn';
          } else if (deepest >= PARTIAL) {
            badReps += 1;
            log = [...log, { ok: false, ms }];
            errors = bump(errors, rule.shallow);
            message = rule.shallow;
            tone = 'warn';
          }
        }
      }
    }

    if (moving && failed.length > 0) {
      message = failed[0].message;
      tone = 'warn';
    }

    state = { ...state, status: 'active', ready: true, reps, badReps, errors, message, tone, progress, failing, missing: [], side: s, log };
    return state;
  }

  return { update, reset, rearm };
}
