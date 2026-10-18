import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, font, radius, spacing } from '../theme';

/** Selector de una opción entre varias (filtros, comidas, roles…). */
export function Chips({ options, value, onChange, scroll = true }) {
  const chips = options.map((opt) => {
    const selected = opt.value === value;
    return (
      <Pressable
        key={String(opt.value)}
        onPress={() => onChange(opt.value)}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        style={[styles.chip, selected && styles.selected]}
      >
        <Text style={[styles.text, selected && styles.selectedText]}>{opt.label}</Text>
      </Pressable>
    );
  });
  if (!scroll) return <>{chips}</>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.row}>
      {chips}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  row: { gap: spacing.sm, paddingVertical: 2 },
  chip: {
    paddingHorizontal: spacing.md,
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  text: { color: colors.muted, fontSize: font.sm, fontWeight: '600' },
  selectedText: { color: '#fff' },
});
