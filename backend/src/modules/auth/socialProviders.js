import { env } from '../../config/env.js';
import { HttpError, unauthorized } from '../../utils/httpError.js';

/**
 * Proveedores OAuth 2.0 (flujo "authorization code" del lado del servidor).
 * Cada uno sabe:
 *  - authorizeUrl(state, redirectUri): a dónde mandar al usuario para que inicie sesión
 *  - fetchProfile(code, redirectUri):  canjea el código y devuelve un perfil normalizado
 *    { providerUserId, email, name, avatarUrl }
 * Los secretos de cliente solo existen en el servidor.
 */

const FACEBOOK_GRAPH = 'https://graph.facebook.com/v21.0';

const providerError = (provider) =>
  unauthorized(`${provider} rechazó el inicio de sesión`, 'SOCIAL_LOGIN_FAILED');

async function fetchJson(url, options = {}) {
  let res;
  try {
    res = await fetch(url, { ...options, signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new HttpError(502, 'PROVIDER_UNAVAILABLE', 'No se pudo contactar al proveedor de identidad');
  }
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, body };
}

const google = {
  label: 'Google',
  isConfigured: () => Boolean(env.social.googleClientId && env.social.googleClientSecret),
  authorizeUrl(state, redirectUri) {
    const params = new URLSearchParams({
      client_id: env.social.googleClientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      prompt: 'select_account',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  },
  async fetchProfile(code, redirectUri) {
    const token = await fetchJson('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.social.googleClientId,
        client_secret: env.social.googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!token.body.access_token) throw providerError('Google');
    const profile = await fetchJson('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${token.body.access_token}` },
    });
    if (!profile.ok) throw providerError('Google');
    return {
      providerUserId: profile.body.sub,
      email: profile.body.email_verified ? profile.body.email : null,
      name: profile.body.name || profile.body.email || 'Usuario de Google',
      avatarUrl: profile.body.picture || null,
    };
  },
};

const facebook = {
  label: 'Facebook',
  isConfigured: () => Boolean(env.social.facebookAppId && env.social.facebookAppSecret),
  authorizeUrl(state, redirectUri) {
    const params = new URLSearchParams({
      client_id: env.social.facebookAppId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'public_profile,email',
      state,
    });
    return `https://www.facebook.com/v21.0/dialog/oauth?${params}`;
  },
  async fetchProfile(code, redirectUri) {
    const params = new URLSearchParams({
      client_id: env.social.facebookAppId,
      client_secret: env.social.facebookAppSecret,
      redirect_uri: redirectUri,
      code,
    });
    const token = await fetchJson(`${FACEBOOK_GRAPH}/oauth/access_token?${params}`);
    if (!token.body.access_token) throw providerError('Facebook');
    const profile = await fetchJson(
      `${FACEBOOK_GRAPH}/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(token.body.access_token)}`,
    );
    if (!profile.ok) throw providerError('Facebook');
    return {
      providerUserId: profile.body.id,
      email: profile.body.email || null,
      name: profile.body.name || 'Usuario de Facebook',
      avatarUrl: profile.body.picture?.data?.url || null,
    };
  },
};

const github = {
  label: 'GitHub',
  isConfigured: () => Boolean(env.social.githubClientId && env.social.githubClientSecret),
  authorizeUrl(state, redirectUri) {
    const params = new URLSearchParams({
      client_id: env.social.githubClientId,
      redirect_uri: redirectUri,
      scope: 'read:user user:email',
      state,
    });
    return `https://github.com/login/oauth/authorize?${params}`;
  },
  async fetchProfile(code, redirectUri) {
    const token = await fetchJson('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: env.social.githubClientId,
        client_secret: env.social.githubClientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!token.body.access_token) throw providerError('GitHub');
    const headers = {
      Authorization: `Bearer ${token.body.access_token}`,
      'User-Agent': 'MacroEntreno',
      Accept: 'application/vnd.github+json',
    };
    const profile = await fetchJson('https://api.github.com/user', { headers });
    if (!profile.ok) throw providerError('GitHub');

    let email = null;
    const emails = await fetchJson('https://api.github.com/user/emails', { headers });
    if (emails.ok && Array.isArray(emails.body)) {
      email = emails.body.find((item) => item.primary && item.verified)?.email || null;
    }
    return {
      providerUserId: String(profile.body.id),
      email,
      name: profile.body.name || profile.body.login || 'Usuario de GitHub',
      avatarUrl: profile.body.avatar_url || null,
    };
  },
};

export const socialProviders = { google, facebook, github };
