import { forwardRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, continuous, createStyles, font, radius, spacing, useTheme } from '../theme';

/** Input con etiqueta y mensaje de error debajo. Al enfocarse se marca con el color de acento. */
export const TextField = forwardRef(function TextField({ label, error, hint, style, onFocus, onBlur, ...props }, ref) {
  useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.wrap, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.muted}
        selectionColor={colors.primary}
        cursorColor={colors.primary}
        style={[
          styles.input,
          continuous,
          focused && styles.inputFocused,
          error && styles.inputError,
          props.multiline && styles.multiline,
        ]}
        accessibilityLabel={label}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
});

const styles = createStyles(() => StyleSheet.create({
  wrap: { gap: 6 },
  label: { color: colors.muted, fontSize: font.sm, fontWeight: '500', marginLeft: spacing.xs },
  input: {
    minHeight: 50,
    backgroundColor: colors.fill,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
    color: colors.text,
    paddingHorizontal: spacing.lg,
    // 17 px (body de iOS): con menos de 16 px Safari hace zoom al enfocar el campo
    fontSize: font.body,
    // en web el borde verde de foco reemplaza al contorno del navegador
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : null),
  },
  inputFocused: { borderColor: colors.primary },
  multiline: { minHeight: 96, paddingTop: spacing.md, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: font.xs, marginLeft: spacing.xs },
  hint: { color: colors.muted, fontSize: font.xs, marginLeft: spacing.xs },
}));
