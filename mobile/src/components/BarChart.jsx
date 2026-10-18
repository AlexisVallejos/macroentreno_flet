import { StyleSheet, Text, View } from 'react-native';
import { colors, font, spacing } from '../theme';
import { shortWeekday } from '../utils/dates';
import { fmt } from '../utils/format';

/**
 * Gráfico de barras de calorías por día con la línea del objetivo.
 * Hecho con Views para no sumar dependencias nativas.
 */
export function KcalBarChart({ daily, goal, height = 160 }) {
  const max = Math.max(goal * 1.2, ...daily.map((d) => d.kcal), 1);
  const goalY = (goal / max) * height;
  return (
    <View accessibilityLabel="Gráfico de calorías por día">
      <View style={[styles.plot, { height }]}>
        <View style={[styles.goalLine, { bottom: goalY }]}>
          <Text style={styles.goalText}>Meta {fmt(goal)}</Text>
        </View>
        {daily.map((d) => {
          const h = Math.max((d.kcal / max) * height, d.kcal > 0 ? 4 : 2);
          const near = Math.abs(d.kcal - goal) <= goal * 0.1;
          return (
            <View key={d.date} style={styles.col}>
              <View
                style={[
                  styles.bar,
                  { height: h, backgroundColor: d.kcal === 0 ? colors.cardAlt : near ? colors.success : colors.primary },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.labels}>
        {daily.map((d) => (
          <View key={d.date} style={styles.col}>
            <Text style={styles.day}>{shortWeekday(d.date)}</Text>
            {d.workouts > 0 ? <Text style={styles.dot}>●</Text> : <Text style={styles.dotEmpty}>·</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plot: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  col: { flex: 1, alignItems: 'center' },
  bar: { width: '70%', maxWidth: 36, borderRadius: 6 },
  goalLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.warning },
  goalText: { position: 'absolute', right: 0, top: -16, color: colors.warning, fontSize: font.xs },
  labels: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  day: { color: colors.muted, fontSize: font.xs },
  dot: { color: colors.warning, fontSize: 10 },
  dotEmpty: { color: 'transparent', fontSize: 10 },
});
