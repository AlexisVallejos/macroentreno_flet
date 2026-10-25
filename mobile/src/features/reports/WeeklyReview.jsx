import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { reportsApi } from '../../api/endpoints';
import { Button, Card, ErrorState, KcalBarChart, ListItem, Loading, StatTile } from '../../components';
import { useResource } from '../../hooks/useResource';
import { colors, font, spacing } from '../../theme';
import { addDays, formatDayLabel, formatWeek, mondayOf, today } from '../../utils/dates';
import { fmt } from '../../utils/format';

export function WeeklyReview({ userId, onSelectDate }) {
  const [week, setWeek] = useState(mondayOf(today()));
  const { data, error, loading, reload, setData } = useResource(() => reportsApi.weeklyPreview(week, userId), [week, userId]);
  const change = (next) => { setData(null); setWeek(next); };
  return <>
    <View style={styles.nav}>
      <Button title="Anterior" icon="chevron-back" small variant="tinted" onPress={() => change(addDays(week, -7))} />
      <Text style={styles.text}>{formatWeek(week)}</Text>
      <Button title="Siguiente" small variant="tinted" disabled={week >= mondayOf(today())} onPress={() => change(addDays(week, 7))} />
    </View>
    {error ? <ErrorState error={error} onRetry={reload} /> : loading || !data ? <Loading /> : <>
      {data.partial && <Text style={styles.muted}>Semana en curso. El PDF se genera automáticamente al cerrarse el domingo.</Text>}
      <View style={styles.nav}>
        <StatTile icon="restaurant-outline" label="días con comidas" value={`${data.summary.loggedDays}/7`} />
        <StatTile icon="barbell-outline" label="sesiones realizadas" value={data.summary.sessions} color={colors.warning} />
        <StatTile icon="checkmark-circle-outline" label="días en objetivo" value={data.summary.daysOnTarget} color={colors.success} />
      </View>
      <Card title="Alimentación de la semana">
        <KcalBarChart daily={data.daily} goal={data.goals.kcal} />
        <Text style={styles.text}>{data.summary.avgKcal == null ? 'Sin registros de alimentación' : `${fmt(data.summary.avgKcal)} kcal promedio · ${fmt(data.summary.avgProtein)} g de proteína`}</Text>
        <Text style={styles.muted}>Promedios sobre días con registros. Meta: {fmt(data.goals.kcal)} kcal; margen del 10 %.</Text>
      </Card>
      <Card title="Comparación con la semana anterior">
        <Text style={styles.text}>{data.assessment}</Text>
        <Text style={styles.muted}>{data.summary.sessions} vs. {data.previous.summary.sessions} sesiones · {fmt(data.summary.volume)} vs. {fmt(data.previous.summary.volume)} kg de volumen</Text>
        <Text style={styles.muted}>Días con comidas: {data.summary.loggedDays} vs. {data.previous.summary.loggedDays}. Más volumen no demuestra por sí solo progreso físico.</Text>
        {data.exercises.map((e, i) => <ListItem key={`${e.name}-${i}`} title={e.name} subtitle={`${fmt(e.bestWeight)} kg máximos · ${e.deltaWeight == null ? 'Sin comparación previa' : `${e.deltaWeight > 0 ? '+' : ''}${fmt(e.deltaWeight)} kg respecto a la semana anterior`}`} />)}
      </Card>
      <Card title="Detalle por día">
        {data.daily.map((d) => <ListItem key={d.date} title={formatDayLabel(d.date)}
          subtitle={`${d.meals ? `${fmt(d.kcal)} kcal · P ${fmt(d.protein)} g · C ${fmt(d.carbs)} g · G ${fmt(d.fat)} g` : 'Sin comidas'} · ${d.sessions} sesiones realizadas`}
          onPress={onSelectDate ? () => onSelectDate(d.date) : undefined} />)}
      </Card>
    </>}
  </>;
}
const styles = StyleSheet.create({
  nav: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, alignItems: 'center' },
  text: { color: colors.text, fontSize: font.md }, muted: { color: colors.muted, fontSize: font.sm },
});
