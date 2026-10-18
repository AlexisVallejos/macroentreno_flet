import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { diaryApi, progressApi } from '../../api/endpoints';
import { Button, Card, ErrorState, Grid, KcalBarChart, Loading, MacroSummary, Screen } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { useResource } from '../../hooks/useResource';
import { colors, font, spacing } from '../../theme';
import { today } from '../../utils/dates';

export default function AthleteHome() {
  const router = useRouter();
  const { user } = useAuth();
  const date = today();
  const { data, error, loading, refreshing, reload } = useResource(
    () => Promise.all([diaryApi.day(date), progressApi.get({ days: 7, to: date })]),
    [date],
  );
  const [day, progress] = data || [];

  return (
    <Screen onRefresh={reload} refreshing={refreshing}>
      <View>
        <Text style={styles.hello}>¡Hola, {user.name.split(' ')[0]}! 💪</Text>
        <Text style={styles.sub}>
          {user.coachName ? `Tu entrenador: ${user.coachName}` : 'Todavía no tenés entrenador asignado'}
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          title="Registrar comida"
          icon="add-circle-outline"
          style={{ flex: 1 }}
          onPress={() => router.push({ pathname: '/diary-entry', params: { date } })}
        />
        <Button
          title="Nueva sesión"
          icon="barbell-outline"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => router.push({ pathname: '/workout-form', params: { date } })}
        />
      </View>

      {error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !data ? (
        <Loading />
      ) : (
        <Grid>
          <Card title="Hoy">
            <MacroSummary totals={day.totals} goals={day.goals} />
          </Card>
          <Card title="Últimos 7 días">
            <KcalBarChart daily={progress.daily} goal={progress.goals.kcal} height={130} />
            <Text style={styles.sub}>
              {progress.summary.daysOnTarget} de {progress.summary.loggedDays} días en objetivo ·{' '}
              {progress.summary.totalWorkouts} sesiones
            </Text>
          </Card>
        </Grid>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hello: { color: colors.text, fontSize: font.xxl, fontWeight: '800' },
  sub: { color: colors.muted, fontSize: font.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
