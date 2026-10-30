import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { diaryApi, foodsApi } from '../../api/endpoints';
import { Button, Card, Chips, ErrorState, FieldRow, FormError, ListItem, Loading, MacroInline, Screen, TextField } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { colors, continuous, createStyles, font, radius, spacing, useTheme } from '../../theme';
import { MEALS } from '../../utils/constants';
import { confirm } from '../../utils/confirm';
import { round1 } from '../../utils/format';
import { toNumber, validateNumbers } from '../../utils/validation';
import { BarcodeScanner } from './BarcodeScanner';
import { FoodPhotoCard } from './FoodPhotoCard';

/** Bases gratuitas: se busca al confirmar (no letra por letra) para respetar sus límites de uso. */
const EXTERNAL = {
  off: { source: 'openfoodfacts', placeholder: 'Producto o marca: yogur ser, galletitas…', hint: 'Open Food Facts: productos envasados de todo el mundo, con muchas marcas argentinas.' },
  usda: { source: 'usda', placeholder: 'En inglés: chicken breast, oats, banana…', hint: 'USDA: alimentos genéricos analizados en laboratorio. Los nombres están en inglés.' },
};

/** Vista previa de los micronutrientes que trae el alimento para esos gramos (solo los conocidos). */
const MICRO_PREVIEW = [
  ['fiber', 'Fibra', 'g'],
  ['sodium', 'Sodio', 'mg'],
  ['potassium', 'Potasio', 'mg'],
  ['calcium', 'Calcio', 'mg'],
  ['iron', 'Hierro', 'mg'],
  ['vitaminC', 'Vit. C', 'mg'],
];
const microPreview = (food, grams) => {
  if (!food.micros) return null;
  const f = (Number(grams) || 0) / food.portionGrams;
  const parts = MICRO_PREVIEW.filter(([key]) => food.micros[key] !== null).map(([key, label, unit]) => `${label} ${round1(food.micros[key] * f)} ${unit}`);
  return parts.length ? parts.join(' · ') : 'Este alimento no informa micronutrientes.';
};

const scale = (food, grams) => {
  const f = (Number(grams) || 0) / food.portionGrams;
  return { kcal: round1(food.kcal * f), protein: round1(food.protein * f), carbs: round1(food.carbs * f), fat: round1(food.fat * f) };
};

