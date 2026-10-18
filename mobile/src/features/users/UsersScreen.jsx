import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { usersApi } from '../../api/endpoints';
import { Button, Card, Chips, EmptyState, ErrorState, ListItem, Loading, RoleBadge, Screen, TextField } from '../../components';
import { useResource } from '../../hooks/useResource';
import { colors } from '../../theme';

const ROLE_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'athlete', label: 'Atletas' },
  { value: 'coach', label: 'Entrenadores' },
  { value: 'admin', label: 'Admins' },
];

/** ABM de usuarios (solo administrador). */
export default function UsersScreen() {
  const router = useRouter();
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, loading, refreshing, reload } = useResource(
    () => usersApi.list({ role: role || undefined, search: search.trim() || undefined, page, limit: 20 }),
    [role, search, page],
  );

  const changeFilter = (setter) => (value) => {
    setPage(1);
    setter(value);
  };

  return (
    <Screen onRefresh={reload} refreshing={refreshing}>
      <Button title="Nuevo usuario" icon="person-add-outline" onPress={() => router.push('/user-form')} />
      <Chips options={ROLE_FILTERS} value={role} onChange={changeFilter(setRole)} />
      <TextField placeholder="Buscar por nombre o email…" value={search} onChangeText={changeFilter(setSearch)} autoCorrect={false} />
      {error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !data ? (
        <Loading />
      ) : data.data.length === 0 ? (
        <EmptyState icon="people-outline" title="Sin resultados" />
      ) : (
        <Card title={`${data.meta.total} usuarios`}>
          {data.data.map((u) => (
            <ListItem
              key={u.id}
              title={u.isActive ? u.name : `${u.name} (inactivo)`}
              subtitle={[u.email ?? 'sin email', u.coachName ? `coach: ${u.coachName}` : null].filter(Boolean).join(' · ')}
              right={<RoleBadge role={u.role} />}
              onPress={() => router.push({ pathname: '/user-form', params: { id: String(u.id) } })}
            />
          ))}
          {data.meta.totalPages > 1 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Button title="Anterior" variant="ghost" small disabled={page <= 1} onPress={() => setPage(page - 1)} />
              <Text style={{ color: colors.muted }}>
                {page} / {data.meta.totalPages}
              </Text>
              <Button title="Siguiente" variant="ghost" small disabled={page >= data.meta.totalPages} onPress={() => setPage(page + 1)} />
            </View>
          ) : null}
        </Card>
      )}
    </Screen>
  );
}
