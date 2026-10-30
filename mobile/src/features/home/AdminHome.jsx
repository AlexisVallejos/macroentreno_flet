import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { adminApi } from '../../api/endpoints';
import { Button, Card, ErrorState, ListItem, Loading, RoleBadge, Screen, StatTile } from '../../components';
import { useResource } from '../../hooks/useResource';
import { colors, createStyles, spacing, useTheme } from '../../theme';
import { AssistantBanner } from '../assistant/AssistantBanner';

/** Panel del administrador con números generales del sistema. */
export default function AdminHome() {
  useTheme();
  const router = useRouter();
  const { data, error, loading, refreshing, reload } = useResource(() => adminApi.stats(), []);

  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Loading />;

  return (
    <Screen onRefresh={reload} refreshing={refreshing}>
      <AssistantBanner subtitle="Pedile que cargue ejercicios o alimentos por vos" />
      <Card title="Gestión de entrenadores">
        <Button title="Reportes mensuales" icon="document-text-outline" onPress={() => router.push('/coach-reports')} />
        <Button title="Crear entrenador" icon="person-add-outline" variant="tinted" onPress={() => router.push({ pathname: '/user-form', params: { role: 'coach' } })} />
        <Button title="Asignar atletas a entrenadores" variant="tinted" onPress={() => router.push('/users')} />
      </Card>
      <View style={styles.tiles}>
        <StatTile icon="people-outline" label="usuarios" value={data.totalUsers} />
        <StatTile icon="barbell-outline" label="atletas" value={data.usersByRole.athlete} color={colors.success} />
        <StatTile icon="stopwatch-outline" label="entrenadores" value={data.usersByRole.coach} color={colors.warning} />
        <StatTile icon="alert-circle-outline" label="atletas sin coach" value={data.athletesWithoutCoach} color={colors.danger} />
        <StatTile icon="restaurant-outline" label="comidas (7 días)" value={data.last7Days.diaryEntries} color={colors.secondary} />
        <StatTile icon="fitness-outline" label="sesiones (7 días)" value={data.last7Days.workouts} color={colors.protein} />
        <StatTile icon="nutrition-outline" label="alimentos globales" value={data.foods.global} />
        <StatTile icon="person-outline" label="alimentos personales" value={data.foods.custom} />
      </View>
      <Card title="Últimos usuarios registrados">
        {data.recentUsers.map((u) => (
          <ListItem
            key={u.id}
            title={u.name}
            subtitle={u.email ?? 'sin email (red social)'}
            right={<RoleBadge role={u.role} />}
            onPress={() => router.push({ pathname: '/user-form', params: { id: String(u.id) } })}
          />
        ))}
      </Card>
    </Screen>
  );
}

const styles = createStyles(() => StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
}));
