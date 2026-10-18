import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { workoutsApi } from '../../api/endpoints';
import { Button, EmptyState, ErrorState, Grid, Loading } from '../../components';
import { useResource } from '../../hooks/useResource';
import { colors, font, radius } from '../../theme';
import { addDays, formatWeek, mondayOf, today } from '../../utils/dates';
import { WorkoutCard } from './WorkoutCard';

/** Sesiones de una semana. Con `userId` muestra las de un atleta (vista del coach). */
export function WorkoutList({ userId, addLabel = 'Nueva sesión' }) {
  const router = useRouter();
  const [monday, setMonday] = useState(mondayOf(today()));
  const { data, error, loading, reload } = useResource(
    () => workoutsApi.list({ from: monday, to: addDays(monday, 6), userId }),
    [monday, userId],
  );

  const open = (params) => router.push({ pathname: '/workout-form', params: userId ? { ...params, userId: String(userId) } : params });

  return (
    <>
      <View style={styles.week}>
        <Pressable onPress={() => setMonday(addDays(monday, -7))} style={styles.arrow} accessibilityLabel="Semana anterior">
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => setMonday(mondayOf(today()))} style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.weekLabel}>{formatWeek(monday)}</Text>
          <Text style={styles.weekSub}>{monday === mondayOf(today()) ? 'Esta semana' : 'Tocá para volver a esta semana'}</Text>
        </Pressable>
        <Pressable onPress={() => setMonday(addDays(monday, 7))} style={styles.arrow} accessibilityLabel="Semana siguiente">
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </Pressable>
      </View>

      <Button title={addLabel} icon="add" onPress={() => open({ date: monday <= today() && today() <= addDays(monday, 6) ? today() : monday })} />

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

const styles = StyleSheet.create({
  week: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  arrow: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  weekLabel: { color: colors.text, fontSize: font.lg, fontWeight: '700' },
  weekSub: { color: colors.muted, fontSize: font.xs },
});
