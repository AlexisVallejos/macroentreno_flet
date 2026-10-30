import { useRouter } from 'expo-router';
import { Button, Screen } from '../../components';
import { WeeklyReview } from '../reports/WeeklyReview';
import { ProgressView } from './ProgressView';

export default function ProgressScreen() {
  const router = useRouter();
  return <Screen>
    <Button title="Mis informes PDF semanales" icon="document-text-outline" variant="tinted" onPress={() => router.push('/weekly-reports')} />
    <WeeklyReview />
    <ProgressView />
  </Screen>;
}
