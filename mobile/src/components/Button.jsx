import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, font, radius, spacing } from '../theme';

const VARIANTS = {
  primary: { bg: colors.primary, fg: '#fff', border: colors.primary },
  secondary: { bg: colors.cardAlt, fg: colors.text, border: colors.cardAlt },
  outline: { bg: 'transparent', fg: colors.text, border: colors.border },
  danger: { bg: 'transparent', fg: colors.danger, border: colors.danger },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
};

export function Button({ title, onPress, variant = 'primary', icon, loading = false, disabled = false, style, small }) {
  const v = VARIANTS[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        small && styles.small,
        { backgroundColor: v.bg, borderColor: v.border, opacity: isDisabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={small ? 16 : 18} color={v.fg} /> : null}
          {title ? <Text style={[styles.text, small && styles.smallText, { color: v.fg }]}>{title}</Text> : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  small: { minHeight: 36, paddingHorizontal: spacing.md },
  text: { fontSize: font.md, fontWeight: '600' },
  smallText: { fontSize: font.sm },
});
