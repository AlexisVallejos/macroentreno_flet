import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { font, radius, spacing } from '../theme';
import { ROLES } from '../utils/constants';

export function RoleBadge({ role }) {
  const r = ROLES[role] ?? { label: role, color: '#888', icon: 'person' };
  return (
    <View style={[styles.badge, { backgroundColor: `${r.color}22` }]}>
      <Ionicons name={r.icon} size={12} color={r.color} />
      <Text style={[styles.text, { color: r.color }]}>{r.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
