import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { diaryApi, foodsApi } from '../../api/endpoints';
import { Button, Card, Chips, ErrorState, FieldRow, FormError, ListItem, Loading, MacroInline, Screen, TextField } from '../../components';
import { colors, font, spacing } from '../../theme';
import { MEALS } from '../../utils/constants';
import { confirm } from '../../utils/confirm';
import { round1 } from '../../utils/format';
import { toNumber, validateNumbers } from '../../utils/validation';

const scale = (food, grams) => {
  const f = (Number(grams) || 0) / food.portionGrams;
  return { kcal: round1(food.kcal * f), protein: round1(food.protein * f), carbs: round1(food.carbs * f), fat: round1(food.fat * f) };
};

/** Alta (desde el catálogo o manual) y edición de un registro del diario. */
export default function DiaryEntryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const editingId = params.id ? Number(params.id) : null;
  const date = String(params.date);

  const [meal, setMeal] = useState(String(params.meal || 'almuerzo'));
  const [mode, setMode] = useState('catalog');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [food, setFood] = useState(null);
  const [form, setForm] = useState({ name: '', grams: '100', kcal: '', protein: '', carbs: '', fat: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loadingEntry, setLoadingEntry] = useState(Boolean(editingId));
  const [loadError, setLoadError] = useState(null);
  const [entryFoodId, setEntryFoodId] = useState(null);
  const [original, setOriginal] = useState(null);

  // Edición: se busca el registro dentro del día.
  useEffect(() => {
    if (!editingId) return;
    diaryApi
      .day(date)
      .then((day) => {
        const entry = day.entries.find((e) => e.id === editingId);
        if (!entry) throw new Error('El registro ya no existe');
        setMeal(entry.meal);
        setEntryFoodId(entry.foodId);
        setMode('manual');
        const values = {
          name: entry.name,
          grams: String(entry.grams),
          kcal: String(entry.kcal),
          protein: String(entry.protein),
          carbs: String(entry.carbs),
          fat: String(entry.fat),
        };
        setForm(values);
        setOriginal({ ...values, meal: entry.meal });
      })
      .catch(setLoadError)
      .finally(() => setLoadingEntry(false));
  }, [editingId, date]);

  // Búsqueda en el catálogo con un pequeño retardo (debounce).
  useEffect(() => {
    if (mode !== 'catalog' || editingId) return undefined;
    const timer = setTimeout(() => {
      setSearching(true);
      foodsApi
        .list({ search: search.trim() || undefined, limit: 25 })
        .then((res) => {
          setResults(res.data);
          setSearchError(null);
        })
        .catch(setSearchError)
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [search, mode, editingId]);

  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const preview = useMemo(() => (food ? scale(food, toNumber(form.grams)) : null), [food, form.grams]);

  const save = async () => {
    setFormError(null);
    let body;
    if (mode === 'catalog' && !editingId) {
      if (!food) return setFormError('Elegí un alimento de la lista');
      const found = validateNumbers(form, ['grams'], { positive: ['grams'] });
      setErrors(found);
      if (Object.keys(found).length) return;
      body = { date, meal, foodId: food.id, grams: toNumber(form.grams) };
    } else {
      const found = validateNumbers(form, ['grams', 'kcal', 'protein', 'carbs', 'fat'], {
        required: ['grams', 'kcal'],
        positive: ['grams'],
      });
      if (!form.name || form.name.trim().length < 2) found.name = 'Ingresá un nombre';
      setErrors(found);
      if (Object.keys(found).length) return;
      body = {
        date,
        meal,
        name: form.name.trim(),
        grams: toNumber(form.grams),
        kcal: toNumber(form.kcal),
        protein: toNumber(form.protein) ?? 0,
        carbs: toNumber(form.carbs) ?? 0,
        fat: toNumber(form.fat) ?? 0,
      };
      if (editingId) {
        // Solo lo que cambió: si fueron únicamente los gramos, el backend recalcula los macros.
        const changed = { date };
        if (meal !== original.meal) changed.meal = meal;
        for (const key of ['name', 'grams', 'kcal', 'protein', 'carbs', 'fat']) {
          if (form[key] !== original[key]) changed[key] = body[key];
        }
        body = changed;
      }
    }
    setSaving(true);
    try {
      if (editingId) await diaryApi.update(editingId, body);
      else await diaryApi.create(body);
      router.back();
    } catch (err) {
      setErrors(err.fieldErrors);
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!(await confirm('Eliminar registro', '¿Eliminar este registro del diario?'))) return;
    try {
      await diaryApi.remove(editingId);
      router.back();
    } catch (err) {
      setFormError(err.message);
    }
  };

  if (loadingEntry) return <Loading />;
  if (loadError) return <ErrorState error={loadError} onRetry={() => router.back()} />;

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          {editingId ? <Button title="Eliminar" variant="danger" icon="trash-outline" onPress={remove} /> : null}
          <Button title={editingId ? 'Guardar cambios' : 'Agregar'} onPress={save} loading={saving} style={{ flex: 1 }} />
        </View>
      }
    >
      <Stack.Screen options={{ title: editingId ? 'Editar registro' : 'Registrar comida' }} />
      <FormError message={formError} />
      <View style={styles.section}>
        <Text style={styles.label}>Comida · {date}</Text>
        <Chips options={MEALS.map((m) => ({ value: m.key, label: m.label }))} value={meal} onChange={setMeal} />
      </View>

      {!editingId ? (
        <Chips
          options={[
            { value: 'catalog', label: 'Buscar en catálogo' },
            { value: 'manual', label: 'Carga manual' },
          ]}
          value={mode}
          onChange={setMode}
        />
      ) : null}

      {mode === 'catalog' && !editingId ? (
        <>
          <TextField
            placeholder="Buscar: pollo, arroz, alfajor…"
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            returnKeyType="search"
          />
          {food ? (
            <Card title={food.name} right={<Button title="Cambiar" variant="ghost" small onPress={() => setFood(null)} />}>
              <Text style={styles.muted}>
                {food.portionDescription || `Porción de ${food.portionGrams} g`}
                {food.brand ? ` · ${food.brand}` : ''}
              </Text>
              <TextField
                label="Cantidad (g)"
                value={form.grams}
                onChangeText={set('grams')}
                error={errors.grams}
                keyboardType="decimal-pad"
              />
              {preview ? <MacroInline {...preview} /> : null}
            </Card>
          ) : (
            <Card>
              {searching ? <Loading label="Buscando…" /> : null}
              {searchError ? <Text style={styles.error}>{searchError.message}</Text> : null}
              {!searching && !searchError && results.length === 0 ? (
                <Text style={styles.muted}>Sin resultados. Probá otra palabra o usá la carga manual.</Text>
              ) : null}
              {!searching &&
                results.map((item) => (
                  <ListItem
                    key={item.id}
                    icon={item.isGlobal ? 'nutrition-outline' : 'person-outline'}
                    iconColor={item.isGlobal ? colors.primary : colors.success}
                    title={item.name}
                    subtitle={`${item.kcal} kcal · ${item.portionDescription || `${item.portionGrams} g`}`}
                    onPress={() => {
                      setFood(item);
                      set('grams')(String(item.portionGrams));
                    }}
                  />
                ))}
            </Card>
          )}
        </>
      ) : (
        <Card>
          {entryFoodId ? (
            <Text style={styles.muted}>
              Viene del catálogo: si cambiás solo los gramos, los macros se recalculan solos.
            </Text>
          ) : null}
          <TextField label="Nombre" value={form.name} onChangeText={set('name')} error={errors.name} />
          <TextField
            label="Cantidad (g)"
            value={form.grams}
            onChangeText={set('grams')}
            error={errors.grams}
            keyboardType="decimal-pad"
          />
          <FieldRow>
            <TextField label="Kcal" value={form.kcal} onChangeText={set('kcal')} error={errors.kcal} keyboardType="decimal-pad" />
            <TextField label="Proteínas" value={form.protein} onChangeText={set('protein')} error={errors.protein} keyboardType="decimal-pad" />
          </FieldRow>
          <FieldRow>
            <TextField label="Carbohidratos" value={form.carbs} onChangeText={set('carbs')} error={errors.carbs} keyboardType="decimal-pad" />
            <TextField label="Grasas" value={form.fat} onChangeText={set('fat')} error={errors.fat} keyboardType="decimal-pad" />
          </FieldRow>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  label: { color: colors.muted, fontSize: font.sm, fontWeight: '600' },
  muted: { color: colors.muted, fontSize: font.sm },
  error: { color: colors.danger, fontSize: font.sm },
  footer: { flexDirection: 'row', gap: spacing.md },
});
