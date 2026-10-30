import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { reportsApi } from '../../api/endpoints';
import { Button, Card, EmptyState, ErrorState, FormError, ListItem, Loading, Screen } from '../../components';
import { useResource } from '../../hooks/useResource';
import { colors, createStyles, font, useTheme } from '../../theme';
import { addDays, formatWeek } from '../../utils/dates';
import { fmt } from '../../utils/format';
import { savePdf } from '../../utils/savePdf';

export default function WeeklyReportsScreen() {
  useTheme();
  const { userId: param } = useLocalSearchParams();
  const userId = param ? Number(param) : undefined;
  const { data, error, reload, refreshing } = useResource(() => reportsApi.weeklyList(userId), [userId]);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const run = async (action) => {
    setBusy(true); setActionError(null);
    try { await action(); } catch (err) { setActionError(err.message); } finally { setBusy(false); }
  };
  return <Screen onRefresh={reload} refreshing={refreshing}>
    <Text style={styles.muted}>Cada lunes se publica el PDF de la semana anterior, de lunes a domingo, con la alimentación registrada, los entrenamientos realizados y la comparación de cargas. Los informes guardados conservan la información al momento del cierre.</Text>
    <FormError message={actionError} />
    <Button title="Generar última semana cerrada" variant="tinted" icon="refresh" loading={busy} onPress={() => run(async () => { await reportsApi.generateWeekly(undefined, userId); await reload(); })} />
    {error ? <ErrorState error={error} onRetry={reload} /> : !data ? <Loading /> : !data.length ? <EmptyState title="Todavía no hay informes" message="El primer informe automático estará disponible cuando termine tu primera semana." /> : <Card title="Informes disponibles">
      {data.map((r) => <ListItem key={r.id} title={formatWeek(r.weekStart)} subtitle={`${r.weekStart} al ${addDays(r.weekStart, 6)}`} icon="document-text-outline" onPress={() => run(async () => setSelected(await reportsApi.weekly(r.id)))} />)}
    </Card>}
    {selected && <Card title={`${selected.athlete.name} · ${formatWeek(selected.from)}`}>
      <Text style={styles.text}>{selected.summary.sessions} sesiones · {selected.summary.loggedDays}/7 días con comidas · {selected.summary.daysOnTarget} en objetivo</Text>
      <Text style={styles.text}>{selected.assessment}</Text>
      {selected.daily.map((d) => <Text key={d.date} style={styles.muted}>{d.date}: {d.meals ? `${fmt(d.kcal)} kcal` : 'Sin comidas registradas'} · {d.sessions} sesiones realizadas</Text>)}
      <Button title="Descargar PDF semanal" icon="download-outline" loading={busy} onPress={() => run(async () => savePdf(await reportsApi.weeklyPdf(selected.id)))} />
    </Card>}
  </Screen>;
}
const styles = createStyles(() => StyleSheet.create({ muted: { color: colors.muted, fontSize: font.sm }, text: { color: colors.text, fontSize: font.md } }));
