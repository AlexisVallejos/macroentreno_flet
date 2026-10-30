import { useRouter } from 'expo-router';
import { exercisesApi } from '../../api/endpoints';
import { Button, Card, ErrorState, ListItem, Loading } from '../../components';
import { useResource } from '../../hooks/useResource';

/** Catálogo de ejercicios agrupado por grupo muscular (coach/admin lo editan). */
export function ExerciseList() {
  const router = useRouter();
  const { data, error, loading, reload } = useResource(() => exercisesApi.list(), []);

  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Loading />;

  const groups = data.reduce((acc, e) => {
    (acc[e.muscleGroup] ||= []).push(e);
    return acc;
  }, {});

  return (
    <>
      <Button title="Nuevo ejercicio" icon="add" onPress={() => router.push('/exercise-form')} />
      {Object.entries(groups).map(([group, list]) => (
        <Card key={group} title={`${group} (${list.length})`}>
          {list.map((e) => (
            <ListItem
              key={e.id}
              icon="barbell-outline"
              title={e.name}
              subtitle={e.equipment || undefined}
              onPress={() => router.push({ pathname: '/exercise-form', params: { id: String(e.id) } })}
            />
          ))}
        </Card>
      ))}
    </>
  );
}
