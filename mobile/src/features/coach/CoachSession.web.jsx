import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { workoutsApi } from '../../api/endpoints';
import { Button, Card, Screen } from '../../components';
import { useResponsive } from '../../hooks/useResponsive';
import { colors, continuous, createStyles, font, numeric, radius, spacing, tracking, useTheme } from '../../theme';
import { today } from '../../utils/dates';
import { hasCoachRequest, resolveCoach } from './bridge';
import { loadLandmarker } from './landmarker';
import { measure } from './pose/debug';
import { createTracker, isSetDone } from './pose/engine';
import { drawOverlay } from './pose/overlay';
import { phrasesFor } from './pose/phrases';
import { createNarrator, introText, nextSetText, setDoneText, summaryText } from './pose/script';
import { clampConfig, quality, readConfig, sumSets, tempo, withTarget, worstError, writeConfig } from './pose/session';
import { createSmoother } from './pose/smoothing';
import { RepDots } from './RepDots';
import { SessionSetup } from './SessionSetup';
import { SessionSummary } from './SessionSummary';
import { readVoicePref, speak, stopSpeaking, voiceSupported, warmVoice, writeVoicePref } from './voice';

/** Por debajo de estos cuadros analizados por segundo, unos segundos seguidos, el modelo full se cambia por lite. */
const SLOW_FPS = 14;
const SLOW_WINDOWS = 3;
/** Si un equipo ya demostró ser lento, la próxima sesión arranca directo con lite. */
let preferred = 'full';

const PROBLEMS = {
  denied: { title: 'Sin permiso para la cámara', text: 'Tocá el ícono de la cámara o del candado en la barra de direcciones, elegí «Permitir» y volvé a intentar.' },
  nocamera: { title: 'No encontramos una cámara', text: 'Conectá una webcam o cerrá otras apps que la estén usando (Zoom, Meet, OBS…).' },
  insecure: { title: 'La cámara necesita HTTPS', text: 'Abrí la app con https:// o desde localhost: el navegador bloquea la cámara en sitios sin cifrar.' },
  model: { title: 'No se pudo cargar el analizador', text: 'Revisá tu conexión a internet e intentá de nuevo.' },
  other: { title: 'No pudimos abrir la cámara', text: 'Intentá de nuevo. Si sigue fallando, recargá la página.' },
};

function problemOf(error) {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'NotReadableError') return 'nocamera';
  return 'other';
}

const toResult = (state) => ({ reps: state.reps, badReps: state.badReps, holdMs: state.holdMs, log: state.log, errors: state.errors });
const hasActivity = (state) => !!state && (state.reps + state.badReps > 0 || state.holdMs >= 1000);
/** Lo que se anota en cada serie de la sesión: repeticiones bien hechas, o segundos sostenidos en las planchas. */
const countOf = (rule, set) => (rule.mode === 'reps' ? set.reps : Math.round(set.holdMs / 1000));

const tones = () => ({
  ok: { color: colors.primary, background: colors.primarySoft },
  warn: { color: colors.danger, background: colors.dangerSoft },
  info: { color: colors.text, background: colors.fill },
});

/**
 * Entrenador con cámara (web): preparación → cámara en vivo con conteo y correcciones → resumen.
 * `request` llega cuando lo abre el formulario de una sesión, para devolverle las series contadas.
 */
