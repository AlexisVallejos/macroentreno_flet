import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, continuous, createStyles, font, numeric, radius, spacing, tracking, useTheme } from '../theme';

/** Dato destacado al estilo de las tarjetas de Salud: categoría en color arriba y el valor grande abajo. */
export function StatTile({ icon, label, value, color = colors.primary }) {
  useTheme();
  return (
    <View style={[styles.tile, continuous]}>
      <View style={styles.head}>
        <Ionicons name={icon} size={15} color={color} />
        <Text style={[styles.label, { color }]} numberOfLines={2}>
          {label}
        </Text>
      </View>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = createStyles(() => StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: 140,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: font.sm, fontWeight: '600', flexShrink: 1 },
  value: { ...numeric, color: colors.text, fontSize: font.xxl + 2, fontWeight: '700', letterSpacing: tracking.title },
}));
