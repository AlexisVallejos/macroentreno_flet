import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing } from '../theme';

export function StatTile({ icon, label, value, color = colors.primary }) {
  return (
    <View style={styles.tile}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: 140,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  value: { color: colors.text, fontSize: font.xxl, fontWeight: '800' },
  label: { color: colors.muted, fontSize: font.sm },
});
