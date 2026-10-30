import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Chips } from '../../components';
import { colors, continuous, createStyles, font, radius, spacing, useTheme } from '../../theme';
import { createDemoScene } from './demoScene';
import { cuesFor, figureAt, loop } from './pose/demo';

const AZIMUTH = { side: 0.12, front: Math.PI / 2 - 0.1 };
const VIEWS = [
  { value: 'side', label: 'Lado' },
  { value: 'front', label: 'Frente' },
];

/** Un maniquí 3D que hace el ejercicio con la técnica exacta que el analizador va a dar por buena. */
export function ExerciseDemo({ rule }) {
  useTheme();
  const host = useRef(null);
  const [reduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const [view, setView] = useState('side');
  const [slow, setSlow] = useState(false);
  const [playing, setPlaying] = useState(!reduced);
  const [cue, setCue] = useState('start');
  const [unavailable, setUnavailable] = useState(false);

  // Lo que el loop de animación lee en cada cuadro, sin recrear la escena.
  const live = useRef({ view, slow, playing, manual: 0, dragging: false, lastX: 0, auto: true });
  useEffect(() => {
    Object.assign(live.current, { view, slow, playing });
  }, [view, slow, playing]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const scene = createDemoScene(element);
    if (!scene) {
      setUnavailable(true);
      return;
    }
    setUnavailable(false);
    scene.fit([0, 0.5, 1].map((p) => figureAt(rule.id, p)));
    const period = rule.mode === 'reps' ? 3.4 : 4.4;
    let frame = 0;
    let last = performance.now();
    // Arranca un poco antes del punto más profundo, así lo primero que se ve ya es el movimiento.
    let clock = reduced ? period / 2 : 0;
    let azimuth = AZIMUTH.side;
    let shownCue = 'start';

    const tick = (now) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const state = live.current;
      if (state.playing) clock += dt * (state.slow ? 0.45 : 1);
      const p = loop((clock / period) % 1);
      scene.show(figureAt(rule.id, p));

      const wanted = AZIMUTH[state.view] + state.manual + (state.auto && state.playing ? 0.32 * Math.sin(now / 1000 / 2.6) : 0);
      azimuth += (wanted - azimuth) * Math.min(1, dt * 6);
      scene.setView(azimuth, 0.22);
      scene.render();

      const next = p > 0.62 ? 'peak' : p < 0.38 ? 'start' : shownCue;
      if (next !== shownCue) {
        shownCue = next;
        setCue(next);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      scene.dispose();
    };
  }, [rule, reduced]);

  const cues = cuesFor(rule.id);

  const choose = (next) => {
    live.current.manual = 0;
    live.current.auto = true;
    setView(next);
  };

  if (unavailable) {
    return (
      <View style={[styles.fallback, continuous]} accessibilityRole="summary">
        <Text style={styles.kicker}>Cómo se hace</Text>
        <Text style={styles.cueText}>{cues.start}</Text>
        <Text style={styles.cueText}>{cues.peak}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.demo, continuous]}>
      <div
        ref={host}
        role="img"
        aria-label={`Demostración en 3D de ${rule.name}. ${cues.start} ${cues.peak}`}
        style={{ position: 'absolute', inset: 0, cursor: 'grab', touchAction: 'none' }}
        onPointerDown={(event) => {
          live.current.dragging = true;
          live.current.lastX = event.clientX;
          live.current.auto = false;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!live.current.dragging) return;
          live.current.manual += (event.clientX - live.current.lastX) * 0.012;
          live.current.lastX = event.clientX;
        }}
        onPointerUp={() => {
          live.current.dragging = false;
        }}
        onPointerCancel={() => {
          live.current.dragging = false;
        }}
      />
      <View style={styles.cue} pointerEvents="none">
        <Text style={styles.cueText}>{cue === 'peak' ? cues.peak : cues.start}</Text>
      </View>
      <View style={styles.controls}>
        <Chips options={VIEWS} value={view} onChange={choose} scroll={false} />
        <Chips
          options={[
            { value: 'slow', label: 'Lento' },
            { value: 'play', label: playing ? 'Pausa' : 'Reproducir' },
          ]}
          value={slow ? 'slow' : null}
          onChange={(value) => (value === 'slow' ? setSlow((s) => !s) : setPlaying((p) => !p))}
          scroll={false}
        />
      </View>
      <Text style={styles.hint} pointerEvents="none">
        Arrastrá para girar
      </Text>
    </View>
  );
}

const styles = createStyles(() => StyleSheet.create({
  demo: {
    height: 360,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  cue: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    alignItems: 'center',
  },
  cueText: { color: colors.text, fontSize: font.md, fontWeight: '600', textAlign: 'center' },
  controls: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  hint: { position: 'absolute', top: 44, right: spacing.md, color: colors.muted, fontSize: font.xs },
  fallback: { gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.card },
  kicker: { color: colors.primary, fontSize: font.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
}));
