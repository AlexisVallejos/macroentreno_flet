import { clipKey, forSpeech, splitSentences } from './pose/script';

// La voz del entrenador.
// 1) Pack de audios grabados con Piper (voz neuronal argentina, public/voice/es_AR): suena natural, sin demora y sin internet.
// 2) Si falta el pack, o una frase no está grabada, la voz del navegador (speechSynthesis) como respaldo.

const PREF_KEY = 'macroentreno:coach:voz';
const PACK_URL = '/voice/es_AR/';
const SENTENCE_GAP_MS = 600;
/** Rioplatense primero, después el resto de Latinoamérica, después España. */
const LATAM = ['es-ar', 'es-mx', 'es-us', 'es-419'];

// ───────────────────────── voz del navegador (respaldo) ─────────────────────────

const norm = (lang) => lang.toLowerCase().replace('_', '-');

/** Las voces "Online (Natural)" de Microsoft y otras neuronales: las que no suenan a robot. */
const NEURAL = /natural|neural/i;

/**
 * La mejor voz en español que tenga el navegador. Primero la calidad (neuronal, después en la nube, después la
 * local básica) y, a igual calidad, el acento más cercano al argentino. `failed` tiene las voces que ya fallaron.
 */
export function pickVoice(voices, failed = new Set()) {
  const spanish = voices.filter((voice) => norm(voice.lang).startsWith('es') && !failed.has(voice.name));
  if (spanish.length === 0) return null;
  const rank = (voice) => {
    const quality = NEURAL.test(voice.name) ? 0 : voice.localService ? 2 : 1;
    const lang = norm(voice.lang);
    const accent = lang === 'es-ar' ? 0 : LATAM.includes(lang) ? 1 : lang === 'es-es' ? 2 : 3;
    return quality * 4 + accent;
  };
  return [...spanish].sort((a, b) => rank(a) - rank(b))[0];
}

const hasBrowserVoice = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
const hasAudio = () => typeof window !== 'undefined' && typeof AudioContext !== 'undefined';

export function voiceSupported() {
  return hasAudio() || hasBrowserVoice();
}

