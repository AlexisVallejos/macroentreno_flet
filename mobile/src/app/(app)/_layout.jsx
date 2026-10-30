import { Stack } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { colors, useTheme } from '../../theme';

/**
 * Pantallas de la sesión iniciada. Cada grupo de rutas se protege por rol:
 * aunque alguien intente navegar a una ruta ajena (deep link), se redirige al inicio.
 * El backend vuelve a verificar los permisos en cada endpoint.
 */
export const unstable_settings = { anchor: '(tabs)' };

export default function AppLayout() {
  useTheme();
  const { user } = useAuth();
  const role = user?.role;
  const isAthlete = role === 'athlete';
  const isStaff = role === 'coach' || role === 'admin';

  return (
    <Stack
      screenOptions={{
        // Barra de navegación de iOS: fondo del sistema, sin sombra, botón atrás en verde
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTintColor: colors.primary,
        headerTitleStyle: { fontWeight: '600', color: colors.text },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="change-password" options={{ title: 'Contraseña', presentation: 'modal' }} />
      <Stack.Screen name="foods" options={{ title: 'Alimentos' }} />
      <Stack.Screen name="food-form" options={{ title: 'Alimento' }} />
      <Stack.Screen name="nutrition-plans" options={{ title: 'Plan de alimentación' }} />
      <Stack.Screen name="weekly-reports" options={{ title: 'Informes semanales' }} />
      <Stack.Screen name="pro" options={{ title: 'MacroEntreno Pro' }} />
      <Stack.Screen name="assistant" options={{ title: 'Asistente' }} />

      {/* Atleta: carga su diario y entrena con la cámara */}
      <Stack.Protected guard={isAthlete}>
        <Stack.Screen name="diary-entry" options={{ title: 'Registrar comida' }} />
        <Stack.Screen name="coach/index" options={{ title: 'Entrenar con cámara' }} />
        <Stack.Screen name="coach/[rule]" options={{ title: 'Entrenar' }} />
      </Stack.Protected>

      {/* Atleta (sus sesiones) y coach/admin (rutinas para atletas) */}
      <Stack.Protected guard={isAthlete || isStaff}>
        <Stack.Screen name="workout-form" options={{ title: 'Sesión de entrenamiento' }} />
      </Stack.Protected>

      {/* Coach y admin */}
      <Stack.Protected guard={isStaff}>
        <Stack.Screen name="nutrition-plan-form" options={{ title: 'Plan de alimentación' }} />
        <Stack.Screen name="athlete/[id]" options={{ title: 'Atleta' }} />
        <Stack.Screen name="exercise-form" options={{ title: 'Ejercicio' }} />
      </Stack.Protected>

      {/* Solo admin */}
      <Stack.Protected guard={role === 'admin'}>
        <Stack.Screen name="coach-reports" options={{ title: 'Reportes de entrenadores' }} />
        <Stack.Screen name="user-form" options={{ title: 'Usuario' }} />
      </Stack.Protected>
    </Stack>
  );
}
