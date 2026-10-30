import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, continuous, createStyles, font, spacing, useTheme } from '../theme';

export function ListItem({ title, subtitle, icon, iconColor = colors.primary, right, onPress, onLongPress }) {
  useTheme();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      {icon ? (
        <View style={[styles.icon, continuous, { backgroundColor: `${iconColor}26` }]}>
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
      ) : null}
      <View style={styles.texts}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={17} color={colors.chevron} /> : null)}
    </Pressable>
  );
}

const styles = createStyles(() => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, minHeight: 50 },
  pressed: { opacity: 0.6 },
  icon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1, gap: 2 },
  title: { color: colors.text, fontSize: font.body - 1, fontWeight: '500' },
  subtitle: { color: colors.muted, fontSize: font.sm },
}));
