import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { progressApi } from '../../api/endpoints';
import { Card, Chips, EmptyState, ErrorState, KcalBarChart, Loading, StatTile } from '../../components';
import { useResource } from '../../hooks/useResource';
import { colors, font, numeric, spacing } from '../../theme';
import { formatDayLabel, today } from '../../utils/dates';
import { fmt, signed } from '../../utils/format';

const RANGES = [
  { value: 7, label: '7 días' },
  { value: 14, label: '14 días' },
  { value: 30, label: '30 días' },
];

/** Progreso nutricional y de fuerza. Con `userId` muestra el de un atleta (coach/admin). */
export function ProgressView({ userId }) {
  const [days, setDays] = useState(7);
  const { data, error, loading, reload } = useResource(
    () => progressApi.get({ days, to: today(), userId }),
    [days, userId],
  );

  return (
    <>
      <Chips options={RANGES} value={days} onChange={setDays} />
      {error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !data ? (
        <Loading />
      ) : (
        <>
          <View style={styles.tiles}>
            <StatTile icon="flame-outline" label="kcal promedio" value={fmt(data.summary.avgKcal)} color={colors.kcal} />
            <StatTile icon="egg-outline" label="proteína prom. (g)" value={fmt(data.summary.avgProtein)} color={colors.protein} />
            <StatTile
              icon="checkmark-circle-outline"
              label="días en objetivo"
              value={`${data.summary.daysOnTarget}/${data.summary.loggedDays}`}
              color={colors.success}
            />
            <StatTile icon="barbell-outline" label="sesiones" value={data.summary.totalWorkouts} color={colors.warning} />
          </View>

          <Card title="Calorías por día">
            {days <= 14 ? (
              <KcalBarChart daily={data.daily} goal={data.goals.kcal} />
            ) : (
              <KcalBarChart daily={data.daily.filter((_, i) => i % 2 === 1)} goal={data.goals.kcal} />
            )}
            <View style={styles.legendRow}>
              <Legend color={colors.primary} label="En la meta (±10 %)" />
              <Legend color="rgba(48,209,88,0.38)" label="Por debajo" />
              <Legend color={colors.warning} label="Por encima" />
              <Legend color={colors.secondary} label="Entrenaste" dot />
            </View>
          </Card>

          <Card title="Fuerza (últimos 30 días)">
            {data.exercises.length === 0 ? (
              <EmptyState icon="trending-up-outline" title="Sin datos todavía" message="Registrá sesiones para comparar tu progreso." />
            ) : (
              data.exercises.map((e) => (
                <View key={`${e.exerciseId}-${e.name}`} style={styles.exercise}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.exName}>{e.name}</Text>
                    <Text style={styles.exSub}>
                      {formatDayLabel(e.latest.date)} · mejor {fmt(e.latest.bestWeight)} kg · {e.sessions} sesiones
                    </Text>
                  </View>
                  {e.delta ? (
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.delta, { color: e.delta.volume >= 0 ? colors.success : colors.danger }]}>
                        {signed(e.delta.volume, ' kg')}
                      </Text>
                      <Text style={styles.exSub}>volumen</Text>
                    </View>
                  ) : (
                    <Text style={styles.exSub}>1ra vez</Text>
                  )}
                </View>
              ))
            )}
          </Card>
        </>
      )}
    </>
  );
}

function Legend({ color, label, dot }) {
  return (
    <View style={styles.legendItem}>
      <View style={[dot ? styles.legendDot : styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={styles.legend}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 10, height: 10, borderRadius: 3 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legend: { color: colors.muted, fontSize: font.xs },
  exercise: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  exName: { color: colors.text, fontSize: font.md, fontWeight: '600' },
  exSub: { color: colors.muted, fontSize: font.xs },
  delta: { ...numeric, fontSize: font.md, fontWeight: '700' },
});
