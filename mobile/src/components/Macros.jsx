import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, numeric, spacing, tracking } from '../theme';
import { fmt, round1 } from '../utils/format';
import { ProgressRing } from './ProgressRing';

/** Anillo chico de un macro contra su objetivo, con el valor debajo. */
export function MacroRing({ label, value, goal, unit = 'g', color, size = 64 }) {
  const pct = goal > 0 ? value / goal : 0;
  const over = goal > 0 && value > goal * 1.1;
  return (
    <View style={styles.macro}>
      <ProgressRing
        size={size}
        stroke={8}
        progress={pct}
        color={over ? colors.danger : color}
        accessibilityLabel={`${label}: ${fmt(value)} de ${fmt(goal)} ${unit}`}
      >
        <Text style={[styles.pct, over && { color: colors.danger }]}>{Math.round(pct * 100)}%</Text>
      </ProgressRing>
      <Text style={[styles.macroLabel, { color }]}>{label}</Text>
      <Text style={[styles.macroValue, over && { color: colors.danger }]}>
        {fmt(value)}
        <Text style={styles.macroGoal}>
          {' '}
          / {fmt(goal)} {unit}
        </Text>
      </Text>
    </View>
  );
}

/**
 * Resumen del día: anillo grande de calorías y tres anillos chicos de macros.
 * Si la tarjeta es ancha, el anillo grande y los macros quedan lado a lado. Se mide la tarjeta
 * y no la ventana porque en tablet/escritorio comparte la fila con otras tarjetas.
 */
export function MacroSummary({ totals, goals }) {
  const [width, setWidth] = useState(0);
  const wide = width >= 600;
  const kcal = totals?.kcal ?? 0;
  const goal = goals?.kcal ?? 0;
  const remaining = round1(goal - kcal);
  const ring = width > 0 && width < 300 ? 148 : 172;

  return (
    <View style={[styles.summary, wide && styles.summaryWide]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={styles.hero}>
        <ProgressRing
          size={ring}
          stroke={18}
          progress={goal > 0 ? kcal / goal : 0}
          color={remaining < 0 ? colors.danger : colors.kcal}
          accessibilityLabel={`${fmt(kcal)} de ${fmt(goal)} kilocalorías`}
        >
          <Text style={styles.kcalValue}>{fmt(kcal)}</Text>
          <Text style={styles.kcalLabel}>de {fmt(goal)} kcal</Text>
        </ProgressRing>
        <Text style={[styles.remaining, remaining < 0 && { color: colors.danger }]}>
          {remaining >= 0 ? `Te quedan ${fmt(remaining)} kcal` : `Te pasaste ${fmt(-remaining)} kcal`}
        </Text>
      </View>
      <View style={[styles.macros, wide && styles.macrosWide]}>
        <MacroRing label="Proteínas" value={totals?.protein ?? 0} goal={goals?.protein ?? 0} color={colors.protein} />
        <MacroRing label="Carbohidratos" value={totals?.carbs ?? 0} goal={goals?.carbs ?? 0} color={colors.carbs} />
        <MacroRing label="Grasas" value={totals?.fat ?? 0} goal={goals?.fat ?? 0} color={colors.fat} />
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
  summary: { gap: spacing.xl, alignItems: 'center' },
  summaryWide: { flexDirection: 'row', justifyContent: 'space-around' },
  hero: { alignItems: 'center', gap: spacing.md },
  kcalValue: { ...numeric, color: colors.text, fontSize: 36, fontWeight: '700', letterSpacing: tracking.display },
  kcalLabel: { color: colors.muted, fontSize: font.sm, fontWeight: '500' },
  remaining: { color: colors.primary, fontSize: font.md, fontWeight: '600' },
  macros: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', gap: spacing.sm },
  macrosWide: { alignSelf: 'center', gap: spacing.xl },
  macro: { flex: 1, alignItems: 'center', gap: 6, minWidth: 88 },
  pct: { ...numeric, color: colors.text, fontSize: font.sm, fontWeight: '700' },
  macroLabel: { fontSize: font.sm, fontWeight: '600' },
  macroValue: { ...numeric, color: colors.text, fontSize: font.sm, fontWeight: '600' },
  macroGoal: { color: colors.muted, fontWeight: '400' },
  inline: { color: colors.muted, fontSize: font.sm },
});
