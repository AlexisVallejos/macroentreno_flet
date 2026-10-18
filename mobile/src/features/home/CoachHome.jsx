import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { usersApi } from '../../api/endpoints';
import { Card, EmptyState, ErrorState, ListItem, Loading, Screen, TextField } from '../../components';
import { useResource } from '../../hooks/useResource';
import { colors, font } from '../../theme';

/** Inicio del entrenador: sus atletas asignados. */
export default function CoachHome() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const { data, error, loading, refreshing, reload } = useResource(
    () => usersApi.list({ search: search.trim() || undefined, limit: 100 }),
    [search],
  );

  return (
    <Screen onRefresh={reload} refreshing={refreshing}>
      <Text style={styles.sub}>Tocá un atleta para ver su diario, sus entrenamientos y su progreso, o asignarle una rutina.</Text>
      <TextField placeholder="Buscar atleta…" value={search} onChangeText={setSearch} autoCorrect={false} />
      {error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !data ? (
        <Loading />
      ) : data.data.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="Sin atletas asignados"
          message="Un administrador puede asignarte atletas desde la sección Usuarios."
        />
      ) : (
        <Card title={`${data.meta.total} atleta${data.meta.total === 1 ? '' : 's'}`}>
          {data.data.map((a) => (
            <ListItem
              key={a.id}
              icon="person-outline"
              iconColor={colors.success}
              title={a.name}
              subtitle={`${a.email ?? 'sin email'} · meta ${a.goals.kcal} kcal`}
              onPress={() => router.push(`/athlete/${a.id}`)}
            />
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { color: colors.muted, fontSize: font.sm },
});
