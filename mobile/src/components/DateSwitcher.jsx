import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius } from '../theme';
import { addDays, formatDayLabel, today } from '../utils/dates';

/** Navegación día por día (‹ Hoy ›). Tocar el texto vuelve a hoy. */
export function DateSwitcher({ date, onChange }) {
  return (
    <View style={styles.row}>
      <Pressable style={styles.arrow} onPress={() => onChange(addDays(date, -1))} accessibilityLabel="Día anterior">
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
      <Pressable onPress={() => onChange(today())} style={styles.center} accessibilityLabel="Ir a hoy">
        <Text style={styles.label}>{formatDayLabel(date)}</Text>
        <Text style={styles.sub}>{date}</Text>
      </Pressable>
      <Pressable style={styles.arrow} onPress={() => onChange(addDays(date, 1))} accessibilityLabel="Día siguiente">
        <Ionicons name="chevron-forward" size={22} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  arrow: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center' },
  label: { color: colors.text, fontSize: font.lg, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: font.xs },
});
