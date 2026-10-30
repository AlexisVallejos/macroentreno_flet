import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { foodsApi } from '../../api/endpoints';
import { Button, Card, Chips, EmptyState, ErrorState, ListItem, Loading, TextField } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { colors, useTheme } from '../../theme';

const SCOPES = [
  { value: 'all', label: 'Todos' },
  { value: 'global', label: 'Catálogo' },
  { value: 'mine', label: 'Mis alimentos' },
];

/**
 * Listado paginado de alimentos con búsqueda.
 * Atleta: ve el catálogo global (solo lectura) y gestiona sus propios alimentos.
 * Coach/admin: además editan el catálogo global.
 */
export function FoodList({ initialScope = 'all' }) {
  useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const isStaff = user.role !== 'athlete';
  const [scope, setScope] = useState(initialScope);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = async (page = 1) => {
    const query = { scope, search: search.trim() || undefined, page, limit: 20 };
    if (page === 1) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await foodsApi.list(query);
      setItems((prev) => (page === 1 ? res.data : [...prev, ...res.data]));
      setMeta(res.meta);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => load(1), 300);
    return () => clearTimeout(t);
  }, [scope, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const canEdit = (food) => (food.isGlobal ? isStaff : food.ownerId === user.id || user.role === 'admin');

  return (
    <>
      <Button
        title={isStaff ? 'Nuevo alimento' : 'Crear alimento personal'}
        icon="add"
        onPress={() => router.push('/food-form')}
      />
      <Chips options={SCOPES} value={scope} onChange={setScope} />
      <TextField placeholder="Buscar por nombre o marca…" value={search} onChangeText={setSearch} autoCorrect={false} />
      {error && !items.length ? (
        <ErrorState error={error} onRetry={() => load(1)} />
      ) : loading ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyState icon="nutrition-outline" title="No hay alimentos" message="Probá con otra búsqueda o creá uno." />
      ) : (
        <Card title={`${meta.total} alimentos`}>
          {items.map((f) => (
            <ListItem
              key={f.id}
              icon={f.isGlobal ? 'nutrition-outline' : 'person-outline'}
              iconColor={f.isGlobal ? colors.primary : colors.success}
              title={f.name}
              subtitle={`${f.kcal} kcal · P ${f.protein} C ${f.carbs} G ${f.fat} · ${f.portionDescription || `${f.portionGrams} g`}`}
              onPress={canEdit(f) ? () => router.push({ pathname: '/food-form', params: { id: String(f.id) } }) : undefined}
              right={canEdit(f) ? undefined : <Text style={{ color: colors.muted, fontSize: 11 }}>{f.category}</Text>}
            />
          ))}
          {meta.page < meta.totalPages ? (
            <Button title="Cargar más" variant="ghost" loading={loadingMore} onPress={() => load(meta.page + 1)} />
          ) : null}
        </Card>
      )}
    </>
  );
}
