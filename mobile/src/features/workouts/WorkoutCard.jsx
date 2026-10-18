import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing } from '../../theme';
import { formatDayLabel } from '../../utils/dates';
import { fmt } from '../../utils/format';

const volumeOf = (w) => w.exercises.reduce((acc, e) => acc + e.sets.reduce((a, s) => a + s.reps * s.weight, 0), 0);

/** Resumen de una sesión. Muestra quién la cargó si fue el entrenador. */
export function WorkoutCard({ workout, onPress }) {
  const assignedByCoach = workout.createdBy && workout.createdBy !== workout.userId;
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.date}>{formatDayLabel(workout.date)}</Text>
          <Text style={styles.title}>{workout.title}</Text>
        </View>
        <View style={styles.volume}>
          <Text style={styles.volumeValue}>{fmt(volumeOf(workout))}</Text>
          <Text style={styles.volumeLabel}>kg volumen</Text>
        </View>
      </View>
      {assignedByCoach ? (
        <View style={styles.coach}>
          <Ionicons name="stopwatch-outline" size={14} color={colors.warning} />
          <Text style={styles.coachText}>Asignada por {workout.createdByName}</Text>
        </View>
      ) : null}
      {workout.exercises.map((e) => (
        <View key={e.id} style={styles.exercise}>
          <Text style={styles.exName} numberOfLines={1}>
            {e.name}
          </Text>
          <Text style={styles.sets}>{e.sets.map((s) => `${s.reps}×${fmt(s.weight)}`).join('  ')}</Text>
        </View>
      ))}
      {workout.notes ? <Text style={styles.notes}>{workout.notes}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  header: { flexDirection: 'row', gap: spacing.md },
  date: { color: colors.primary, fontSize: font.xs, fontWeight: '700', textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: font.lg, fontWeight: '700' },
  volume: { alignItems: 'flex-end' },
  volumeValue: { color: colors.text, fontSize: font.lg, fontWeight: '800' },
  volumeLabel: { color: colors.muted, fontSize: font.xs },
  coach: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  coachText: { color: colors.warning, fontSize: font.xs, fontWeight: '600' },
  exercise: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  exName: { color: colors.text, fontSize: font.sm, flex: 1 },
  sets: { color: colors.muted, fontSize: font.sm },
  notes: { color: colors.muted, fontSize: font.sm, fontStyle: 'italic' },
});
