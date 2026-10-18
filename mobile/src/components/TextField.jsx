import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, font, radius, spacing } from '../theme';

/** Input con etiqueta y mensaje de error debajo. */
export const TextField = forwardRef(function TextField({ label, error, hint, style, ...props }, ref) {
  return (
    <View style={[styles.wrap, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.muted}
        style={[styles.input, error && styles.inputError, props.multiline && styles.multiline]}
        accessibilityLabel={label}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { color: colors.muted, fontSize: font.sm, fontWeight: '600' },
  input: {
    minHeight: 48,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    color: colors.text,
    paddingHorizontal: spacing.md,
    fontSize: font.md,
  },
  multiline: { minHeight: 90, paddingTop: spacing.md, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: font.xs },
  hint: { color: colors.muted, fontSize: font.xs },
});