export function CoachSession({ exercise, rule: baseRule, preset, request }) {
  useTheme();
  const router = useRouter();
  const { width } = useResponsive();
  const wide = width >= 900;

  const stageRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(0);
  const landmarkerRef = useRef(null);
  const infoRef = useRef(null);
  const trackerRef = useRef(null);
  const liveRef = useRef(null);
  const narratorRef = useRef(null);
  const setRef = useRef(1);
  const resultsRef = useRef([]);
  const restUntilRef = useRef(0);
  const pausedRef = useRef(false);

  const [config, setConfig] = useState(() => clampConfig(baseRule, { ...readConfig(baseRule), ...preset }));
  // La regla con el objetivo que eligió la persona: el tracker, el entrenador y la pantalla la leen de acá.
  const rule = useMemo(() => withTarget(baseRule, config.target), [baseRule, config.target]);
  const ruleRef = useRef(rule);
  const configRef = useRef(config);
  useEffect(() => {
    ruleRef.current = rule;
    configRef.current = config;
  }, [rule, config]);

  const [phase, setPhase] = useState('setup');
  const [problem, setProblem] = useState('other');
  const [live, setLive] = useState(null);
  const [set, setSet] = useState(1);
  const [results, setResults] = useState([]);
  const [flash, setFlash] = useState(null);
  const [restLeft, setRestLeft] = useState(0);
  const [bodySeen, setBodySeen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  // Proporción real de la cámara (horizontal en la compu, vertical en el celular): el contenedor la copia.
  const [aspect, setAspect] = useState(16 / 9);
  const [stageWidth, setStageWidth] = useState(0);
  const [voiceOn, setVoiceOn] = useState(readVoicePref);
  const voiceOnRef = useRef(voiceOn);
  // Números en vivo para calibrar: el botón Datos, o ?debug en la dirección.
  const [debugOn, setDebugOn] = useState(() => /[?&]debug/.test(window.location.href));
  const debugRef = useRef(debugOn);
  const [reading, setReading] = useState(null);
  const [fps, setFps] = useState(0);
  const [model, setModel] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const canSpeak = voiceSupported();
  // Safari de iPhone solo deja poner en pantalla completa un <video>, no el escenario entero: ahí el botón no haría nada.
  const canFullscreen = typeof document !== 'undefined' && document.fullscreenEnabled;
  const fromForm = hasCoachRequest(request);
  const sets = config.sets;

  const say = useCallback((text, urgent = false) => {
    if (voiceOnRef.current) speak(text, urgent);
  }, []);

  useEffect(() => {
    warmVoice(phrasesFor(baseRule, sets));
  }, [baseRule, sets]);

  const changeConfig = (next) => {
    setConfig(next);
    writeConfig(baseRule, next);
  };

  const toggleVoice = () => {
    const next = !voiceOnRef.current;
    voiceOnRef.current = next;
    writeVoicePref(next);
    setVoiceOn(next);
    if (!next) stopSpeaking();
    else if (phase === 'setup') speak(introText(baseRule));
  };

  const stop = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, []);

  useEffect(() => stop, [stop]);
  useEffect(() => stopSpeaking, []);

  // Como un profe al empezar la clase: qué hacemos y cómo, mientras te ubicás.
  useEffect(() => {
    if (phase === 'setup') say(introText(baseRule));
  }, [phase, baseRule, say]);

  // Cada pantalla arranca arriba: en el celular el botón de la cámara queda al final de la preparación.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [phase]);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 1600);
    return () => window.clearTimeout(timer);
  }, [flash]);

  useEffect(() => {
    const onChange = () => setFullscreen(!!stageRef.current && document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // El ancho real del video decide si lo que se superpone va en versión compacta.
  useEffect(() => {
    const element = stageRef.current;
    if (phase !== 'live' || !element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setStageWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [phase]);

  const showFlash = useCallback((text, tone) => setFlash({ key: performance.now(), text, tone }), []);

  const finish = useCallback(() => {
    // Una serie que quedó por la mitad igual cuenta para el resumen, si se hizo algo.
    if (hasActivity(liveRef.current)) resultsRef.current = [...resultsRef.current, toResult(liveRef.current)];
    liveRef.current = null;
    setResults(resultsRef.current);
    stop();
    setPhase('done');
    say(summaryText(ruleRef.current, sumSets(resultsRef.current)), true);
  }, [stop, say]);

  const completeSet = useCallback(
    (state) => {
      resultsRef.current = [...resultsRef.current, toResult(state)];
      liveRef.current = null;
      setResults(resultsRef.current);
      const total = configRef.current.sets;
      if (setRef.current >= total) {
        finish();
        return;
      }
      say(setDoneText(setRef.current, total), true);
      // Un descanso de verdad: no cuenta ni se dice nada hasta que termina o lo salteás.
      const restMs = configRef.current.restS * 1000;
      restUntilRef.current = performance.now() + restMs;
      setRestLeft(Math.ceil(restMs / 1000));
      setRef.current += 1;
      setSet(setRef.current);
      setLive(null);
    },
    [finish, say],
  );

  const loop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!video || !canvas || !ctx) return;
    const smoother = createSmoother();
    let lastVideoTime = -1;
    let lastPaint = 0;
    let frames = 0;
    let windowStart = performance.now();
    let slowWindows = 0;
    let downgrading = false;
    let lastLog = 0;
    let wasReady = false;

    const tick = () => {
      frameRef.current = requestAnimationFrame(tick);
      const landmarker = landmarkerRef.current;
      if (!landmarker || video.readyState < 2 || video.currentTime === lastVideoTime) return;
      lastVideoTime = video.currentTime;
      const now = performance.now();
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (canvas.width !== vw) canvas.width = vw;
      if (canvas.height !== vh) canvas.height = vh;

      const lm = smoother.smooth(landmarker.detectForVideo(video, now).landmarks[0] ?? null, now);
      const current = ruleRef.current;
      const plain = { failing: [], judged: false, measured: null, degrees: null, reached: false, guide: false };

      frames += 1;
      if (now - windowStart > 1000) {
        const rate = (frames * 1000) / (now - windowStart);
        if (debugRef.current) setFps(Math.round(rate));
        // Un equipo que no da abasto devuelve ángulos tarde y a los saltos: lite es menos preciso pero más estable ahí.
        slowWindows = infoRef.current?.quality === 'full' && rate < SLOW_FPS ? slowWindows + 1 : 0;
        if (slowWindows >= SLOW_WINDOWS && !downgrading) {
          downgrading = true;
          preferred = 'lite';
          void loadLandmarker('lite')
            .then(({ landmarker: lite, info }) => {
              landmarkerRef.current = lite;
              infoRef.current = info;
              setModel(info);
            })
            .catch(() => {});
        }
        frames = 0;
        windowStart = now;
      }

      if (restUntilRef.current > 0) {
        drawOverlay(ctx, vw, vh, { lm, ...plain });
        if (now < restUntilRef.current) {
          if (now - lastPaint > 250) {
            lastPaint = now;
            setRestLeft(Math.ceil((restUntilRef.current - now) / 1000));
          }
          return;
        }
        restUntilRef.current = 0;
        setRestLeft(0);
        trackerRef.current?.reset();
        lastLog = 0;
        wasReady = false;
        say(nextSetText(setRef.current), true);
        return;
      }

      if (pausedRef.current) {
        drawOverlay(ctx, vw, vh, { lm, ...plain });
        return;
      }

      const state = trackerRef.current.update(lm, now);
      liveRef.current = state;
      const line = narratorRef.current?.update(state, now);
      if (line) say(line.text, line.urgent);

      // El ángulo que se cuenta, dibujado sobre el cuerpo mientras se lo juzga.
      let measured = null;
      let degrees = null;
      if (current.mode === 'reps' && lm && state.status === 'active' && state.side) {
        measured = current.measured(lm, state.side);
        degrees = current.metric(lm, state.side);
      }
      drawOverlay(ctx, vw, vh, {
        lm,
        failing: state.failing,
        judged: state.status === 'active',
        measured,
        degrees,
        reached: state.progress >= 1,
        guide: !lm || state.status === 'framing',
      });

      if (state.log.length > lastLog) {
        const mark = state.log[state.log.length - 1];
        showFlash(mark.ok ? '+1' : 'No contó', mark.ok ? 'ok' : 'warn');
        lastLog = state.log.length;
      }
      if (state.ready && !wasReady && state.log.length === 0 && state.holdMs < 1000) showFlash('¡Listo! Arrancá', 'info');
      wasReady = state.ready;

      if (now - lastPaint > 100) {
        lastPaint = now;
        if (debugRef.current) setReading(lm ? measure(current, lm, state.side ?? undefined) : null);
        setLive(state);
        setBodySeen(!!lm);
      }
      if (isSetDone(current, state)) completeSet(state);
    };
    tick();
  }, [completeSet, say, showFlash]);

  const start = async () => {
    stopSpeaking();
    setSaved(false);
    setSaveError(null);
    if (!window.isSecureContext) {
      setProblem('insecure');
      setPhase('error');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setProblem('nocamera');
      setPhase('error');
      return;
    }
    setPhase('starting');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, audio: false });
    } catch (error) {
      setProblem(problemOf(error));
      setPhase('error');
      return;
    }
    streamRef.current = stream;
    try {
      const { landmarker, info } = await loadLandmarker(preferred);
      landmarkerRef.current = landmarker;
      infoRef.current = info;
      setModel(info);
    } catch {
      stop();
      setProblem('model');
      setPhase('error');
      return;
    }
    if (streamRef.current !== stream) return;
    trackerRef.current = createTracker(rule);
    narratorRef.current = createNarrator(rule);
    liveRef.current = null;
    setRef.current = 1;
    resultsRef.current = [];
    restUntilRef.current = 0;
    pausedRef.current = false;
    setSet(1);
    setResults([]);
    setLive(null);
    setRestLeft(0);
    setPaused(false);
    setBodySeen(false);
    setPhase('live');
  };

  useEffect(() => {
    if (phase !== 'live') return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    let cancelled = false;
    video
      .play()
      .then(() => {
        if (!cancelled) loop();
      })
      .catch(() => {
        if (cancelled) return;
        stop();
        setProblem('other');
        setPhase('error');
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frameRef.current);
    };
  }, [phase, loop, stop]);

  const exit = () => {
    stop();
    stopSpeaking();
    if (router.canGoBack()) router.back();
    else router.replace('/coach');
  };

  const togglePause = () => {
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    if (next) stopSpeaking();
    // Al volver se pide de nuevo la posición de inicio: lo que pasó durante la pausa no cuenta.
    else trackerRef.current?.rearm();
  };

  const toggleFullscreen = () => {
    const stage = stageRef.current;
    if (!stage) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void stage.requestFullscreen?.().catch(() => {});
  };

  const toggleDebug = () => {
    debugRef.current = !debugRef.current;
    setDebugOn(debugRef.current);
  };

  /** Le pasa las series contadas al formulario de la sesión que abrió la cámara. */
  const sendToSession = () => {
    resolveCoach(request, { ruleId: rule.id, mode: rule.mode, sets: results.map((result) => countOf(rule, result)) });
    stopSpeaking();
    router.back();
  };

  /** Guarda lo que se hizo como una sesión nueva de hoy en Entrenos. */
  const saveWorkout = async () => {
    const totals = sumSets(results);
    const share = quality(totals);
    const worst = worstError(totals.errors);
    const notes = [
      'Contada con cámara.',
      rule.mode === 'hold' ? 'Las repeticiones son segundos sostenidos en buena postura.' : share !== null ? `${Math.round(share * 100)} % de técnica correcta.` : null,
      worst ? `Para la próxima: ${worst[0]}` : null,
    ]
      .filter(Boolean)
      .join(' ');
    setSaving(true);
    setSaveError(null);
    try {
      await workoutsApi.create({
        date: today(),
        title: `${exercise.name} con cámara`.slice(0, 120),
        notes,
        exercises: [{ exerciseId: null, name: exercise.name, sets: results.map((result) => ({ reps: countOf(rule, result), weight: 0, rpe: null })) }],
      });
      setSaved(true);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const voiceButton = canSpeak ? (
    <Button title={voiceOn ? 'Voz: sí' : 'Voz: no'} icon={voiceOn ? 'volume-high' : 'volume-mute'} variant={voiceOn ? 'tinted' : 'secondary'} onPress={toggleVoice} />
  ) : null;

  const header = <Stack.Screen options={{ title: exercise.name }} />;

  if (phase === 'error') {
    const { title, text } = PROBLEMS[problem];
    return (
      <Screen>
        {header}
        <Card>
          <View style={styles.problemIcon}>
            <Ionicons name="videocam-off" size={26} color={colors.danger} />
          </View>
          <Text style={styles.problemTitle} accessibilityRole="alert">
            {title}
          </Text>
          <Text style={styles.muted}>{text}</Text>
          <View style={styles.actions}>
            <Button title="Reintentar" icon="refresh" onPress={start} />
            <Button title="Elegir otro ejercicio" variant="secondary" onPress={exit} />
          </View>
        </Card>
      </Screen>
    );
  }

  if (phase === 'setup' || phase === 'starting') {
    return (
      <Screen style={styles.roomy}>
        {header}
        <SessionSetup exercise={exercise} rule={baseRule} config={config} starting={phase === 'starting'} voice={voiceButton} onConfig={changeConfig} onStart={start} onBack={exit} />
      </Screen>
    );
  }

  if (phase === 'done') {
    return (
      <Screen>
        {header}
        <SessionSummary
          exercise={exercise}
          rule={rule}
          sets={results}
          onUse={fromForm ? sendToSession : null}
          onSave={saveWorkout}
          saving={saving}
          saved={saved}
          error={saveError}
          onAgain={start}
          onAdjust={() => setPhase('setup')}
          onExit={exit}
          onOpenWorkouts={() => router.dismissTo('/workouts')}
        />
      </Screen>
    );
  }

  const target = rule.target;
  const count = live ? (rule.mode === 'reps' ? live.reps : Math.floor(live.holdMs / 1000)) : 0;
  const fill = live ? (rule.mode === 'reps' ? live.progress : Math.min(1, live.holdMs / (rule.target * 1000))) : 0;
  const framing = !live || live.status === 'framing';
  const message = restLeft > 0 ? `Descansá. Después seguimos con la serie ${set}.` : paused ? 'En pausa.' : (live?.message ?? 'Ubicate frente a la cámara.');
  const tone = restLeft === 0 && !paused ? (live?.tone ?? 'info') : 'info';
  const pill = !bodySeen
    ? { color: '#FF6961', text: 'No te veo' }
    : framing
      ? { color: colors.warning, text: live?.missing.length ? `Me falta ver: ${live.missing.join(', ')}` : 'Te veo a medias' }
      : { color: colors.primary, text: 'Te veo bien' };
  const pace = live ? tempo(live.log) : null;
  const unit = rule.mode === 'hold' ? ' s' : '';
  // Con el video angosto (celular) lo que se superpone se achica y el mensaje queda solo en el panel.
  const compact = !fullscreen && stageWidth > 0 && stageWidth < 640;

  return (
    <Screen style={styles.roomy}>
      {header}
      <View style={[styles.stage, wide && styles.stageWide]} accessibilityLabel={`Entrenando: ${exercise.name}`}>
        <div ref={stageRef} style={fullscreen ? { ...videoWrapStyle, ...fullWrapStyle } : { ...videoWrapStyle, aspectRatio: aspect }}>
          <video
            ref={videoRef}
            muted
            playsInline
            style={videoStyle}
            onLoadedMetadata={(event) => {
              const { videoWidth, videoHeight } = event.currentTarget;
              if (videoWidth && videoHeight) setAspect(videoWidth / videoHeight);
            }}
          />
          <canvas ref={canvasRef} aria-hidden="true" style={canvasStyle} />

          <View style={[styles.pill, continuous]} accessibilityRole="text" accessibilityLiveRegion="polite">
            <View style={[styles.pillDot, { backgroundColor: pill.color }]} />
            <Text style={[styles.pillText, { color: pill.color }]} numberOfLines={1}>
              {pill.text}
            </Text>
          </View>

          <View style={[styles.counter, continuous]} aria-hidden>
            <Text style={styles.counterSet}>
              SERIE {set}/{sets}
            </Text>
            <Text style={[styles.counterValue, compact && styles.counterValueCompact, fullscreen && styles.counterValueFull]}>
              {count}
              <Text style={styles.counterTarget}>
                /{target}
                {unit}
              </Text>
            </Text>
            {rule.mode === 'reps' ? <RepDots log={live?.log ?? []} target={target} /> : null}
          </View>

          <View style={[styles.gauge, compact && styles.gaugeCompact]} aria-hidden>
            <View style={[styles.gaugeFill, { height: `${Math.round(fill * 100)}%`, backgroundColor: fill >= 1 ? colors.primary : colors.warning }]} />
          </View>

          {restLeft === 0 && !paused && !compact ? (
            <View style={styles.bannerWrap} pointerEvents="none">
              <Text style={[styles.banner, { color: tones()[tone].color }, fullscreen && styles.bannerFull]}>{message}</Text>
            </View>
          ) : null}

          {flash ? (
            <View style={styles.flashWrap} pointerEvents="none" aria-hidden>
              <Text key={flash.key} style={[styles.flash, { color: flash.tone === 'ok' ? colors.primary : flash.tone === 'warn' ? colors.danger : colors.text }]}>
                {flash.text}
              </Text>
            </View>
          ) : null}

          {restLeft > 0 ? (
            <View style={styles.overlay} accessibilityLiveRegion="polite">
              <Text style={styles.overlayTitle}>Descansá</Text>
              <Text style={styles.overlayTime}>{restLeft}</Text>
              <Text style={styles.overlayNext}>
                Después: serie {set} de {sets}
              </Text>
              <Button
                title="Seguir ya"
                variant="secondary"
                onPress={() => {
                  restUntilRef.current = performance.now();
                }}
              />
            </View>
          ) : null}

          {paused && restLeft === 0 ? (
            <View style={styles.overlay}>
              <Text style={styles.overlayTitle}>En pausa</Text>
              <Text style={styles.overlayNext}>Cuando vuelvas, ponete en la posición de inicio.</Text>
              <Button title="Seguir" icon="play" onPress={togglePause} />
            </View>
          ) : null}

          <View style={[styles.videoControls, compact && styles.videoControlsCompact]}>
            <RoundButton icon={paused ? 'play' : 'pause'} label={paused ? 'Seguir' : 'Pausar'} onPress={togglePause} />
            {canFullscreen ? <RoundButton icon={fullscreen ? 'contract' : 'expand'} label={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'} onPress={toggleFullscreen} /> : null}
          </View>
        </div>

        <Card style={[styles.panel, wide && styles.panelWide]}>
          <Text style={styles.kicker}>{exercise.name}</Text>
          <Text style={styles.setLabel}>
            SERIE {set} DE {sets}
          </Text>
          <Text style={styles.count} accessibilityLiveRegion="polite">
            {count}
            <Text style={styles.countTarget}>
              /{target}
              {unit}
            </Text>
          </Text>
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: `${Math.round(fill * 100)}%`, backgroundColor: fill >= 1 ? colors.primary : colors.warning }]} />
          </View>
          <View style={[styles.message, { backgroundColor: tones()[tone].background }]}>
            <Text style={[styles.messageText, { color: tones()[tone].color }]} accessibilityLiveRegion="polite">
              {message}
            </Text>
          </View>
          {rule.mode === 'reps' ? (
            <>
              <RepDots log={live?.log ?? []} large />
              <Text style={styles.muted}>
                Bien: {live?.reps ?? 0} · Para corregir: {live?.badReps ?? 0}
                {pace !== null ? ` · ${(pace / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} s por repetición` : ''}
              </Text>
            </>
          ) : null}
          {results.length > 0 ? (
            <View style={{ gap: 2 }}>
              {results.map((result, index) => (
                <Text key={index} style={styles.muted}>
                  Serie {index + 1}: {rule.mode === 'reps' ? `${result.reps} bien · ${result.badReps} a corregir` : `${Math.round(result.holdMs / 1000)} s`}
                </Text>
              ))}
            </View>
          ) : null}
          {exercise.tip ? (
            <Text style={styles.muted}>
              <Text style={styles.bold}>Tip: </Text>
              {exercise.tip}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <Button title="Terminar" icon="flag" onPress={finish} style={styles.grow} />
            <Button title="Salir" variant="secondary" onPress={exit} />
          </View>
          <View style={styles.actions}>
            {voiceButton}
            <Button title="Datos" icon="analytics" small variant={debugOn ? 'tinted' : 'secondary'} onPress={toggleDebug} />
          </View>
          {debugOn ? (
            <View style={styles.debug}>
              <Text style={styles.debugText}>
                modelo: {model ? `${model.quality} · ${model.delegate}` : '…'} · {fps} fps
              </Text>
              {reading ? (
                <>
                  <Text style={styles.debugText}>
                    lado: {reading.side === 'left' ? 'izquierdo' : 'derecho'} · articulaciones: {reading.visible}/{reading.total} · visibilidad mín: {reading.minVisibility.toFixed(2)}
                  </Text>
                  {reading.metric !== null ? (
                    <Text style={styles.debugText}>
                      ángulo: {Math.round(reading.metric)}° · reposo {reading.rest}° → profundidad {reading.peak}° · progreso {Math.round((reading.progress ?? 0) * 100)}%
                    </Text>
                  ) : null}
                  {reading.checks.map((check) => (
                    <Text key={check.message} style={[styles.debugText, { color: check.ok ? colors.primary : colors.danger }]}>
                      {check.ok ? '✓' : '✗'} {check.message}
                    </Text>
                  ))}
                </>
              ) : (
                <Text style={styles.debugText}>Sin cuerpo detectado</Text>
              )}
            </View>
          ) : null}
        </Card>
      </View>
    </Screen>
  );
}

function RoundButton({ icon, label, onPress }) {
  useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.round, pressed && styles.roundPressed]}>
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

// El contenedor del video es un <div> real: tiene que poder ponerse en pantalla completa.
// Video y canvas lo llenan con object-fit: contain, así el esqueleto calza justo sobre el cuerpo en cualquier tamaño.
const videoWrapStyle = { position: 'relative', backgroundColor: '#000', borderRadius: 22, overflow: 'hidden', flex: 1, minWidth: 0, width: '100%', maxHeight: '78vh' };
const fullWrapStyle = { borderRadius: 0, width: '100vw', height: '100vh', maxHeight: 'none' };
const fillBox = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' };
const videoStyle = { ...fillBox, transform: 'scaleX(-1)' };
const canvasStyle = { ...fillBox, pointerEvents: 'none' };

const overlayBox = { backgroundColor: 'rgba(0,0,0,0.62)' };

const styles = createStyles(() => StyleSheet.create({
  // La cámara y la demo 3D necesitan más ancho que las pantallas de formularios.
  roomy: { maxWidth: 1200 },
  stage: { gap: spacing.lg },
  stageWide: { flexDirection: 'row', alignItems: 'flex-start' },
  panel: { gap: spacing.md },
  panelWide: { width: 340 },
  pill: {
    ...overlayBox,
    position: 'absolute',
    top: 14,
    left: 14,
    maxWidth: '55%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  pillDot: { width: 9, height: 9, borderRadius: 5 },
  pillText: { fontSize: font.sm, fontWeight: '600', flexShrink: 1 },
  counter: { ...overlayBox, position: 'absolute', top: 14, right: 14, alignItems: 'flex-end', gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 18, maxWidth: 220 },
  counterSet: { color: 'rgba(235,235,245,0.7)', fontSize: font.xs, fontWeight: '600', letterSpacing: 1.2 },
  counterValue: { ...numeric, color: colors.text, fontSize: 64, lineHeight: 64, fontWeight: '700', letterSpacing: tracking.display },
  counterValueCompact: { fontSize: 40, lineHeight: 42 },
  counterValueFull: { fontSize: 120, lineHeight: 120 },
  counterTarget: { color: colors.muted, fontSize: 24, fontWeight: '600' },
  gauge: {
    position: 'absolute',
    left: 14,
    top: 64,
    bottom: 76,
    width: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  gaugeCompact: { top: 56, bottom: 14 },
  gaugeFill: { width: '100%', borderRadius: 5 },
  bannerWrap: { position: 'absolute', left: 14, right: 14, bottom: 16, alignItems: 'center' },
  banner: {
    ...overlayBox,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 16,
    fontSize: font.body,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 640,
  },
  bannerFull: { fontSize: font.xxl, paddingVertical: 16 },
  flashWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  flash: { ...numeric, fontSize: 88, fontWeight: '800', letterSpacing: tracking.display, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 12 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.78)', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg },
  overlayTitle: { color: colors.primary, fontSize: font.xxl, fontWeight: '700', letterSpacing: tracking.title },
  overlayTime: { ...numeric, color: colors.text, fontSize: 112, lineHeight: 116, fontWeight: '700', letterSpacing: tracking.display },
  overlayNext: { color: colors.muted, fontSize: font.md, textAlign: 'center', marginBottom: spacing.sm },
  videoControls: { position: 'absolute', right: 14, bottom: 76, gap: spacing.sm },
  videoControlsCompact: { bottom: 12, flexDirection: 'row' },
  round: { ...overlayBox, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  roundPressed: { opacity: 0.7, transform: [{ scale: 0.94 }] },
  kicker: { color: colors.primary, fontSize: font.sm, fontWeight: '600' },
  setLabel: { color: colors.muted, fontSize: font.xs, fontWeight: '600', letterSpacing: 1.2 },
  count: { ...numeric, color: colors.text, fontSize: 96, lineHeight: 96, fontWeight: '700', letterSpacing: tracking.display },
  countTarget: { color: colors.muted, fontSize: 30, fontWeight: '600' },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.fill, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: radius.pill },
  message: { borderRadius: 14, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  messageText: { fontSize: font.body, fontWeight: '600' },
  muted: { color: colors.muted, fontSize: font.sm },
  bold: { fontWeight: '700', color: colors.text },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  grow: { flexGrow: 1 },
  debug: { gap: 4, padding: spacing.md, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
  debugText: { color: colors.muted, fontSize: font.xs, fontFamily: 'ui-monospace, Menlo, monospace' },
  problemIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,69,58,0.14)', alignItems: 'center', justifyContent: 'center' },
  problemTitle: { color: colors.text, fontSize: font.xl, fontWeight: '700', letterSpacing: tracking.title },
}));
