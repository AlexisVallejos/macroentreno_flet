import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card } from '../../components';
import { useResponsive } from '../../hooks/useResponsive';
import { colors, continuous, font, numeric, radius, spacing, tracking } from '../../theme';
import { ExerciseDemo } from './ExerciseDemo';
import { LIMITS, targetRange } from './pose/session';

/** Selector − valor + al estilo del UIStepper de iOS. */
function Stepper({ label, value, unit, min, max, step, onChange }) {
  const button = (icon, next, disabled, a11y) => (
    <Pressable
      onPress={() => onChange(next)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.stepButton, disabled && styles.stepDisabled, pressed && styles.stepPressed]}
    >
      <Ionicons name={icon} size={18} color={colors.text} />
    </Pressable>
  );
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepLabel}>{label}</Text>
      <View style={styles.stepValueRow}>
        <Text style={styles.stepValue} accessibilityLiveRegion="polite">
          {value}
          {unit ? <Text style={styles.stepUnit}> {unit}</Text> : null}
        </Text>
        <View style={[styles.stepControls, continuous]}>
          {button('remove', Math.max(min, value - step), value <= min, `Menos ${label.toLowerCase()}`)}
          <View style={styles.stepDivider} />
          {button('add', Math.min(max, value + step), value >= max, `Más ${label.toLowerCase()}`)}
        </View>
      </View>
    </View>
  );
}

/** Duración aproximada de la sesión, para decidir antes de empezar: una repetición tranquila lleva unos 3 segundos. */
function minutes(rule, config) {
  const work = rule.mode === 'reps' ? config.target * 3 : config.target + 5;
  return Math.max(1, Math.round((config.sets * work + (config.sets - 1) * config.restS) / 60));
}

const CHECKS = [
  { icon: 'videocam', title: 'Cámara', text: (rule) => rule.setup },
  { icon: 'sunny', title: 'Luz', text: () => 'De frente, sin una ventana brillante detrás tuyo.' },
  { icon: 'lock-closed', title: 'Privado', text: () => 'El video se analiza en este dispositivo: no se graba ni se sube.' },
];

export function SessionSetup({ exercise, rule, config, starting, voice, onConfig, onStart, onBack }) {
  const { width } = useResponsive();
  const wide = width >= 900;
  const range = targetRange(rule);
  const total = minutes(rule, config);

  return (
    <View style={[styles.root, wide && styles.rootWide]}>
      <View style={[styles.demoSlot, wide && styles.demoSlotWide]}>
        <ExerciseDemo rule={rule} />
      </View>

      <View style={[styles.text, wide && styles.textWide]}>
        <View>
          <Text style={styles.kicker}>Preparate</Text>
          <Text style={styles.title}>{exercise.name}</Text>
          <Text style={styles.subtitle}>{[exercise.group, ...exercise.muscles].filter(Boolean).join(' · ')}</Text>
        </View>

        <Card>
          <Stepper label="Series" value={config.sets} {...LIMITS.sets} onChange={(sets) => onConfig({ ...config, sets })} />
          <Stepper
            label={rule.mode === 'reps' ? 'Repeticiones' : 'Segundos'}
            value={config.target}
            unit={rule.mode === 'hold' ? 's' : undefined}
            {...range}
            onChange={(target) => onConfig({ ...config, target })}
          />
          <Stepper label="Descanso" value={config.restS} unit="s" {...LIMITS.rest} onChange={(restS) => onConfig({ ...config, restS })} />
          <Text style={styles.note}>
            {config.sets} {config.sets === 1 ? 'serie' : 'series'} de {config.target} {rule.mode === 'reps' ? 'repeticiones' : 'segundos'} ·{' '}
            {total === 1 ? 'un minuto' : `unos ${total} minutos`}. Las repeticiones mal hechas no cuentan.
          </Text>
        </Card>

        <Card>
          {CHECKS.map((check) => (
            <View key={check.title} style={styles.check}>
              <View style={[styles.checkIcon, continuous]}>
                <Ionicons name={check.icon} size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.checkTitle}>{check.title}</Text>
                <Text style={styles.checkText}>{check.text(rule)}</Text>
              </View>
            </View>
          ))}
        </Card>

        {exercise.lines?.length ? (
          <Card title="Cómo se hace">
            {exercise.lines.map((line, index) => (
              <View key={line} style={styles.step}>
                <Text style={styles.stepNumber}>{index + 1}</Text>
                <Text style={styles.stepText}>{line}</Text>
              </View>
            ))}
            {exercise.tip ? <Text style={styles.tip}>Tip: {exercise.tip}</Text> : null}
          </Card>
        ) : null}

        <View style={styles.actions}>
          <Button title={starting ? 'Abriendo cámara…' : 'Activar cámara'} icon="camera" onPress={onStart} loading={starting} style={styles.grow} />
          <Button title="Volver" variant="secondary" onPress={onBack} />
          {voice}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.lg },
  rootWide: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl },
  demoSlot: {},
  demoSlotWide: { flex: 1.05, position: 'sticky', top: spacing.lg },
  text: { gap: spacing.lg },
  textWide: { flex: 1 },
  kicker: { color: colors.primary, fontSize: font.sm, fontWeight: '600' },
  title: { color: colors.text, fontSize: font.display, fontWeight: '700', letterSpacing: tracking.display },
  subtitle: { color: colors.muted, fontSize: font.md, marginTop: 2 },
  stepper: { gap: 2 },
  stepLabel: { color: colors.muted, fontSize: font.sm, fontWeight: '500' },
  stepValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepValue: { ...numeric, color: colors.text, fontSize: font.xxl, fontWeight: '700', letterSpacing: tracking.title },
  stepUnit: { color: colors.muted, fontSize: font.body, fontWeight: '500' },
  stepControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.fill, borderRadius: radius.sm },
  stepButton: { width: 48, height: 34, alignItems: 'center', justifyContent: 'center' },
  stepDisabled: { opacity: 0.3 },
  stepPressed: { backgroundColor: 'rgba(255,255,255,0.08)' },
  stepDivider: { width: StyleSheet.hairlineWidth, height: 18, backgroundColor: colors.border },
  note: { color: colors.muted, fontSize: font.sm },
  check: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  checkIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  checkTitle: { color: colors.text, fontSize: font.md, fontWeight: '600' },
  checkText: { color: colors.muted, fontSize: font.sm },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  stepNumber: { ...numeric, width: 22, height: 22, borderRadius: 11, overflow: 'hidden', backgroundColor: colors.cardAlt, color: colors.text, fontSize: font.xs, fontWeight: '700', textAlign: 'center', lineHeight: 22 },
  stepText: { flex: 1, color: colors.text, fontSize: font.md },
  tip: { color: colors.muted, fontSize: font.sm, fontStyle: 'italic' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  grow: { flexGrow: 1 },
});
