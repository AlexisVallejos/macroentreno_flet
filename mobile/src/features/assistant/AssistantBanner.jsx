import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, continuous, createStyles, font, radius, spacing, useTheme } from '../../theme';

/** Acceso al asistente desde el inicio de cada rol. */
export function AssistantBanner({ subtitle = 'Hablale, mandale la foto de tu plato o pedile una rutina' }) {
  useTheme();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push('/assistant')}
      accessibilityRole="button"
      accessibilityLabel={`Asistente con IA. ${subtitle}`}
      style={({ pressed }) => [styles.banner, continuous, pressed && styles.pressed]}
    >
      <View style={[styles.icon, continuous]}>
        <Ionicons name="sparkles" size={22} color={colors.onPrimary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.title}>Asistente con IA</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="mic" size={20} color={colors.primary} />
    </Pressable>
  );
}

const styles = createStyles(() => StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 68,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
  icon: { width: 44, height: 44, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: font.md, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: font.sm },
}));
