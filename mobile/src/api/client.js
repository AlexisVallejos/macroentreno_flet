import { clearSession, loadSession, saveSession } from '../storage/tokenStorage';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api').replace(/\/$/, '');
const TIMEOUT_MS = 15000;

/** Error normalizado: siempre tiene un `message` listo para mostrar al usuario. */
export class ApiError extends Error {
  constructor(message, { status = 0, code = 'NETWORK_ERROR', details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Convierte details [{field, message}] en { field: message } para los formularios. */
  get fieldErrors() {
    const out = {};
    for (const d of this.details || []) if (d.field && !out[d.field]) out[d.field] = d.message;
    return out;
  }
}

// --- Tokens en memoria (la copia persistente vive en SecureStore) ---
let session = null; // { accessToken, refreshToken }
let onSessionExpired = () => {};
let refreshing = null;

export function setSessionTokens(tokens) {
  session = tokens ? { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken } : null;
  return session ? saveSession(session) : clearSession();
}
export async function restoreSessionTokens() {
  session = await loadSession();
  return session;
}
export const getRefreshToken = () => session?.refreshToken;
export const setOnSessionExpired = (fn) => {
  onSessionExpired = fn;
};

async function rawRequest(path, { method = 'GET', body, query, token } = {}) {
  const qs = query
    ? `?${new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== ''))}`
    : '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${API_URL}${path}${qs}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    const timeout = err?.name === 'AbortError';
    throw new ApiError(
      timeout
        ? 'El servidor tardó demasiado en responder. Probá de nuevo.'
        : 'No se pudo conectar con el servidor. Revisá tu conexión o la URL de la API.',
      { code: timeout ? 'TIMEOUT' : 'NETWORK_ERROR' },
    );
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return null;
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const e = json?.error || {};
    throw new ApiError(e.message || `Error ${res.status} del servidor`, {
      status: res.status,
      code: e.code || 'HTTP_ERROR',
      details: e.details,
    });
  }
  return json;
}

/** Pide un nuevo par de tokens. Varias peticiones simultáneas comparten el mismo refresh. */
function refreshTokens() {
  if (!refreshing) {
    refreshing = rawRequest('/auth/refresh', { method: 'POST', body: { refreshToken: session?.refreshToken } })
      .then(async (json) => {
        await setSessionTokens(json.data.tokens);
        return json.data;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

/**
 * Petición autenticada. Si el access token venció, renueva y reintenta una vez.
 * Si la renovación falla, se cierra la sesión.
 */
export async function api(path, options = {}) {
  try {
    return await rawRequest(path, { ...options, token: session?.accessToken });
  } catch (err) {
    const canRefresh = err.status === 401 && session?.refreshToken && !options.skipRefresh;
    if (!canRefresh) throw err;
    try {
      await refreshTokens();
    } catch (refreshErr) {
      if (refreshErr.status === 401) {
        await setSessionTokens(null);
        onSessionExpired();
        throw new ApiError('Tu sesión expiró. Iniciá sesión nuevamente.', { status: 401, code: 'SESSION_EXPIRED' });
      }
      throw refreshErr;
    }
    return rawRequest(path, { ...options, token: session?.accessToken });
  }
}

/** Petición sin token (login, registro). */
export const publicApi = (path, options) => rawRequest(path, options);
