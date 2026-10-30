import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, createStyles, font, radius, spacing, useTheme } from '../theme';

/** Selector de una opción entre varias (filtros, comidas, roles…). */
export function Chips({ options, value, onChange, scroll = true }) {
  useTheme();
  const chips = options.map((opt) => {
    const selected = opt.value === value;
    return (
      <Pressable
        key={String(opt.value)}
        onPress={() => onChange(opt.value)}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && styles.pressed]}
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

const styles = createStyles(() => StyleSheet.create({
  scroll: { flexGrow: 0 },
  row: { gap: spacing.sm, paddingVertical: 2 },
  chip: {
    paddingHorizontal: spacing.lg - 2,
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.card,
  },
  selected: { backgroundColor: colors.primary },
  pressed: { transform: [{ scale: 0.96 }] },
  text: { color: colors.text, fontSize: font.md, fontWeight: '500' },
  selectedText: { color: colors.onPrimary, fontWeight: '600' },
}));
