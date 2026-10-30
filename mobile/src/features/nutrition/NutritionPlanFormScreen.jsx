import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { coachingApi, foodsApi } from '../../api/endpoints';
import { Button, Card, Chips, EmptyState, ErrorState, FormError, ListItem, Loading, Screen, TextField } from '../../components';
import { useResource } from '../../hooks/useResource';
import { colors, createStyles, font, spacing, useTheme } from '../../theme';
import { MEALS, mealLabel } from '../../utils/constants';
import { addDays, today } from '../../utils/dates';
import { fmt } from '../../utils/format';
import { WEEKDAYS } from './NutritionPlansScreen';

export default function NutritionPlanFormScreen() {
  useTheme();
  const router = useRouter();
  const { userId } = useLocalSearchParams();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(addDays(today(), 27));
  const [items, setItems] = useState([]);
  const [dayOfWeek, setDay] = useState(0);
  const [meal, setMeal] = useState('desayuno');
  const [search, setSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const { data: foods, error, reload } = useResource(() => foodsApi.list({ search: searchTerm || undefined, scope: 'global', limit: 30 }), [searchTerm]);
  const setGrams = (index, grams) => setItems((list) => list.map((item, i) => i === index ? { ...item, grams } : item));
  const save = async () => {
    setFormError(null);
    const validDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
    if (title.trim().length < 2) return setFormError('Ingresá un título de al menos 2 caracteres');
    if (!validDate(startDate) || !validDate(endDate) || endDate < startDate) return setFormError('Revisá las fechas: AAAA-MM-DD, con el fin posterior al inicio');
    if (!items.length || items.some((i) => !Number.isFinite(Number(i.grams.replace(',', '.'))) || Number(i.grams.replace(',', '.')) <= 0)) return setFormError('Agregá al menos un alimento y cantidades mayores a cero');
    setSaving(true);
    try {
      await coachingApi.createPlan({ athleteId: Number(userId), title: title.trim(), notes: notes.trim(), startDate, endDate,
        items: items.map((i) => ({ foodId: i.food.id, dayOfWeek: i.dayOfWeek, meal: i.meal, grams: Number(i.grams.replace(',', '.')) })) });
      router.back();
    } catch (err) { setFormError(err.message); } finally { setSaving(false); }
  };
  return <Screen footer={<Button title="Asignar plan al atleta" icon="checkmark" loading={saving} onPress={save} />}>
    <Stack.Screen options={{ title: 'Nuevo plan de alimentación' }} />
    <FormError message={formError} />
    <Card title="Indicaciones y vigencia">
      <TextField label="Título" value={title} onChangeText={setTitle} maxLength={120} placeholder="Ej. Plan semanal de entrenamiento" />
      <TextField label="Indicaciones para el atleta" value={notes} onChangeText={setNotes} maxLength={3000} multiline />
      <View style={styles.row}>
        <TextField label="Inicio (AAAA-MM-DD)" value={startDate} onChangeText={setStartDate} style={{ flex: 1, minWidth: 160 }} />
        <TextField label="Fin (AAAA-MM-DD)" value={endDate} onChangeText={setEndDate} style={{ flex: 1, minWidth: 160 }} />
      </View>
    </Card>
    <Card title="Agregar alimentos al menú">
      <Text style={styles.muted}>Los alimentos de Todos los días se suman a los específicos de cada día. Elegí el día y la comida antes de agregar un alimento.</Text>
      <Chips options={WEEKDAYS.map((label, value) => ({ label, value }))} value={dayOfWeek} onChange={setDay} />
      <Chips options={MEALS.map((m) => ({ label: m.label, value: m.key }))} value={meal} onChange={setMeal} />
      <TextField label="Buscar en el catálogo" value={search} onChangeText={setSearch} onSubmitEditing={() => setSearchTerm(search.trim())} returnKeyType="search" />
      <Button title="Buscar alimentos" variant="tinted" small onPress={() => setSearchTerm(search.trim())} />
      {error ? <ErrorState error={error} onRetry={reload} /> : !foods ? <Loading /> : !foods.data.length ? <EmptyState title="Sin alimentos" message="Probá otra búsqueda o agregá el alimento desde Catálogo." /> : foods.data.map((f) => <ListItem key={f.id} title={f.name} subtitle={`${fmt(f.kcal)} kcal por ${fmt(f.portionGrams)} g · Tocá para agregar`}
        onPress={() => setItems((list) => [...list, { food: f, dayOfWeek, meal, grams: String(f.portionGrams) }])} />)}
    </Card>
    <Card title={`Menú del plan · ${items.length} alimentos`}>
      {!items.length && <Text style={styles.muted}>Seleccioná alimentos del catálogo para armar el plan.</Text>}
      {items.map((item, index) => <View key={index} style={styles.item}>
        <Text style={styles.text}>{WEEKDAYS[item.dayOfWeek]} · {mealLabel(item.meal)} · {item.food.name}</Text>
        <View style={styles.row}>
          <TextField label="Cantidad (gramos)" value={item.grams} onChangeText={(g) => setGrams(index, g)} keyboardType="decimal-pad" style={{ flex: 1 }} />
          <Button title="Quitar" variant="danger" small onPress={() => setItems((list) => list.filter((_, i) => i !== index))} />
        </View>
      </View>)}
    </Card>
  </Screen>;
}
const styles = createStyles(() => StyleSheet.create({ row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, alignItems: 'center' }, item: { gap: spacing.sm, paddingVertical: spacing.md }, text: { color: colors.text, fontSize: font.md }, muted: { color: colors.muted, fontSize: font.sm } }));
