import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Loading } from '../components';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { colors, ThemeProvider, useTheme } from '../theme';

/**
 * Navegación raíz:
 *  - sin sesión  → login / register
 *  - con sesión  → grupo (app) con las pestañas según el rol
 * Stack.Protected redirige solo cuando cambia el estado de la sesión.
 */
function RootNavigator() {
  useTheme();
  const { status } = useAuth();
  if (status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Loading label="Restaurando sesión…" />
      </View>
    );
  }
  const signedIn = status === 'signedIn';
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={signedIn} redirectTo="/login">
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack.Protected>
      <Stack.Screen name="oauth-callback" />
    </Stack>
  );
}

/** La barra de estado se invierte con el tema: íconos claros sobre fondo oscuro y viceversa. */
function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ThemedStatusBar />
          <RootNavigator />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
