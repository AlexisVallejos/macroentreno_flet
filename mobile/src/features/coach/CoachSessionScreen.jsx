import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, EmptyState, Screen } from '../../components';
import { CoachSession } from './CoachSession';
import { coachExercise } from './exercises';
import { RULES } from './pose/rules';

const positive = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/**
 * /coach/[rule]. Desde el catálogo llega solo la regla; desde el formulario de una sesión llegan además el nombre
 * del ejercicio, las series y las repeticiones cargadas (para arrancar con eso) y el pedido para devolverle el resultado.
 */
export default function CoachSessionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const rule = RULES[params.rule];
  if (!rule) {
    return (
      <Screen>
        <EmptyState icon="help-circle-outline" title="Ejercicio desconocido" message="La cámara no sabe analizar este ejercicio." action={<Button title="Ver ejercicios" onPress={() => router.replace('/coach')} />} />
      </Screen>
    );
  }
  const catalog = coachExercise(rule.id);
  const exercise = { ...catalog, name: params.name ? String(params.name) : catalog.name };
  const preset = {};
  if (positive(params.sets)) preset.sets = positive(params.sets);
  if (positive(params.target)) preset.target = positive(params.target);
  return <CoachSession key={`${rule.id}-${params.request ?? ''}`} exercise={exercise} rule={rule} preset={preset} request={params.request ? String(params.request) : null} />;
}
