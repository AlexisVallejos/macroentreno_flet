import { StyleSheet, Text, View } from 'react-native';
import { colors, continuous, createStyles, font, radius, spacing, tracking, useTheme } from '../theme';

/** Tarjeta agrupada al estilo iOS: superficie elevada sin borde y esquinas continuas. */
export function Card({ title, right, children, style }) {
  useTheme();
  return (
    <View style={[styles.card, continuous, style]}>
      {title || right ? (
        <View style={styles.header}>
          {title ? <Text style={styles.title}>{title}</Text> : <View />}
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = createStyles(() => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg + 2,
    gap: spacing.md,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  title: { color: colors.text, fontSize: font.xl - 2, fontWeight: '700', letterSpacing: tracking.headline, flexShrink: 1 },
}));
