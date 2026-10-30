import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { reportsApi } from '../../api/endpoints';
import { Button, Card, EmptyState, ErrorState, FormError, Grid, Loading, Screen } from '../../components';
import { useResource } from '../../hooks/useResource';
import { colors, createStyles, font, spacing, useTheme } from '../../theme';
import { today } from '../../utils/dates';
import { savePdf } from '../../utils/savePdf';
const shiftMonth = (value, amount) => {
  const [y, m] = value.split('-').map(Number);
  const date = new Date(y, m - 1 + amount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};
export default function CoachReportsScreen() {
  useTheme();
  const router = useRouter();
  const [month, setMonth] = useState(today().slice(0, 7));
  const { data, error, reload, refreshing, setData } = useResource(() => reportsApi.monthly(month), [month]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const change = (next) => { setData(null); setMonth(next); };
  const download = async (coachId) => {
    setBusy(true); setActionError(null);
    try { await savePdf(await reportsApi.monthlyPdf(month, coachId)); } catch (err) { setActionError(err.message); } finally { setBusy(false); }
  };
  return <Screen onRefresh={reload} refreshing={refreshing}>
    <View style={styles.row}>
      <Button title="Anterior" small variant="tinted" onPress={() => change(shiftMonth(month, -1))} />
      <Text style={styles.heading}>{month}</Text>
      <Button title="Siguiente" small variant="tinted" disabled={month >= today().slice(0, 7)} onPress={() => change(shiftMonth(month, 1))} />
    </View>
    <View style={styles.row}>
      <Button title="Crear entrenador" icon="person-add-outline" onPress={() => router.push({ pathname: '/user-form', params: { role: 'coach' } })} />
      <Button title="Asignar atletas" variant="tinted" onPress={() => router.push('/users')} />
    </View>
    <FormError message={actionError} />
    {error ? <ErrorState error={error} onRetry={reload} /> : !data ? <Loading /> : <>
      {data.partial && <Text style={styles.muted}>Mes en curso: los resultados se actualizan con los registros y las asignaciones.</Text>}
      <Button title="Descargar reporte de todos los entrenadores" icon="download-outline" loading={busy} onPress={() => download()} />
      {!data.coaches.length ? <EmptyState title="Sin entrenadores" message="Creá el primer entrenador y asignale atletas desde Usuarios." /> : <Grid>{data.coaches.map((c) => <Card key={c.id} title={c.name}>
        <Text style={styles.muted}>{c.email}{!c.isActive ? ' · Inactivo' : ''}</Text>
        <Text style={styles.heading}>{c.clientsServed} clientes atendidos · {c.newClients} nuevos</Text>
        <Text style={styles.text}>{c.clientsAtEnd} clientes {data.partial ? 'actuales' : 'al cierre'}</Text>
        <Text style={styles.muted}>{c.activeClients} clientes con comidas · {c.trainingClients} con entrenamientos</Text>
        <Text style={styles.muted}>{c.workouts} sesiones realizadas · {c.meals} comidas registradas</Text>
        <Text style={styles.muted}>{c.routines} rutinas asignadas · {c.plans} planes creados en el mes</Text>
        <Button title="Descargar PDF del entrenador" variant="tinted" icon="document-text-outline" loading={busy} onPress={() => download(c.id)} />
        <Button title="Editar entrenador" variant="ghost" onPress={() => router.push({ pathname: '/user-form', params: { id: String(c.id) } })} />
      </Card>)}</Grid>}
      <Card title="Cómo se cuentan los resultados"><Text style={styles.muted}>{data.methodology}</Text></Card>
    </>}
  </Screen>;
}
const styles = createStyles(() => StyleSheet.create({ row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md }, heading: { color: colors.text, fontSize: font.lg, fontWeight: '600' }, text: { color: colors.text, fontSize: font.md }, muted: { color: colors.muted, fontSize: font.sm } }));
