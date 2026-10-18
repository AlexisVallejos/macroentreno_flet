import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { getRefreshToken, restoreSessionTokens, setOnSessionExpired, setSessionTokens } from '../api/client';
import { authApi, usersApi } from '../api/endpoints';
import { socialLogin as runSocialLogin } from '../api/socialLogin';
import { loadCachedUser, saveCachedUser } from '../storage/tokenStorage';

/**
 * Estado global de autenticación (Context API + useReducer).
 * status: 'loading' mientras se restaura la sesión guardada, luego 'signedIn' o 'signedOut'.
 */
const AuthContext = createContext(null);

const initialState = { status: 'loading', user: null };

function reducer(state, action) {
  switch (action.type) {
    case 'SIGN_IN':
      return { status: 'signedIn', user: action.user };
    case 'UPDATE_USER':
      return { ...state, user: action.user };
    case 'SIGN_OUT':
      return { status: 'signedOut', user: null };
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Si el refresh token deja de servir en medio del uso, se vuelve al login.
  useEffect(() => setOnSessionExpired(() => dispatch({ type: 'SIGN_OUT' })), []);

  // Restaurar sesión al abrir la app (autenticación persistente).
  useEffect(() => {
    (async () => {
      const tokens = await restoreSessionTokens();
      if (!tokens?.refreshToken) return dispatch({ type: 'SIGN_OUT' });
      try {
        const user = await authApi.me(); // si el access token venció, el cliente lo renueva solo
        await saveCachedUser(user);
        dispatch({ type: 'SIGN_IN', user });
      } catch (err) {
        // Sin conexión: se entra con el último usuario conocido.
        const cached = await loadCachedUser();
        if (cached && ['NETWORK_ERROR', 'TIMEOUT'].includes(err.code)) dispatch({ type: 'SIGN_IN', user: cached });
        else {
          await setSessionTokens(null);
          dispatch({ type: 'SIGN_OUT' });
        }
      }
    })();
  }, []);

  const startSession = useCallback(async ({ user, tokens }) => {
    await setSessionTokens(tokens);
    await saveCachedUser(user);
    dispatch({ type: 'SIGN_IN', user });
  }, []);

  const login = useCallback(async (email, password) => startSession(await authApi.login({ email, password })), [startSession]);

  const register = useCallback(
    async (name, email, password) => startSession(await authApi.register({ name, email, password })),
    [startSession],
  );

  const socialLogin = useCallback(async (provider) => startSession(await runSocialLogin(provider)), [startSession]);

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) authApi.logout(refreshToken).catch(() => {}); // aunque falle, se cierra localmente
    await setSessionTokens(null);
    dispatch({ type: 'SIGN_OUT' });
  }, []);

  const setUser = useCallback(async (user) => {
    await saveCachedUser(user);
    dispatch({ type: 'UPDATE_USER', user });
  }, []);

  const refreshUser = useCallback(async () => setUser(await authApi.me()), [setUser]);

  const updateProfile = useCallback(async (changes) => setUser(await usersApi.updateMe(changes)), [setUser]);

  const changePassword = useCallback(
    async (currentPassword, newPassword) => {
      const { tokens } = await authApi.changePassword({ currentPassword, newPassword });
      await setSessionTokens(tokens);
      await refreshUser();
    },
    [refreshUser],
  );

  const value = useMemo(
    () => ({ ...state, login, register, socialLogin, logout, refreshUser, updateProfile, changePassword }),
    [state, login, register, socialLogin, logout, refreshUser, updateProfile, changePassword],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
