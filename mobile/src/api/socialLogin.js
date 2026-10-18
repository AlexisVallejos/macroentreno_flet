import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { API_URL, ApiError, publicApi } from './client';
import { authApi } from './endpoints';

// Cierra el popup del navegador cuando la app corre en web.
WebBrowser.maybeCompleteAuthSession();

const toHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/** Qué proveedores tiene configurados el backend: [{ id, label, configured }]. */
export const fetchProviders = () => publicApi('/auth/oauth/providers').then((json) => json.data);

/**
 * Login social completo:
 * 1. Genera un code_verifier (PKCE) y su SHA-256.
 * 2. Abre el navegador en el backend, que redirige a Google/Facebook/GitHub.
 * 3. El backend vuelve a la app (macroentreno://oauth-callback?code=...).
 * 4. Se canjea el código + verifier por los JWT de la API.
 */
export async function socialLogin(provider) {
  const verifier = toHex(Crypto.getRandomBytes(32));
  const challenge = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
  // En el APK: macroentreno://oauth-callback · En Expo Go: exp://<ip>:8081/--/oauth-callback
  const redirectUri = Linking.createURL('oauth-callback');
  const startUrl = `${API_URL}/auth/oauth/${provider}/start?${new URLSearchParams({
    redirect_uri: redirectUri,
    code_challenge: challenge,
  })}`;

  const result = await WebBrowser.openAuthSessionAsync(startUrl, redirectUri);
  if (result.type !== 'success') {
    throw new ApiError('Se canceló el inicio de sesión', { code: 'CANCELLED' });
  }
  const { queryParams = {} } = Linking.parse(result.url);
  if (queryParams.error) {
    throw new ApiError(
      queryParams.error === 'cancelled' ? 'Se canceló el inicio de sesión' : queryParams.message || 'No se pudo iniciar sesión',
      { code: String(queryParams.error) },
    );
  }
  return authApi.oauthExchange({ code: String(queryParams.code), codeVerifier: verifier });
}
