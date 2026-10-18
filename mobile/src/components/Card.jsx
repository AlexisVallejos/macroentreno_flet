import { StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing } from '../theme';

export function Card({ title, right, children, style }) {
  return (
    <View style={[styles.card, style]}>
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  title: { color: colors.text, fontSize: font.lg, fontWeight: '700', flexShrink: 1 },
});
