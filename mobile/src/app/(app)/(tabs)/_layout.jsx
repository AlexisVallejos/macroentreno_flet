import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import { useAuth } from '../../../context/AuthContext';
import { colors } from '../../../theme';

const icon = (name) =>
  function TabBarIcon({ color, size }) {
    return <Ionicons name={name} size={size} color={color} />;
  };

/**
 * Pestañas según el rol:
 *  - Atleta:        Inicio · Diario · Entrenos · Progreso · Perfil
 *  - Entrenador:    Atletas · Catálogo · Perfil
 *  - Administrador: Panel · Usuarios · Catálogo · Perfil
 */
export default function TabsLayout() {
  const { user } = useAuth();
  const role = user?.role;
  const homeTitle = role === 'admin' ? 'Panel' : role === 'coach' ? 'Mis atletas' : 'Inicio';
  const homeIcon = role === 'admin' ? 'speedometer-outline' : role === 'coach' ? 'people-outline' : 'home-outline';

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: homeTitle, tabBarIcon: icon(homeIcon) }} />

      <Tabs.Protected guard={role === 'athlete'}>
        <Tabs.Screen name="diary" options={{ title: 'Diario', tabBarIcon: icon('restaurant-outline') }} />
        <Tabs.Screen name="workouts" options={{ title: 'Entrenos', tabBarIcon: icon('barbell-outline') }} />
        <Tabs.Screen name="progress" options={{ title: 'Progreso', tabBarIcon: icon('stats-chart-outline') }} />
      </Tabs.Protected>

      <Tabs.Protected guard={role === 'admin'}>
        <Tabs.Screen name="users" options={{ title: 'Usuarios', tabBarIcon: icon('person-add-outline') }} />
      </Tabs.Protected>

      <Tabs.Protected guard={role === 'coach' || role === 'admin'}>
        <Tabs.Screen name="catalog" options={{ title: 'Catálogo', tabBarIcon: icon('library-outline') }} />
      </Tabs.Protected>

      <Tabs.Screen name="profile" options={{ title: 'Perfil', tabBarIcon: icon('person-circle-outline') }} />
    </Tabs>
  );
}
