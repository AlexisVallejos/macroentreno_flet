import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, FormError, StatTile } from '../../components';
import { colors, createStyles, font, numeric, spacing, tracking, useTheme } from '../../theme';
import { quality, sumSets, tempo, worstError } from './pose/session';
import { RepDots } from './RepDots';

const seconds = (ms) => `${(ms / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} s`;

/**
 * Resumen al terminar. Si la cámara la abrió el formulario de una sesión, ofrece pasarle las series (onUse);
 * si no, guardarla como una sesión nueva en Entrenos (onSave).
 */
export function SessionSummary({ exercise, rule, sets, onUse, onSave, saving, saved, error, onAgain, onAdjust, onExit, onOpenWorkouts }) {
  useTheme();
  const totals = sumSets(sets);
  const worst = worstError(totals.errors);
  const share = quality(totals);
  const pace = tempo(sets.flatMap((set) => set.log));
  const best = Math.max(0, ...sets.map((set) => set.holdMs));
  const empty = sets.length === 0;

  return (
    <View style={styles.root}>
      <View>
        <Text style={styles.kicker}>Resumen</Text>
        <Text style={styles.title}>{exercise.name}</Text>
      </View>

      <View style={styles.tiles}>
        {rule.mode === 'reps' ? (
          <>
            <StatTile icon="checkmark-circle" label="bien hechas" value={totals.reps} color={colors.primary} />
            <StatTile icon="ribbon" label={`técnica (${totals.badReps} a corregir)`} value={share === null ? '—' : `${Math.round(share * 100)} %`} color={colors.secondary} />
            <StatTile icon="speedometer" label="por repetición" value={pace === null ? '—' : seconds(pace)} color={colors.warning} />
          </>
        ) : (
          <>
            <StatTile icon="timer" label="en buena postura" value={`${Math.round(totals.holdMs / 1000)} s`} color={colors.primary} />
            <StatTile icon="trophy" label="tu mejor serie" value={`${Math.round(best / 1000)} s`} color={colors.warning} />
          </>
        )}
      </View>

      {sets.length > 0 ? (
        <Card title="Series">
          {sets.map((set, index) => (
            <View key={index} style={styles.set}>
              <Text style={styles.setName}>Serie {index + 1}</Text>
              {rule.mode === 'reps' ? (
                <View style={styles.setBody}>
                  <RepDots log={set.log} />
                  <Text style={styles.setNumbers}>
                    {set.reps} bien · {set.badReps} a corregir
                    {tempo(set.log) !== null ? ` · ${seconds(tempo(set.log))} c/u` : ''}
                  </Text>
                </View>
              ) : (
                <Text style={styles.setNumbers}>
                  {Math.round(set.holdMs / 1000)} s de {rule.target} s
                </Text>
              )}
            </View>
          ))}
        </Card>
      ) : (
        <Text style={styles.muted}>No llegó a contarse ninguna serie.</Text>
      )}

      {worst ? (
        <View style={[styles.lesson, styles.lessonWarn]}>
          <Ionicons name="bulb" size={18} color={colors.warning} />
          <Text style={styles.lessonText}>
            <Text style={styles.bold}>Para la próxima: </Text>«{worst[0]}» ({worst[1]} {worst[1] === 1 ? 'vez' : 'veces'}).
            {exercise.tip ? ` ${exercise.tip}` : ''}
          </Text>
        </View>
      ) : totals.reps + totals.holdMs > 0 ? (
        <View style={styles.lesson}>
          <Ionicons name="sparkles" size={18} color={colors.primary} />
          <Text style={styles.lessonText}>
            <Text style={styles.bold}>Impecable: </Text>no hubo nada para corregir.
          </Text>
        </View>
      ) : null}

      <FormError message={error} />

      {saved ? (
        <View style={styles.lesson}>
          <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
          <Text style={styles.lessonText}>Guardada en Entrenos, con la fecha de hoy.</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        {onUse ? (
          <Button title="Usar en la sesión" icon="checkmark" onPress={onUse} disabled={empty} style={styles.grow} />
        ) : saved ? (
          <Button title="Ver mis entrenos" icon="barbell" onPress={onOpenWorkouts} style={styles.grow} />
        ) : (
          <Button title="Guardar en mis entrenos" icon="cloud-upload" onPress={onSave} loading={saving} disabled={empty} style={styles.grow} />
        )}
        <Button title="Otra vez" icon="refresh" variant="secondary" onPress={onAgain} />
        <Button title="Ajustar series" variant="secondary" onPress={onAdjust} />
        <Button title={onUse ? 'Volver sin usar' : 'Elegir otro ejercicio'} variant="ghost" onPress={onExit} />
      </View>
    </View>
  );
}

const styles = createStyles(() => StyleSheet.create({
  root: { gap: spacing.lg },
  kicker: { color: colors.primary, fontSize: font.sm, fontWeight: '600' },
  title: { color: colors.text, fontSize: font.display, fontWeight: '700', letterSpacing: tracking.display },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  set: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 4 },
  setName: { color: colors.text, fontSize: font.md, fontWeight: '600', width: 64 },
  setBody: { flex: 1, gap: 4 },
  setNumbers: { ...numeric, color: colors.muted, fontSize: font.sm },
  muted: { color: colors.muted, fontSize: font.md },
  lesson: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', padding: spacing.md, borderRadius: 14, backgroundColor: colors.primarySoft },
  lessonWarn: { backgroundColor: 'rgba(255,159,10,0.14)' },
  lessonText: { flex: 1, color: colors.text, fontSize: font.md },
  bold: { fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  grow: { flexGrow: 1 },
}));
