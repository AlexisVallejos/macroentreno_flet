import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { exercisesApi } from '../../api/endpoints';
import { Button, Chips, ErrorState, ListItem, Loading, TextField } from '../../components';
import { colors, font, MAX_CONTENT_WIDTH, spacing } from '../../theme';

/** Modal para elegir un ejercicio del catálogo (filtrando por grupo muscular) o escribir uno libre. */
export function ExercisePicker({ visible, onClose, onPick }) {
  const [exercises, setExercises] = useState(null);
  const [error, setError] = useState(null);
  const [group, setGroup] = useState('Todos');
  const [custom, setCustom] = useState('');

  const fetchExercises = () =>
    exercisesApi
      .list()
      .then((list) => {
        setExercises(list);
        setError(null);
      })
      .catch(setError);

  // Se carga la primera vez que se abre el modal.
  useEffect(() => {
    if (visible && !exercises) fetchExercises();
  }, [visible, exercises]);

  const groups = useMemo(() => ['Todos', ...new Set((exercises || []).map((e) => e.muscleGroup))], [exercises]);
  const filtered = (exercises || []).filter((e) => group === 'Todos' || e.muscleGroup === group);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={styles.root}>
        <View style={styles.inner}>
          <View style={styles.header}>
            <Text style={styles.title}>Elegí un ejercicio</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Cerrar">
              <Ionicons name="close" size={26} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.custom}>
            <TextField style={{ flex: 1 }} placeholder="O escribí uno nuevo…" value={custom} onChangeText={setCustom} />
            <Button
              icon="add"
              disabled={custom.trim().length < 2}
              onPress={() => {
                onPick({ exerciseId: null, name: custom.trim() });
                setCustom('');
              }}
            />
          </View>
          <Chips options={groups.map((g) => ({ value: g, label: g }))} value={group} onChange={setGroup} />
          {error ? (
            <ErrorState error={error} onRetry={fetchExercises} />
          ) : !exercises ? (
            <Loading />
          ) : (
            <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
              {filtered.map((e) => (
                <ListItem
                  key={e.id}
                  icon="barbell-outline"
                  title={e.name}
                  subtitle={e.muscleGroup}
                  onPress={() => onPick({ exerciseId: e.id, name: e.name })}
                />
              ))}
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  inner: { flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontSize: font.xl, fontWeight: '800' },
  custom: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
});
