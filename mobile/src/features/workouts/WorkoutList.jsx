import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { workoutsApi } from '../../api/endpoints';
import { Button, EmptyState, ErrorState, Grid, Loading } from '../../components';
import { useResource } from '../../hooks/useResource';
import { colors, continuous, createStyles, font, radius, useTheme } from '../../theme';
import { addDays, formatWeek, mondayOf, today } from '../../utils/dates';
import { WorkoutCard } from './WorkoutCard';

/** Sesiones de una semana. Con `userId` muestra las de un atleta (vista del coach). */
export function WorkoutList({ userId, addLabel = 'Nueva sesión' }) {
  useTheme();
  const router = useRouter();
  const [monday, setMonday] = useState(mondayOf(today()));
  const { data, error, loading, reload } = useResource(
    () => workoutsApi.list({ from: monday, to: addDays(monday, 6), userId }),
    [monday, userId],
  );

  const open = (params) => router.push({ pathname: '/workout-form', params: userId ? { ...params, userId: String(userId) } : params });

  return (
    <>
      <View style={[styles.week, continuous]}>
        <Pressable onPress={() => setMonday(addDays(monday, -7))} style={styles.arrow} accessibilityLabel="Semana anterior">
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </Pressable>
        <Pressable onPress={() => setMonday(mondayOf(today()))} style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.weekLabel}>{formatWeek(monday)}</Text>
          <Text style={styles.weekSub}>{monday === mondayOf(today()) ? 'Esta semana' : 'Tocá para volver a esta semana'}</Text>
        </Pressable>
        <Pressable onPress={() => setMonday(addDays(monday, 7))} style={styles.arrow} accessibilityLabel="Semana siguiente">
          <Ionicons name="chevron-forward" size={22} color={colors.primary} />
        </Pressable>
      </View>

      <Button title={addLabel} icon="add" onPress={() => open({ date: monday <= today() && today() <= addDays(monday, 6) ? today() : monday })} />

      {/* El entrenador con cámara es para el propio atleta, no para la vista del coach */}
      {!userId ? (
        <Pressable
          onPress={() => router.push('/coach')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.coach, continuous, pressed && styles.coachPressed]}
        >
          <View style={styles.coachIcon}>
            <Ionicons name="scan" size={20} color={colors.onPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.coachTitle}>Entrenar con cámara</Text>
            <Text style={styles.weekSub}>Cuenta tus repeticiones y te corrige la técnica en vivo.</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={colors.chevron} />
        </Pressable>
      ) : null}

      {error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !data ? (
        <Loading />
      ) : data.length === 0 ? (
        <EmptyState icon="barbell-outline" title="Sin sesiones esta semana" message="Agregá una sesión para empezar a medir tu progreso." />
      ) : (
        <Grid>
          {data.map((w) => (
            <WorkoutCard key={w.id} workout={w} onPress={() => open({ id: String(w.id) })} />
          ))}
        </Grid>
      )}
    </>
  );
}

const styles = createStyles(() => StyleSheet.create({
  week: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
  },
  arrow: { width: 52, height: 54, alignItems: 'center', justifyContent: 'center' },
  weekLabel: { color: colors.text, fontSize: font.lg, fontWeight: '600' },
  weekSub: { color: colors.muted, fontSize: font.xs },
  coach: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.lg, backgroundColor: colors.card },
  coachPressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  coachIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  coachTitle: { color: colors.text, fontSize: font.md + 1, fontWeight: '600' },
}));
