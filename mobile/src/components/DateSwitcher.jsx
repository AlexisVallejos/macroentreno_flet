import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, continuous, createStyles, font, radius, useTheme } from '../theme';
import { addDays, formatDayLabel, today } from '../utils/dates';

/** Navegación día por día (‹ Hoy ›). Tocar el texto vuelve a hoy. */
export function DateSwitcher({ date, onChange }) {
  useTheme();
  return (
    <View style={[styles.row, continuous]}>
      <Pressable
        style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
        onPress={() => onChange(addDays(date, -1))}
        accessibilityLabel="Día anterior"
      >
        <Ionicons name="chevron-back" size={22} color={colors.primary} />
      </Pressable>
      <Pressable onPress={() => onChange(today())} style={styles.center} accessibilityLabel="Ir a hoy">
        <Text style={styles.label}>{formatDayLabel(date)}</Text>
        <Text style={styles.sub}>{date}</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
        onPress={() => onChange(addDays(date, 1))}
        accessibilityLabel="Día siguiente"
      >
        <Ionicons name="chevron-forward" size={22} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = createStyles(() => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
  },
  arrow: { width: 52, height: 54, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.5 },
  center: { flex: 1, alignItems: 'center' },
  label: { color: colors.text, fontSize: font.lg, fontWeight: '600' },
  sub: { color: colors.muted, fontSize: font.xs },
}));
