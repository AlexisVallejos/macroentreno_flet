import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Persistencia de la sesión. En el celular usa el almacenamiento cifrado del sistema
 * (Keychain / Keystore); en web, localStorage (solo para pruebas).
 */
const TOKENS_KEY = 'macroentreno.tokens';
const USER_KEY = 'macroentreno.user';

const webStore = {
  getItemAsync: async (k) => globalThis.localStorage?.getItem(k) ?? null,
  setItemAsync: async (k, v) => globalThis.localStorage?.setItem(k, v),
  deleteItemAsync: async (k) => globalThis.localStorage?.removeItem(k),
};
const store = Platform.OS === 'web' ? webStore : SecureStore;

async function read(key) {
  try {
    const raw = await store.getItemAsync(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const loadSession = () => read(TOKENS_KEY);
export const saveSession = (tokens) => store.setItemAsync(TOKENS_KEY, JSON.stringify(tokens));

/** Copia del usuario para poder abrir la app sin conexión. */
export const loadCachedUser = () => read(USER_KEY);
export const saveCachedUser = (user) => store.setItemAsync(USER_KEY, JSON.stringify(user));

export async function clearSession() {
  await Promise.all([store.deleteItemAsync(TOKENS_KEY), store.deleteItemAsync(USER_KEY)]);
}
