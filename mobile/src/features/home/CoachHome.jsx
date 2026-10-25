import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { coachingApi } from '../../api/endpoints';
import { Button, Card, DateSwitcher, EmptyState, ErrorState, Grid, Loading, Screen, StatTile, TextField } from '../../components';
import { useResource } from '../../hooks/useResource';
import { colors, font, spacing } from '../../theme';
import { formatWeek, mondayOf, today } from '../../utils/dates';

export default function CoachHome() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [date, setDate] = useState(today());
  const { data, error, loading, refreshing, reload, setData } = useResource(() => coachingApi.dashboard(date), [date]);
  const clients = (data?.clients || []).filter((c) => `${c.name} ${c.email}`.toLowerCase().includes(search.trim().toLowerCase()));
  return (
    <Screen onRefresh={reload} refreshing={refreshing}>
      <Text style={styles.intro}>Tus clientes, sus comidas y sus entrenamientos. Elegí un día para revisar su actividad y abrí cada ficha para el seguimiento completo.</Text>
      <DateSwitcher date={date} onChange={(next) => { setData(null); setDate(next); }} />
      {data && <>
        <Text style={styles.title}>Semana del {formatWeek(mondayOf(date))}</Text>
        <View style={styles.tiles}>
          <StatTile icon="people-outline" label="clientes" value={data.clients.length} />
          <StatTile icon="restaurant-outline" label="con comidas ese día" value={data.clients.filter((c) => c.day).length} color={colors.success} />
          <StatTile icon="barbell-outline" label="sesiones de la semana" value={data.clients.reduce((n, c) => n + c.sessions, 0)} color={colors.warning} />
        </View>
      </>}
      <TextField placeholder="Buscar cliente por nombre o email" value={search} onChangeText={setSearch} autoCorrect={false} />
      {error ? <ErrorState error={error} onRetry={reload} /> : loading || !data ? <Loading /> : !clients.length ? (
        <EmptyState icon="people-outline" title={search ? 'Sin coincidencias' : 'Sin clientes asignados'} message="El administrador asigna atletas desde Usuarios." />
      ) : <Grid>{clients.map((a) => (
        <Card key={a.id} title={a.name}>
          <Text style={styles.muted}>{a.email}{!a.isActive ? ' · Cuenta inactiva' : ''}</Text>
          <Text style={styles.body}>{a.day ? `${Math.round(a.day.kcal)} kcal · ${Math.round(a.day.protein)} g de proteína ese día` : 'Sin comidas registradas ese día'}</Text>
          <Text style={styles.muted}>{a.loggedDays}/7 días con comidas · {a.onTargetDays} en objetivo · {a.sessions} sesiones realizadas · {a.planned} pendientes</Text>
          <Button title="Ver seguimiento" icon="stats-chart-outline" variant="tinted" onPress={() => router.push(`/athlete/${a.id}`)} />
        </Card>
      ))}</Grid>}
    </Screen>
  );
}
const styles = StyleSheet.create({
  intro: { color: colors.muted, fontSize: font.sm },
  muted: { color: colors.muted, fontSize: font.sm },
  body: { color: colors.text, fontSize: font.md },
  title: { color: colors.text, fontSize: font.lg, fontWeight: '700' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
