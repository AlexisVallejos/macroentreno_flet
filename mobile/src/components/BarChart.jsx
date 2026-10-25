import { StyleSheet, Text, View } from 'react-native';
import { colors, font, numeric, spacing } from '../theme';
import { today, shortWeekday } from '../utils/dates';
import { fmt } from '../utils/format';

/** Color de la barra según qué tan cerca quedó el día de la meta. */
const barColor = (kcal, goal) => {
  if (kcal === 0) return colors.fill;
  if (Math.abs(kcal - goal) <= goal * 0.1) return colors.primary; // en objetivo
  if (kcal > goal) return colors.warning; // se pasó
  return 'rgba(48,209,88,0.38)'; // le faltó
};

/**
 * Gráfico de barras de calorías por día con la línea del objetivo, al estilo de los gráficos de Salud.
 * Hecho con Views para no sumar dependencias nativas.
 */
export function KcalBarChart({ daily, goal, height = 160 }) {
  const max = Math.max(goal * 1.2, ...daily.map((d) => d.kcal), 1);
  const goalY = (goal / max) * height;
  const todayKey = today();
  return (
    <View accessibilityLabel="Gráfico de calorías por día">
      <View style={[styles.plot, { height }]}>
        <View style={[styles.goalLine, { bottom: goalY }]}>
          <Text style={styles.goalText}>Meta {fmt(goal)}</Text>
        </View>
        {daily.map((d) => {
          const h = Math.max((d.kcal / max) * height, d.kcal > 0 ? 6 : 4);
          return (
            <View key={d.date} style={styles.col}>
              <View style={[styles.bar, { height: h, backgroundColor: barColor(d.kcal, goal) }]} />
            </View>
          );
        })}
      </View>
      <View style={styles.labels}>
        {daily.map((d) => (
          <View key={d.date} style={styles.col}>
            <Text style={[styles.day, d.date === todayKey && styles.today]}>{shortWeekday(d.date)}</Text>
            <View style={[styles.dot, (d.workouts ?? d.sessions ?? 0) > 0 && styles.dotOn]} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plot: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  col: { flex: 1, alignItems: 'center', gap: 4 },
  bar: { width: '64%', maxWidth: 30, borderRadius: 7 },
  goalLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(235,235,245,0.3)',
  },
  goalText: { ...numeric, position: 'absolute', right: 0, top: -18, color: colors.muted, fontSize: font.xs, fontWeight: '600' },
  labels: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  day: { color: colors.muted, fontSize: font.xs, fontWeight: '500' },
  today: { color: colors.text, fontWeight: '700' },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'transparent' },
  dotOn: { backgroundColor: colors.secondary },
});
