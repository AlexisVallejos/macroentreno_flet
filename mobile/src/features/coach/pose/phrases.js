import { FRAMING } from './engine';
import { CENTER, CLOSER, NO_PERSON } from './framing';
import { RULES } from './rules';
import { CHEERS, clipKey, CORRECTIONS, COUNT_MAX, introText, LAST_REP, nextSetText, numberWords, REST_END, SEEN, SETS, setDoneText, splitSentences, summaryText, SUMMARY_MAX } from './script';

/** Lo que probablemente diga una sesión de esta regla, para cargar esos audios mientras la persona se ubica. */
export function phrasesFor(rule, sets = SETS) {
  const texts = [SEEN, REST_END, ...CHEERS, ...LAST_REP];
  for (const n of [5, 10, 15, 20, 25, 30]) texts.push(numberWords(n));
  for (const message of [FRAMING, NO_PERSON, CENTER, CLOSER]) texts.push(...(CORRECTIONS[message] ?? []));
  if (rule) {
    const messages = [...rule.checks.map((check) => check.message), ...(rule.mode === 'reps' ? [rule.shallow] : [])];
    for (const message of messages) texts.push(...(CORRECTIONS[message] ?? []));
    if (rule.mode === 'hold') for (let s = 10; s <= rule.target; s += 10) texts.push(`${numberWords(s)} segundos.`);
  }
  for (let set = 1; set <= sets; set += 1) texts.push(setDoneText(set, sets), nextSetText(set));
  return texts;
}

/**
 * Todas las oraciones que puede decir el entrenador, como claves del pack (`clipKey`). El pack de voz se graba
 * con esta lista; así la voz nunca cae en la del navegador por una frase que falte.
 */
export function allSentences() {
  const keys = new Set();
  const add = (text) => splitSentences(text).forEach((sentence) => keys.add(clipKey(sentence)));

  for (let n = 1; n <= COUNT_MAX; n += 1) add(numberWords(n));
  for (let s = 10; s <= 90; s += 10) add(`${numberWords(s)} segundos.`);
  [...CHEERS, ...LAST_REP, SEEN, REST_END].forEach(add);
  Object.values(CORRECTIONS).flat().forEach(add);

  for (const rule of Object.values(RULES)) add(introText(rule));
  add(introText(null));

  for (let sets = 2; sets <= 6; sets += 1) {
    for (let set = 1; set <= sets; set += 1) add(setDoneText(set, sets));
  }
  for (let set = 1; set <= 6; set += 1) add(nextSetText(set));

  // El resumen final, en partes (una cuenta, las de corregir, un consejo) para que se combinen libremente.
  const squat = RULES.squat;
  const plank = RULES.plank;
  for (let n = 0; n <= SUMMARY_MAX; n += 1) {
    add(summaryText(squat, { reps: n, badReps: 0, holdMs: 0, errors: {} }));
    add(summaryText(squat, { reps: 0, badReps: n, holdMs: 0, errors: {} }));
  }
  for (let seconds = 0; seconds <= 95; seconds += 5) add(summaryText(plank, { reps: 0, badReps: 0, holdMs: seconds * 1000, errors: {} }));
  // Las planchas más largas (varias series) se dicen en minutos y medios, hasta 5 series de 90 segundos.
  for (let halves = 3; halves <= 16; halves += 1) add(summaryText(plank, { reps: 0, badReps: 0, holdMs: Math.max(halves * 30, 100) * 1000, errors: {} }));
  add(summaryText(null, { reps: 0, badReps: 0, holdMs: 0, errors: {} }));

  return [...keys].sort();
}
