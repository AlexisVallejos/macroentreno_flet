import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Grid, Screen } from '../../components';
import { colors, continuous, font, radius, spacing, tracking } from '../../theme';
import { COACH_EXERCISES } from './exercises';
import { RULES } from './pose/rules';

/** Elegir un ejercicio para entrenar con la cámara. */
export default function CoachCatalog() {
  const router = useRouter();
  return (
    <Screen>
      <View style={[styles.hero, continuous]}>
        <View style={styles.heroIcon}>
          <Ionicons name="scan" size={28} color={colors.onPrimary} />
        </View>
        <Text style={styles.heroTitle}>Entrená con cámara</Text>
        <Text style={styles.heroText}>
          La cámara cuenta tus repeticiones y te corrige la técnica en vivo, con voz. El video se analiza en tu dispositivo: no se graba ni se sube.
        </Text>
        {Platform.OS !== 'web' ? (
          <View style={styles.notice}>
            <Ionicons name="desktop-outline" size={16} color={colors.warning} />
            <Text style={styles.noticeText}>Por ahora funciona en la versión web de MacroEntreno.</Text>
          </View>
        ) : null}
      </View>

      <Grid>
        {COACH_EXERCISES.map((exercise) => {
          const rule = RULES[exercise.rule];
          const target = rule.mode === 'reps' ? `${rule.target} repeticiones` : `${rule.target} segundos`;
          return (
            <Pressable
              key={exercise.rule}
              onPress={() => router.push({ pathname: '/coach/[rule]', params: { rule: exercise.rule } })}
              accessibilityRole="button"
              accessibilityLabel={`${exercise.name}, ${target}`}
              style={({ pressed }) => [styles.item, continuous, pressed && styles.pressed]}
            >
              <View style={[styles.itemIcon, continuous]}>
                <Ionicons name={exercise.icon} size={20} color={colors.primary} />
              </View>
              <View style={styles.itemText}>
                <Text style={styles.itemName}>{exercise.name}</Text>
                <Text style={styles.itemSub} numberOfLines={1}>
                  {[exercise.group, ...exercise.muscles.filter((m) => m !== exercise.group)].join(' · ')}
                </Text>
              </View>
              <View style={[styles.badge, rule.mode === 'hold' && styles.badgeHold]}>
                <Ionicons name={rule.mode === 'reps' ? 'repeat' : 'timer-outline'} size={12} color={rule.mode === 'reps' ? colors.primary : colors.secondary} />
                <Text style={[styles.badgeText, rule.mode === 'hold' && { color: colors.secondary }]}>{rule.mode === 'reps' ? 'Reps' : 'Tiempo'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color="rgba(235,235,245,0.3)" />
            </Pressable>
          );
        })}
      </Grid>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.sm, padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.card },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  heroTitle: { color: colors.text, fontSize: font.xxl, fontWeight: '700', letterSpacing: tracking.title },
  heroText: { color: colors.muted, fontSize: font.md },
  notice: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginTop: spacing.xs },
  noticeText: { color: colors.warning, fontSize: font.sm, fontWeight: '600', flex: 1 },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.card, minHeight: 72 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  itemIcon: { width: 40, height: 40, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  itemText: { flex: 1, gap: 2 },
  itemName: { color: colors.text, fontSize: font.body - 1, fontWeight: '600' },
  itemSub: { color: colors.muted, fontSize: font.sm },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  badgeHold: { backgroundColor: 'rgba(100,210,255,0.16)' },
  badgeText: { color: colors.primary, fontSize: font.xs, fontWeight: '700' },
});