/** Alta (desde el catálogo o manual) y edición de un registro del diario. */
export default function DiaryEntryScreen() {
  useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const isPro = Boolean(user?.plan?.pro);
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
  const [importing, setImporting] = useState(null);
  const [original, setOriginal] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

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

  // Pro: búsqueda en FatSecret (necesita al menos 2 letras; un poco más de espera porque es un servicio externo).
  useEffect(() => {
    if (mode !== 'fatsecret' || editingId) return undefined;
    if (search.trim().length < 2) return undefined;
    const timer = setTimeout(() => {
      setSearching(true);
      foodsApi
        .searchFatSecret(search.trim(), { limit: 20 })
        .then((res) => {
          setResults(res.foods);
          setSearchError(null);
        })
        .catch(setSearchError)
        .finally(() => setSearching(false));
    }, 500);
    return () => clearTimeout(timer);
  }, [search, mode, editingId]);

  const searchExternal = async () => {
    const term = search.trim();
    if (term.length < 2) return setSearchError({ message: 'Escribí al menos 2 letras' });
    setSearching(true);
    setSearchError(null);
    try {
      setResults(await foodsApi.searchExternal(EXTERNAL[mode].source, term));
    } catch (err) {
      setSearchError(err);
    } finally {
      setSearching(false);
    }
  };

  /** Guarda el alimento externo en el catálogo y lo deja elegido. */
  const pickExternal = async (item) => {
    setImporting(item.externalId);
    setFormError(null);
    try {
      const imported = await foodsApi.importExternal(item.source, item.externalId);
      setFood(imported);
      setForm((f) => ({ ...f, grams: String(item.servingGrams || 100) }));
    } catch (err) {
      setFormError(err.message);
    } finally {
      setImporting(null);
    }
  };

  /** Código leído: catálogo → Open Food Facts. Si no aparece, se ofrece la carga manual. */
  const onScanned = async (code) => {
    setScannerOpen(false);
    setLookingUp(true);
    setFormError(null);
    try {
      const res = await foodsApi.barcode(code);
      if (res.found) {
        setMode('catalog');
        setFood(res.food);
        setForm((f) => ({ ...f, grams: String(res.food.portionGrams) }));
      } else {
        setMode('manual');
        setFormError(`No encontramos el código ${code}. Cargalo a mano con los datos de la etiqueta.`);
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setLookingUp(false);
    }
  };

  const changeMode = (next) => {
    if (next === 'fatsecret' && !isPro) {
      router.push('/pro');
      return;
    }
    setResults([]);
    setSearchError(null);
    setFood(null);
    setMode(next);
  };

  /** Importa el alimento de FatSecret al catálogo y lo deja elegido. */
  const pickFatSecret = async (item) => {
    setImporting(item.externalId);
    setFormError(null);
    try {
      const imported = await foodsApi.importFatSecret(item.externalId);
      setFood(imported);
      setForm((f) => ({ ...f, grams: '100' }));
    } catch (err) {
      setFormError(err.message);
    } finally {
      setImporting(null);
    }
  };

  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  // En FatSecret, con menos de 2 letras no se muestran resultados viejos.
  const visible = mode === 'fatsecret' && search.trim().length < 2 ? [] : results;
  const external = EXTERNAL[mode];
  const searchable = !['manual', 'photo'].includes(mode) && !editingId;

  const preview = useMemo(() => (food ? scale(food, toNumber(form.grams)) : null), [food, form.grams]);

  const save = async () => {
    setFormError(null);
    let body;
    if (searchable) {
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
        mode === 'photo' ? null : (
          <View style={styles.footer}>
            {editingId ? <Button title="Eliminar" variant="danger" icon="trash-outline" onPress={remove} /> : null}
            <Button title={editingId ? 'Guardar cambios' : 'Agregar'} onPress={save} loading={saving} style={{ flex: 1 }} />
          </View>
        )
      }
    >
      <Stack.Screen options={{ title: editingId ? 'Editar registro' : 'Registrar comida' }} />
      <FormError message={formError} />
      <View style={styles.section}>
        <Text style={styles.label}>Comida · {date}</Text>
        <Chips options={MEALS.map((m) => ({ value: m.key, label: m.label }))} value={meal} onChange={setMeal} />
      </View>

      {!editingId ? (
        <View style={styles.quickRow}>
          <QuickTile icon="barcode-outline" title="Escanear" subtitle="Código de barras" onPress={() => setScannerOpen(true)} />
          <QuickTile icon="camera-outline" title="Foto con IA" subtitle="Analiza tu plato" active={mode === 'photo'} onPress={() => changeMode('photo')} />
          <QuickTile icon="sparkles-outline" title="Asistente" subtitle="Contale qué comiste" onPress={() => router.push('/assistant')} />
        </View>
      ) : null}
      {lookingUp ? <Loading label="Buscando el producto…" /> : null}

      {!editingId && mode !== 'photo' ? (
        <View style={styles.section}>
          <Text style={styles.label}>Buscar en</Text>
          <Chips
            options={[
              { value: 'catalog', label: 'Mi catálogo' },
              { value: 'off', label: 'Open Food Facts' },
              { value: 'usda', label: 'USDA' },
              { value: 'fatsecret', label: isPro ? 'FatSecret · Pro' : 'FatSecret · Pro (bloqueado)' },
              { value: 'manual', label: 'Carga manual' },
            ]}
            value={mode}
            onChange={changeMode}
          />
        </View>
      ) : null}

      {mode === 'photo' && !editingId ? (
        <FoodPhotoCard date={date} meal={meal} onDone={() => router.back()} />
      ) : searchable ? (
        <>
          <View style={styles.searchRow}>
            <TextField
              label="Buscar alimento"
              placeholder={external ? external.placeholder : mode === 'fatsecret' ? 'banana, yogur, oats…' : 'pollo, arroz, alfajor…'}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={external ? searchExternal : undefined}
              hint={external?.hint}
              style={{ flex: 1 }}
            />
            {external ? <Button title="Buscar" icon="search" onPress={searchExternal} loading={searching} style={styles.searchButton} /> : null}
          </View>
          {food ? (
            <Card title={food.name} right={<Button title="Cambiar" variant="ghost" onPress={() => setFood(null)} />}>
              <Text style={styles.muted}>
                {food.portionDescription || `Porción de ${food.portionGrams} g`}
                {food.brand ? ` · ${food.brand}` : ''}
                {food.barcode ? ` · ${food.barcode}` : ''}
              </Text>
              <TextField
                label="Cantidad (g)"
                value={form.grams}
                onChangeText={set('grams')}
                error={errors.grams}
                keyboardType="decimal-pad"
              />
              {preview ? <MacroInline {...preview} /> : null}
              {food.micros ? <Text style={styles.muted}>{microPreview(food, toNumber(form.grams))}</Text> : null}
            </Card>
          ) : (
            <Card>
              {searching ? <Loading label="Buscando…" /> : null}
              {searchError ? <Text style={styles.error}>{searchError.message}</Text> : null}
              {!searching && !searchError && visible.length === 0 ? (
                <Text style={styles.muted}>
                  {external
                    ? 'Escribí qué querés buscar y tocá Buscar.'
                    : mode === 'fatsecret' && search.trim().length < 2
                      ? 'Escribí qué comiste. FatSecret trae vitaminas y minerales; los genéricos suelen estar en inglés (ej. "oats").'
                      : 'Sin resultados. Probá otra palabra, buscá en Open Food Facts o usá la carga manual.'}
                </Text>
              ) : null}
              {!searching &&
                (mode === 'fatsecret' || external) &&
                visible.map((item) => (
                  <ListItem
                    key={`${item.source ?? 'fatsecret'}-${item.externalId}`}
                    icon={mode === 'off' ? 'barcode-outline' : 'leaf-outline'}
                    title={item.brand ? `${item.name} · ${item.brand}` : item.name}
                    subtitle={`${item.kcal} kcal ${item.portionDescription}${item.microsCount ? ` · ${item.microsCount} ${item.microsCount === 1 ? 'micronutriente' : 'micronutrientes'}` : ''}`}
                    right={importing === item.externalId ? <ActivityIndicator color={colors.primary} /> : undefined}
                    onPress={importing ? undefined : () => (external ? pickExternal(item) : pickFatSecret(item))}
                  />
                ))}
              {!searching &&
                mode === 'catalog' &&
                visible.map((item) => (
                  <ListItem
                    key={item.id}
                    icon={item.isGlobal ? 'nutrition-outline' : 'person-outline'}
                    iconColor={item.isGlobal ? colors.primary : colors.secondary}
                    title={item.brand ? `${item.name} · ${item.brand}` : item.name}
                    subtitle={`${item.kcal} kcal · ${item.portionDescription || `${item.portionGrams} g`}`}
                    onPress={() => {
                      setFood(item);
                      set('grams')(String(item.portionGrams));
                    }}
                  />
                ))}
            </Card>
          )}
          {external ? <Text style={styles.credit}>Datos de {external.source === 'usda' ? 'USDA FoodData Central' : 'Open Food Facts (ODbL)'}</Text> : null}
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
      {!editingId ? <BarcodeScanner visible={scannerOpen} onClose={() => setScannerOpen(false)} onScanned={onScanned} /> : null}
    </Screen>
  );
}

/** Acceso rápido con ícono, como los botones de acción de las apps de Apple. */
function QuickTile({ icon, title, subtitle, onPress, active }) {
  useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${subtitle}`}
      accessibilityState={{ selected: Boolean(active) }}
      style={({ pressed }) => [styles.tile, continuous, active && styles.tileActive, pressed && styles.tilePressed]}
    >
      <View style={[styles.tileIcon, continuous, active && styles.tileIconActive]}>
        <Ionicons name={icon} size={22} color={active ? colors.onPrimary : colors.primary} />
      </View>
      <Text style={styles.tileTitle} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.tileSubtitle} numberOfLines={2}>
        {subtitle}
      </Text>
    </Pressable>
  );
}

const styles = createStyles(() => StyleSheet.create({
  section: { gap: spacing.sm },
  label: { color: colors.muted, fontSize: font.sm, fontWeight: '600' },
  muted: { color: colors.muted, fontSize: font.sm },
  error: { color: colors.danger, fontSize: font.sm },
  footer: { flexDirection: 'row', gap: spacing.md },
  quickRow: { flexDirection: 'row', gap: spacing.md },
  tile: { flex: 1, minHeight: 112, padding: spacing.md, gap: 4, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1.5, borderColor: 'transparent' },
  tileActive: { borderColor: colors.primary },
  tilePressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  tileIcon: { width: 40, height: 40, borderRadius: 12, marginBottom: 4, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  tileIconActive: { backgroundColor: colors.primary },
  tileTitle: { color: colors.text, fontSize: font.md, fontWeight: '600' },
  tileSubtitle: { color: colors.muted, fontSize: font.xs },
  searchRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  searchButton: { marginTop: 25 },
  credit: { color: colors.muted, fontSize: font.xs, textAlign: 'center' },
}));
