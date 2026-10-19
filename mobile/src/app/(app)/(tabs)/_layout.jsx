import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import { Platform, StyleSheet } from 'react-native';
import { useAuth } from '../../../context/AuthContext';
import { useResponsive } from '../../../hooks/useResponsive';
import { colors, font, MAX_CONTENT_WIDTH, spacing, tracking } from '../../../theme';

const SIDEBAR_WIDTH = 260;

/** Como en iOS: ícono de contorno en reposo y relleno en la pestaña activa. */
const icon = (name) =>
  function TabBarIcon({ color, size, focused }) {
    return <Ionicons name={focused ? name : `${name}-outline`} size={size} color={color} />;
  };

/**
 * Pestañas según el rol:
 *  - Atleta:        Inicio · Diario · Entrenos · Progreso · Perfil
 *  - Entrenador:    Atletas · Catálogo · Perfil
 *  - Administrador: Panel · Usuarios · Catálogo · Perfil
 * En pantallas anchas (tablet, web de escritorio) pasan a una barra lateral, como en iPadOS.
 */
export default function TabsLayout() {
  const { user } = useAuth();
  const { width } = useResponsive();
  const sidebar = width >= 900;
  // El título grande se alinea con el contenido, que está centrado con ancho máximo
  const contentWidth = width - (sidebar ? SIDEBAR_WIDTH : 0);
  const titleInset = Math.max(0, (contentWidth - MAX_CONTENT_WIDTH) / 2);
  const role = user?.role;
  const homeTitle = role === 'admin' ? 'Panel' : role === 'coach' ? 'Mis atletas' : 'Inicio';
  const homeIcon = role === 'admin' ? 'speedometer' : role === 'coach' ? 'people' : 'home';

  return (
    <Tabs
      screenOptions={{
        // Título grande alineado a la izquierda, como los "large titles" de iOS
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitleAlign: 'left',
        headerTintColor: colors.text,
        headerTitleStyle: { fontSize: font.display - 2, fontWeight: '700', letterSpacing: tracking.display },
        headerTitleContainerStyle: { marginLeft: spacing.lg + titleInset },
        tabBarPosition: sidebar ? 'left' : 'bottom',
        tabBarLabelPosition: sidebar ? 'beside-icon' : 'below-icon',
        tabBarStyle: sidebar ? styles.sidebar : styles.tabBar,
        tabBarItemStyle: sidebar ? styles.sidebarItem : undefined,
        tabBarLabelStyle: sidebar ? styles.sidebarLabel : styles.tabLabel,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarActiveBackgroundColor: sidebar ? colors.primarySoft : undefined,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: homeTitle, tabBarIcon: icon(homeIcon) }} />

      <Tabs.Protected guard={role === 'athlete'}>
        <Tabs.Screen name="diary" options={{ title: 'Diario', tabBarIcon: icon('restaurant') }} />
        <Tabs.Screen name="workouts" options={{ title: 'Entrenos', tabBarIcon: icon('barbell') }} />
        <Tabs.Screen name="progress" options={{ title: 'Progreso', tabBarIcon: icon('stats-chart') }} />
      </Tabs.Protected>

      <Tabs.Protected guard={role === 'admin'}>
        <Tabs.Screen name="users" options={{ title: 'Usuarios', tabBarIcon: icon('person-add') }} />
      </Tabs.Protected>

      <Tabs.Protected guard={role === 'coach' || role === 'admin'}>
        <Tabs.Screen name="catalog" options={{ title: 'Catálogo', tabBarIcon: icon('library') }} />
      </Tabs.Protected>

      <Tabs.Screen name="profile" options={{ title: 'Perfil', tabBarIcon: icon('person-circle') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: 'rgba(18,18,18,0.94)',
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    // En web no hay margen seguro inferior: sin esto las etiquetas quedan pegadas al borde
    ...(Platform.OS === 'web' ? { height: 60, paddingTop: 4, paddingBottom: 8 } : null),
  },
  tabLabel: { fontSize: 10, fontWeight: '500' },
  sidebar: {
    // pisa el ancho mínimo de 360 que trae por defecto (pensado para Material)
    width: SIDEBAR_WIDTH,
    minWidth: SIDEBAR_WIDTH,
    backgroundColor: colors.background,
    borderRightColor: colors.border,
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingTop: 24,
    paddingHorizontal: 12,
  },
  sidebarItem: { borderRadius: 12, marginVertical: 2, paddingHorizontal: 12, justifyContent: 'flex-start' },
  sidebarLabel: { fontSize: font.md, fontWeight: '600', marginLeft: 12 },
});
