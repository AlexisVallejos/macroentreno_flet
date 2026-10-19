import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { diaryApi, usersApi } from '../../api/endpoints';
import { Card, Chips, DateSwitcher, ErrorState, Loading, RoleBadge, Screen } from '../../components';
import { useResource } from '../../hooks/useResource';
import { colors, font, spacing, tracking } from '../../theme';
import { today } from '../../utils/dates';
import { DiaryDay } from '../diary/DiaryDay';
import { ProgressView } from '../progress/ProgressView';
import { WorkoutList } from '../workouts/WorkoutList';
import { GoalsForm } from './GoalsForm';

/** Vista del coach (o admin) sobre un atleta: diario (solo lectura), rutinas, progreso y objetivos. */
export default function AthleteDetailScreen() {
  const { id: idParam } = useLocalSearchParams();
  const id = Number(idParam);
  const [tab, setTab] = useState('diary');
  const [date, setDate] = useState(today());
  const athlete = useResource(() => usersApi.get(id), [id]);
  const day = useResource(() => (tab === 'diary' ? diaryApi.day(date, id) : Promise.resolve(null)), [id, date, tab]);

  if (athlete.error && !athlete.data) return <ErrorState error={athlete.error} onRetry={athlete.reload} />;
  if (!athlete.data) return <Loading />;
  const a = athlete.data;

  return (
    <Screen>
      <Stack.Screen options={{ title: a.name }} />
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{a.name[0]?.toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.name}>{a.name}</Text>
          <Text style={styles.muted}>{a.email ?? 'sin email'}</Text>
          <RoleBadge role={a.role} />
        </View>
      </View>

      <Chips
        options={[
          { value: 'diary', label: 'Diario' },
          { value: 'workouts', label: 'Rutinas' },
          { value: 'progress', label: 'Progreso' },
          { value: 'goals', label: 'Objetivos' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'diary' ? (
        <>
          <DateSwitcher date={date} onChange={setDate} />
          {day.error && !day.data ? (
            <ErrorState error={day.error} onRetry={day.reload} />
          ) : !day.data ? (
            <Loading />
          ) : (
            <DiaryDay day={day.data} readOnly />
          )}
        </>
      ) : null}
      {tab === 'workouts' ? <WorkoutList userId={id} addLabel="Asignar rutina" /> : null}
      {tab === 'progress' ? <ProgressView userId={id} /> : null}
      {tab === 'goals' ? (
        <Card title="Objetivos diarios">
          <GoalsForm
            key={a.id}
            goals={a.goals}
            onSave={async (goals) => athlete.setData(await usersApi.updateGoals(id, goals))}
          />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.onPrimary, fontSize: font.xxl, fontWeight: '700' },
  name: { color: colors.text, fontSize: font.xl + 2, fontWeight: '700', letterSpacing: tracking.title },
  muted: { color: colors.muted, fontSize: font.sm },
});
