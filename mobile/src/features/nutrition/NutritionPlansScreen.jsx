import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { coachingApi } from '../../api/endpoints';
import { Button, Card, DateSwitcher, EmptyState, ErrorState, FormError, Loading, Screen } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { useResource } from '../../hooks/useResource';
import { colors, font, spacing } from '../../theme';
import { confirm, notify } from '../../utils/confirm';
import { mealLabel } from '../../utils/constants';
import { today } from '../../utils/dates';
import { fmt } from '../../utils/format';
import { savePdf } from '../../utils/savePdf';
export const WEEKDAYS = ['Todos los días', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export default function NutritionPlansScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { userId: param } = useLocalSearchParams();
  const userId = param ? Number(param) : undefined;
  const staff = user.role !== 'athlete';
  const [date, setDate] = useState(today());
  const { data, error, reload, refreshing } = useResource(() => coachingApi.plans(userId), [userId]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay() || 7;
  const run = async (fn) => {
    setBusy(true); setActionError(null);
    try { await fn(); } catch (err) { setActionError(err.message); } finally { setBusy(false); }
  };
  const apply = async (plan) => {
    if (!(await confirm('Registrar comidas del plan', `Se copiarán todas las comidas previstas para el ${date}. Confirmá que las consumiste; después podés ajustar cantidades en tu diario.`, { confirmText: 'Registrar comidas', destructive: false }))) return;
    await run(async () => {
      const result = await coachingApi.applyPlan(plan.id, date);
      notify('Plan de alimentación', result.alreadyApplied ? 'Este plan ya estaba agregado para esa fecha.' : `${result.added} comidas agregadas a tu diario.`);
    });
  };
  return <Screen onRefresh={reload} refreshing={refreshing}>
    <Text style={styles.muted}>Consultá las indicaciones y descargá tu plan en PDF. Las comidas se registran cuando confirmás que las consumiste.</Text>
    {staff && <Button title="Crear plan de alimentación" icon="add" onPress={() => router.push({ pathname: '/nutrition-plan-form', params: { userId: String(userId) } })} />}
    <DateSwitcher date={date} onChange={setDate} />
    <FormError message={actionError} />
    {error ? <ErrorState error={error} onRetry={reload} /> : !data ? <Loading /> : !data.length ? <EmptyState title="Sin planes de alimentación" message={staff ? 'Creá un plan con alimentos, cantidades e indicaciones.' : 'Tu entrenador podrá asignarte un plan que verás acá.'} /> : data.map((p) => {
      const valid = !p.archived && date >= p.startDate && date <= p.endDate;
      const items = p.items.filter((i) => i.dayOfWeek === 0 || i.dayOfWeek === weekday);
      const total = (key) => fmt(items.reduce((sum, item) => sum + Number(item[key]), 0));
      return <Card key={p.id} title={`${p.title}${p.archived ? ' · Archivado' : ''}`}>
        <Text style={styles.muted}>{p.athleteName} · {p.coachName || 'Equipo MacroEntreno'}</Text>
        <Text style={styles.muted}>{p.startDate} al {p.endDate}{!valid && !p.archived ? ' · Fuera de vigencia para la fecha elegida' : ''}</Text>
        {p.notes ? <Text style={styles.text}>{p.notes}</Text> : null}
        <Text style={styles.heading}>Menú de {WEEKDAYS[weekday].toLowerCase()}</Text>
        {!items.length ? <Text style={styles.muted}>No hay comidas asignadas para este día.</Text> : items.map((i) => <View key={i.id} style={styles.item}>
          <Text style={styles.text}>{mealLabel(i.meal)} · {i.name} · {fmt(i.grams)} g</Text>
          <Text style={styles.muted}>{fmt(i.kcal)} kcal · P {fmt(i.protein)} g · C {fmt(i.carbs)} g · G {fmt(i.fat)} g</Text>
        </View>)}
        {!!items.length && <Text style={styles.text}>Total del día: {total('kcal')} kcal · P {total('protein')} g · C {total('carbs')} g · G {total('fat')} g</Text>}
        {!staff && <Button title="Agregar estas comidas a mi diario" icon="restaurant-outline" disabled={!valid || !items.length || date > today()} loading={busy} onPress={() => apply(p)} />}
        <Button title="Descargar plan completo en PDF" icon="download-outline" variant="tinted" loading={busy} onPress={() => run(async () => savePdf(await coachingApi.planPdf(p.id)))} />
        {staff && !p.archived && <Button title="Archivar plan" variant="ghost" disabled={busy} onPress={async () => {
          if (await confirm('Archivar plan', 'El atleta podrá consultarlo, pero ya no podrá agregarlo al diario.', { confirmText: 'Archivar', destructive: false })) run(async () => { await coachingApi.archivePlan(p.id); await reload(); });
        }} />}
      </Card>;
    })}
  </Screen>;
}
const styles = StyleSheet.create({ muted: { color: colors.muted, fontSize: font.sm }, text: { color: colors.text, fontSize: font.md }, heading: { color: colors.text, fontSize: font.lg, fontWeight: '600' }, item: { gap: 4, paddingVertical: spacing.sm } });
