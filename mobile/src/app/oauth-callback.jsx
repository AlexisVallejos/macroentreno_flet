import { Redirect } from 'expo-router';

/**
 * Destino del deep link macroentreno://oauth-callback. El código lo procesa
 * WebBrowser.openAuthSessionAsync; esta ruta solo evita la pantalla "ruta no encontrada".
 */
export default function OAuthCallback() {
  return <Redirect href="/" />;
}