export function readVoicePref() {
  try {
    return localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function writeVoicePref(on) {
  try {
    localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
  } catch {
    // Sin storage: la preferencia dura hasta recargar.
  }
}

// ───────────────────────── pack grabado ─────────────────────────

let packLoad = null;
let context = null;
const buffers = new Map();

/** El servidor de desarrollo contesta un archivo que falta con index.html: un error al leer el JSON es "no hay pack". */
function loadPack() {
  packLoad ??= fetch(`${PACK_URL}manifest.json`)
    .then(async (response) => {
      if (!response.ok) return null;
      const manifest = await response.json();
      return manifest && typeof manifest.clips === 'object' ? manifest : null;
    })
    .catch(() => null);
  return packLoad;
}

function audio() {
  if (!hasAudio()) return null;
  context ??= new AudioContext();
  if (context.state === 'suspended') void context.resume();
  return context;
}

function clip(key, pack) {
  const hit = buffers.get(key);
  if (hit) return hit;
  const loaded = (async () => {
    const ctx = audio();
    if (!ctx) throw new Error('no audio');
    const response = await fetch(`${PACK_URL}${pack.clips[key]}`);
    if (!response.ok) throw new Error(`clip ${response.status}`);
    return await ctx.decodeAudioData(await response.arrayBuffer());
  })();
  loaded.catch(() => buffers.delete(key));
  buffers.set(key, loaded);
  return loaded;
}

/** Carga los audios de antemano, así la cuenta y las correcciones salen sin esperar a la red. */
export function warmVoice(texts) {
  void loadPack().then((pack) => {
    if (!pack) return;
    for (const text of texts) {
      for (const key of splitSentences(text).map(clipKey)) if (pack.clips[key]) clip(key, pack).catch(() => {});
    }
  });
}

// ───────────────────────── reproducción ─────────────────────────
// Un "job" es una cosa para decir: avisa cuando termina y registra cómo cortarla.

let ticket = 0;
let busy = false;
let stopCurrent = null;
let waiting = null;
/** Sube con stopSpeaking para descartar las frases pedidas antes que todavía esperaban al pack. */
let epoch = 0;

function start(job) {
  const mine = ++ticket;
  busy = true;
  const isCurrent = () => ticket === mine;
  job(isCurrent, (stop) => {
    if (isCurrent()) stopCurrent = stop;
  })
    .catch(() => {})
    .finally(() => {
      if (!isCurrent()) return;
      busy = false;
      stopCurrent = null;
      const next = waiting;
      waiting = null;
      if (next) start(next);
    });
}

/** Lo urgente corta lo que se está diciendo; si no, espera su turno (solo se guarda la última frase en espera). */
function enqueue(job, urgent) {
  if (urgent) {
    waiting = null;
    stopCurrent?.();
    start(job);
    return;
  }
  if (busy) waiting = job;
  else start(job);
}

function packJob(keys, pack) {
  return async (isCurrent, register) => {
    const ctx = audio();
    if (!ctx) return;
    const loading = keys.map((key) => clip(key, pack));
    let stopped = false;
    let playing = null;
    register(() => {
      stopped = true;
      try {
        playing?.stop();
      } catch {
        // Ya había terminado.
      }
    });
    for (const [index, pending] of loading.entries()) {
      const buffer = await pending;
      if (stopped || !isCurrent()) return;
      await new Promise((resolve) => {
        const source = ctx.createBufferSource();
        playing = source;
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.onended = () => resolve();
        source.start();
      });
      // Un respiro entre oraciones, para que una frase no salga de un tirón.
      if (index < loading.length - 1 && !stopped) await new Promise((resolve) => setTimeout(resolve, SENTENCE_GAP_MS));
    }
  };
}

const RETRYABLE = new Set(['network', 'synthesis-unavailable', 'synthesis-failed', 'voice-unavailable', 'language-unavailable']);
const failedVoices = new Set();
let browserVoice = null;

function browserJob(text) {
  return (_isCurrent, register) =>
    new Promise((resolve) => {
      if (!hasBrowserVoice()) {
        resolve();
        return;
      }
      const synth = window.speechSynthesis;
      register(() => {
        synth.cancel();
        resolve();
      });
      const say = (attempt) => {
        browserVoice ??= pickVoice(synth.getVoices(), failedVoices);
        const picked = browserVoice;
        const utterance = new SpeechSynthesisUtterance(forSpeech(text));
        utterance.lang = picked?.lang ?? 'es-AR';
        if (picked) utterance.voice = picked;
        utterance.onend = () => resolve();
        utterance.onerror = (event) => {
          if (!RETRYABLE.has(event.error) || attempt >= 3) {
            resolve();
            return;
          }
          // Voz en línea sin internet o rota: se descarta y se reintenta con la siguiente mejor.
          if (picked) failedVoices.add(picked.name);
          browserVoice = null;
          say(attempt + 1);
        };
        synth.speak(utterance);
      };
      say(0);
    });
}

/** Dice `text` con la voz del entrenador. */
export function speak(text, urgent = false) {
  if (!text || !voiceSupported()) return;
  const asked = epoch;
  void loadPack().then((pack) => {
    if (asked !== epoch) return;
    const keys = splitSentences(text).map(clipKey);
    // La frase entera del pack o entera del navegador: nunca dos voces en una oración.
    const recorded = pack !== null && hasAudio() && keys.length > 0 && keys.every((key) => pack.clips[key]);
    enqueue(recorded ? packJob(keys, pack) : browserJob(text), urgent);
  });
}

export function stopSpeaking() {
  epoch += 1;
  ticket += 1;
  busy = false;
  waiting = null;
  stopCurrent?.();
  stopCurrent = null;
  if (hasBrowserVoice()) window.speechSynthesis.cancel();
}

if (hasBrowserVoice()) {
  // Chrome carga la lista de voces tarde: se vuelve a elegir cuando está lista.
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    browserVoice = null;
  });
}
