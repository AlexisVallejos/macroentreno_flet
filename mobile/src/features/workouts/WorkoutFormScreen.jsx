import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { workoutsApi } from '../../api/endpoints';
import { Button, Card, DateSwitcher, ErrorState, FormError, Loading, Screen, TextField } from '../../components';
import { colors, font, spacing } from '../../theme';
import { confirm } from '../../utils/confirm';
import { today } from '../../utils/dates';
import { toNumber } from '../../utils/validation';
import { ExercisePicker } from './ExercisePicker';

const emptySet = (prev) => ({ reps: prev?.reps ?? '10', weight: prev?.weight ?? '', rpe: '' });
let keySeq = 0;
const withKey = (exercise) => ({ ...exercise, key: `ex-${++keySeq}` });

/** Crear o editar una sesión: título, fecha, ejercicios y series. El coach puede cargarla a un atleta (?userId). */
export default function WorkoutFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = params.id ? Number(params.id) : null;
  const userId = params.userId ? Number(params.userId) : undefined;

  const [date, setDate] = useState(String(params.date || today()));
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [exercises, setExercises] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(id));
  const [loadError, setLoadError] = useState(null);
  const [ownerId, setOwnerId] = useState(userId);

  useEffect(() => {
    if (!id) return;
    workoutsApi
      .get(id)
      .then((w) => {
        setDate(w.date);
        setTitle(w.title);
        setNotes(w.notes || '');
        setOwnerId(w.userId);
        setExercises(
          w.exercises.map((e) =>
            withKey({
              exerciseId: e.exerciseId,
              name: e.name,
              sets: e.sets.map((s) => ({ reps: String(s.reps), weight: String(s.weight), rpe: s.rpe ? String(s.rpe) : '' })),
            }),
          ),
        );
      })
      .catch(setLoadError)
      .finally(() => setLoading(false));
  }, [id]);

  const updateExercise = (index, change) =>
    setExercises((list) => list.map((e, i) => (i === index ? { ...e, ...change(e) } : e)));

  const updateSet = (exIndex, setIndex, key, value) =>
    updateExercise(exIndex, (e) => ({ sets: e.sets.map((s, i) => (i === setIndex ? { ...s, [key]: value } : s)) }));

  const validate = () => {
    const found = {};
    if (title.trim().length < 2) found.title = 'Poné un título (ej. "Pecho y tríceps")';
    if (!exercises.length) found.exercises = 'Agregá al menos un ejercicio';
    exercises.forEach((e, i) =>
      e.sets.forEach((s, j) => {
        const reps = toNumber(s.reps);
        const weight = toNumber(s.weight);
        const rpe = toNumber(s.rpe);
        if (reps === undefined || Number.isNaN(reps) || reps < 0 || !Number.isInteger(reps)) found[`${i}.${j}`] = 'Reps inválidas';
        else if (weight !== undefined && (Number.isNaN(weight) || weight < 0)) found[`${i}.${j}`] = 'Peso inválido';
        else if (rpe !== undefined && (Number.isNaN(rpe) || rpe < 1 || rpe > 10)) found[`${i}.${j}`] = 'RPE entre 1 y 10';
      }),
    );
    return found;
  };

  const save = async () => {
    const found = validate();
    setErrors(found);
    setFormError(Object.keys(found).length ? 'Revisá los campos marcados' : null);
    if (Object.keys(found).length) return;
    const body = {
      date,
      title: title.trim(),
      notes: notes.trim() || null,
      userId: ownerId,
      exercises: exercises.map((e) => ({
        exerciseId: e.exerciseId || null,
        name: e.name,
        sets: e.sets.map((s) => ({ reps: toNumber(s.reps), weight: toNumber(s.weight) ?? 0, rpe: toNumber(s.rpe) ?? null })),
      })),
    };
    setSaving(true);
    try {
      if (id) await workoutsApi.update(id, body);
      else await workoutsApi.create(body);
      router.back();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!(await confirm('Eliminar sesión', `¿Eliminar "${title}"? No se puede deshacer.`))) return;
    try {
      await workoutsApi.remove(id);
      router.back();
    } catch (err) {
      setFormError(err.message);
    }
  };

  if (loading) return <Loading />;
  if (loadError) return <ErrorState error={loadError} onRetry={() => router.back()} />;

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          {id ? <Button title="Eliminar" variant="danger" icon="trash-outline" onPress={remove} /> : null}
          <Button title={id ? 'Guardar cambios' : 'Guardar sesión'} onPress={save} loading={saving} style={{ flex: 1 }} />
        </View>
      }
    >
      <Stack.Screen options={{ title: id ? 'Editar sesión' : ownerId ? 'Asignar rutina' : 'Nueva sesión' }} />
      <FormError message={formError} />
      <DateSwitcher date={date} onChange={setDate} />
      <TextField label="Título" value={title} onChangeText={setTitle} error={errors.title} placeholder="Ej. Pierna pesada" />
      <TextField label="Notas (opcional)" value={notes} onChangeText={setNotes} multiline />

      {exercises.map((exercise, i) => (
        <Card
          key={exercise.key}
          title={exercise.name}
          right={
            <Pressable
              onPress={() => setExercises((list) => list.filter((_, idx) => idx !== i))}
              hitSlop={10}
              accessibilityLabel={`Quitar ${exercise.name}`}
            >
              <Ionicons name="close-circle-outline" size={22} color={colors.danger} />
            </Pressable>
          }
        >
          <View style={styles.setHeader}>
            <Text style={[styles.colLabel, styles.setNum]}>#</Text>
            <Text style={styles.colLabel}>Reps</Text>
            <Text style={styles.colLabel}>Kg</Text>
            <Text style={styles.colLabel}>RPE</Text>
            <View style={{ width: 28 }} />
          </View>
          {exercise.sets.map((set, j) => (
            <View key={j}>
              <View style={styles.setRow}>
                <Text style={[styles.setNumText, styles.setNum]}>{j + 1}</Text>
                <TextField style={styles.setField} value={set.reps} onChangeText={(v) => updateSet(i, j, 'reps', v)} keyboardType="number-pad" />
                <TextField style={styles.setField} value={set.weight} onChangeText={(v) => updateSet(i, j, 'weight', v)} keyboardType="decimal-pad" placeholder="0" />
                <TextField style={styles.setField} value={set.rpe} onChangeText={(v) => updateSet(i, j, 'rpe', v)} keyboardType="number-pad" placeholder="–" />
                <Pressable
                  disabled={exercise.sets.length === 1}
                  onPress={() => updateExercise(i, (e) => ({ sets: e.sets.filter((_, k) => k !== j) }))}
                  hitSlop={8}
                  style={{ width: 28, opacity: exercise.sets.length === 1 ? 0.3 : 1 }}
                  accessibilityLabel={`Quitar serie ${j + 1}`}
                >
                  <Ionicons name="remove-circle-outline" size={22} color={colors.muted} />
                </Pressable>
              </View>
              {errors[`${i}.${j}`] ? <Text style={styles.error}>{errors[`${i}.${j}`]}</Text> : null}
            </View>
          ))}
          <Button
            title="Agregar serie"
            icon="add"
            variant="ghost"
            small
            onPress={() => updateExercise(i, (e) => ({ sets: [...e.sets, emptySet(e.sets.at(-1))] }))}
          />
        </Card>
      ))}
      {errors.exercises ? <Text style={styles.error}>{errors.exercises}</Text> : null}
      <Button title="Agregar ejercicio" icon="barbell-outline" variant="secondary" onPress={() => setPickerOpen(true)} />

      <ExercisePicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(picked) => {
          setExercises((list) => [...list, withKey({ ...picked, sets: [emptySet(), emptySet(), emptySet()] })]);
          setErrors((e) => ({ ...e, exercises: undefined }));
          setPickerOpen(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', gap: spacing.md },
  setHeader: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  setRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  setField: { flex: 1, minWidth: 60 },
  colLabel: { flex: 1, color: colors.muted, fontSize: font.xs, fontWeight: '700', minWidth: 60 },
  setNum: { flex: 0, width: 20, minWidth: 20 },
  setNumText: { color: colors.muted, fontSize: font.sm, fontWeight: '700' },
  error: { color: colors.danger, fontSize: font.xs, marginLeft: 28 },
});
