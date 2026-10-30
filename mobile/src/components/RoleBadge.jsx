import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, createStyles, font, radius, spacing, useTheme } from '../theme';
import { ROLES } from '../utils/constants';

const THEME_COLOR = { admin: 'danger', coach: 'warning', athlete: 'primary' };

export function RoleBadge({ role }) {
  useTheme();
  const r = ROLES[role] ?? { label: role, color: colors.muted, icon: 'person' };
  // El color del tema activo: en modo claro los tonos son más oscuros para mantener el contraste.
  const color = colors[THEME_COLOR[role]] ?? r.color;
  return (
    <View style={[styles.badge, { backgroundColor: `${color}22` }]}>
      <Ionicons name={r.icon} size={12} color={color} />
      <Text style={[styles.text, { color }]}>{r.label}</Text>
    </View>
  );
}

const styles = createStyles(() => StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  text: { fontSize: font.xs, fontWeight: '700' },
}));
