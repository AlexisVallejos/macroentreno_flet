import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { exercisesApi } from '../../api/endpoints';
import { Button, Chips, ErrorState, FormError, Loading, Screen, TextField } from '../../components';
import { colors, font, spacing } from '../../theme';
import { confirm } from '../../utils/confirm';

const DEFAULT_GROUPS = ['Pecho', 'Espalda', 'Piernas', 'Hombros', 'Biceps', 'Triceps', 'Core'];

/** Alta / edición / baja de un ejercicio del catálogo (coach y admin). */
export default function ExerciseFormScreen() {
  const router = useRouter();
  const { id: idParam } = useLocalSearchParams();
  const id = idParam ? Number(idParam) : null;
  const [form, setForm] = useState({ name: '', muscleGroup: '', equipment: '', imageUrl: '' });
  const [groups, setGroups] = useState(DEFAULT_GROUPS);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(id));
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    exercisesApi
      .muscleGroups()
      .then((list) => setGroups([...new Set([...DEFAULT_GROUPS, ...list])]))
      .catch(() => {});
    if (!id) return;
    exercisesApi
      .get(id)
      .then((e) => setForm({ name: e.name, muscleGroup: e.muscleGroup, equipment: e.equipment || '', imageUrl: e.imageUrl || '' }))
      .catch(setLoadError)
      .finally(() => setLoading(false));
  }, [id]);

  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const save = async () => {
    const found = {};
    if (form.name.trim().length < 2) found.name = 'Ingresá un nombre';
    if (form.muscleGroup.trim().length < 2) found.muscleGroup = 'Elegí o escribí el grupo muscular';
    if (form.imageUrl && !/^https?:\/\//.test(form.imageUrl)) found.imageUrl = 'Debe empezar con http:// o https://';
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;
    const body = {
      name: form.name.trim(),
      muscleGroup: form.muscleGroup.trim(),
      equipment: form.equipment.trim() || null,
      imageUrl: form.imageUrl.trim() || null,
    };
    setSaving(true);
    try {
      if (id) await exercisesApi.update(id, body);
      else await exercisesApi.create(body);
      router.back();
    } catch (err) {
      setErrors(err.fieldErrors);
      setFormError(err.status === 409 ? 'Ya existe un ejercicio con ese nombre' : err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!(await confirm('Eliminar ejercicio', `¿Eliminar "${form.name}" del catálogo? Las sesiones ya cargadas lo conservan.`))) return;
    try {
      await exercisesApi.remove(id);
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
        <View style={styles.row}>
          {id ? <Button title="Eliminar" variant="danger" icon="trash-outline" onPress={remove} /> : null}
          <Button title={id ? 'Guardar cambios' : 'Crear ejercicio'} onPress={save} loading={saving} style={{ flex: 1 }} />
        </View>
      }
    >
      <Stack.Screen options={{ title: id ? 'Editar ejercicio' : 'Nuevo ejercicio' }} />
      <FormError message={formError} />
      <TextField label="Nombre" value={form.name} onChangeText={set('name')} error={errors.name} />
      <View style={{ gap: spacing.sm }}>
        <Text style={styles.label}>Grupo muscular</Text>
        <Chips options={groups.map((g) => ({ value: g, label: g }))} value={form.muscleGroup} onChange={set('muscleGroup')} />
        <TextField value={form.muscleGroup} onChangeText={set('muscleGroup')} error={errors.muscleGroup} placeholder="u otro…" />
      </View>
      <TextField label="Equipamiento (opcional)" value={form.equipment} onChangeText={set('equipment')} placeholder="Barra, máquina…" />
      <TextField
        label="URL de imagen (opcional)"
        value={form.imageUrl}
        onChangeText={set('imageUrl')}
        error={errors.imageUrl}
        autoCapitalize="none"
        keyboardType="url"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  label: { color: colors.muted, fontSize: font.sm, fontWeight: '600' },
});
