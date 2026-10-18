import { StyleSheet, Text, View } from 'react-native';
import { useResponsive } from '../hooks/useResponsive';
import { colors, font, radius, spacing } from '../theme';
import { fmt, round1 } from '../utils/format';

/** Barra de progreso de un macro contra su objetivo. */
export function MacroBar({ label, value, goal, unit = 'g', color, style }) {
  const pct = goal > 0 ? Math.min(value / goal, 1) : 0;
  const over = goal > 0 && value > goal * 1.1;
  return (
    <View style={[styles.bar, style]}>
      <View style={styles.barHeader}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={[styles.barValue, over && { color: colors.danger }]}>
          {fmt(value)} / {fmt(goal)} {unit}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: over ? colors.danger : color }]} />
      </View>
    </View>
  );
}

/** Resumen de calorías + los 3 macros. En pantallas anchas se reparte en 2 columnas. */
export function MacroSummary({ totals, goals }) {
  const { columns } = useResponsive();
  const remaining = round1((goals?.kcal ?? 0) - (totals?.kcal ?? 0));
  return (
    <View style={styles.summary}>
      <View style={styles.kcalBox}>
        <Text style={styles.kcalValue}>{fmt(totals?.kcal ?? 0)}</Text>
        <Text style={styles.kcalLabel}>kcal consumidas de {fmt(goals?.kcal ?? 0)}</Text>
        <Text style={[styles.remaining, remaining < 0 && { color: colors.danger }]}>
          {remaining >= 0 ? `Te quedan ${fmt(remaining)} kcal` : `Te pasaste ${fmt(-remaining)} kcal`}
        </Text>
      </View>
      <View style={[styles.bars, columns > 1 && styles.barsWide]}>
        <MacroBar style={columns > 1 && styles.barWide} label="Proteínas" value={totals?.protein ?? 0} goal={goals?.protein ?? 0} color={colors.protein} />
        <MacroBar style={columns > 1 && styles.barWide} label="Carbohidratos" value={totals?.carbs ?? 0} goal={goals?.carbs ?? 0} color={colors.carbs} />
        <MacroBar style={columns > 1 && styles.barWide} label="Grasas" value={totals?.fat ?? 0} goal={goals?.fat ?? 0} color={colors.fat} />
      </View>
    </View>
  );
}

export function MacroInline({ kcal, protein, carbs, fat }) {
  return (
    <Text style={styles.inline}>
      <Text style={{ color: colors.text }}>{fmt(kcal)} kcal</Text>
      {'  ·  '}
      <Text style={{ color: colors.protein }}>P {fmt(protein)}</Text>
      {'  '}
      <Text style={{ color: colors.carbs }}>C {fmt(carbs)}</Text>
      {'  '}
      <Text style={{ color: colors.fat }}>G {fmt(fat)}</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  summary: { gap: spacing.lg },
  kcalBox: { alignItems: 'center', gap: 2 },
  kcalValue: { color: colors.text, fontSize: 40, fontWeight: '800' },
  kcalLabel: { color: colors.muted, fontSize: font.sm },
  remaining: { color: colors.success, fontSize: font.sm, fontWeight: '600', marginTop: spacing.xs },
  bars: { gap: spacing.md },
  barsWide: { flexDirection: 'row', flexWrap: 'wrap' },
  bar: { gap: 6 },
  barWide: { flexGrow: 1, flexBasis: 200 },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  barLabel: { color: colors.text, fontSize: font.sm, fontWeight: '600' },
  barValue: { color: colors.muted, fontSize: font.sm },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.cardAlt, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  inline: { color: colors.muted, fontSize: font.sm },
});
