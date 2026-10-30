import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, createStyles, font, radius, spacing, useTheme } from '../theme';
import { Button } from './Button';

export function Loading({ label = 'Cargando…' }) {
  useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

/** Error de carga con botón para reintentar. */
export function ErrorState({ error, onRetry }) {
  useTheme();
  const offline = ['NETWORK_ERROR', 'TIMEOUT'].includes(error?.code);
  return (
    <View style={styles.center}>
      <Ionicons name={offline ? 'cloud-offline-outline' : 'alert-circle-outline'} size={48} color={colors.danger} />
      <Text style={styles.title}>{offline ? 'Sin conexión' : 'Algo salió mal'}</Text>
      <Text style={styles.muted}>{error?.message || 'Error desconocido'}</Text>
      {onRetry ? <Button title="Reintentar" icon="refresh" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

export function EmptyState({ icon = 'file-tray-outline', title, message, action }) {
  useTheme();
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={36} color={colors.muted} />
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.muted}>{message}</Text> : null}
      {action}
    </View>
  );
}

/** Mensaje de error general de un formulario (lo que no corresponde a un campo). */
export function FormError({ message }) {
  useTheme();
  if (!message) return null;
  return (
    <View style={styles.formError} accessibilityRole="alert">
      <Ionicons name="warning-outline" size={18} color={colors.danger} />
      <Text style={styles.formErrorText}>{message}</Text>
    </View>
  );
}

const styles = createStyles(() => StyleSheet.create({
  center: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  title: { color: colors.text, fontSize: font.lg, fontWeight: '700', textAlign: 'center' },
  muted: { color: colors.muted, fontSize: font.sm, textAlign: 'center' },
  formError: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  formErrorText: { color: colors.danger, fontSize: font.sm, flex: 1 },
}));
