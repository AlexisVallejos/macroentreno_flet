import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';
import { authenticate } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { badRequest } from '../../utils/httpError.js';
import { toPublicUser } from '../users/users.mapper.js';
import * as schemas from './auth.schemas.js';
import * as service from './auth.service.js';
import * as oauth from './oauth.js';
import { socialProviders } from './socialProviders.js';
import { issueTokens } from './tokens.js';

const router = Router();

// Frena ataques de fuerza bruta sobre login/registro.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.nodeEnv === 'test' ? 10_000 : 50,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Demasiados intentos, probá de nuevo en unos minutos' } },
});

router.post('/register', authLimiter, validate({ body: schemas.registerSchema }), async (req, res) => {
  res.status(201).json({ data: await service.register(req.valid.body) });
});

router.post('/login', authLimiter, validate({ body: schemas.loginSchema }), async (req, res) => {
  res.json({ data: await service.login(req.valid.body) });
});

// --- Login social (Google, Facebook, GitHub) ---
router.get('/oauth/providers', (_req, res) => {
  res.json({
    data: Object.entries(socialProviders).map(([id, p]) => ({ id, label: p.label, configured: p.isConfigured() })),
  });
});

router.get(
  '/oauth/:provider/start',
  authLimiter,
  validate({ params: schemas.oauthParams, query: schemas.oauthStartQuery }),
  (req, res) => {
    const { provider: name } = req.valid.params;
    const { redirect_uri: appRedirectUri, code_challenge: challenge } = req.valid.query;
    const provider = oauth.getProvider(name);
    oauth.assertAppRedirect(appRedirectUri);
    const state = oauth.signState({ provider: name, appRedirectUri, challenge });
    res.redirect(provider.authorizeUrl(state, oauth.callbackUrl(req, name)));
  },
);

router.get('/oauth/:provider/callback', validate({ params: schemas.oauthParams }), async (req, res) => {
  const { provider: name } = req.valid.params;
  const state = oauth.verifyState(String(req.query.state || ''));
  if (state.provider !== name) throw badRequest('El proveedor no coincide con el inicio de sesión');
  try {
    if (req.query.error || !req.query.code) {
      return res.redirect(oauth.appRedirect(state.appRedirectUri, { error: 'cancelled' }));
    }
    const provider = oauth.getProvider(name);
    const profile = await provider.fetchProfile(String(req.query.code), oauth.callbackUrl(req, name));
    const userId = await service.linkSocialAccount(name, profile);
    const code = oauth.createLoginCode(userId, state.challenge);
    return res.redirect(oauth.appRedirect(state.appRedirectUri, { code }));
  } catch (err) {
    // El usuario está en el navegador: se vuelve a la app con el mensaje de error.
    return res.redirect(
      oauth.appRedirect(state.appRedirectUri, { error: err.code || 'SOCIAL_LOGIN_FAILED', message: err.message }),
    );
  }
});

router.post('/oauth/exchange', authLimiter, validate({ body: schemas.oauthExchangeSchema }), async (req, res) => {
  const userId = oauth.consumeLoginCode(req.valid.body.code, req.valid.body.codeVerifier);
  res.json({ data: await service.sessionForUser(userId) });
});

router.post('/refresh', validate({ body: schemas.refreshSchema }), async (req, res) => {
  res.json({ data: await service.refresh(req.valid.body.refreshToken) });
});

router.post('/logout', async (req, res) => {
  await service.logout(req.body?.refreshToken);
  res.status(204).end();
});

router.post('/logout-all', authenticate, async (req, res) => {
  await service.logout(null, { allDevices: true, userId: req.user.id });
  res.status(204).end();
});

router.get('/me', authenticate, async (req, res) => {
  res.json({ data: toPublicUser(await service.findUserById(req.user.id)) });
});

router.put('/password', authenticate, validate({ body: schemas.changePasswordSchema }), async (req, res) => {
  await service.changePassword(req.user.id, req.valid.body);
  // Se revocaron todas las sesiones: se entrega un par nuevo para este dispositivo.
  res.json({ data: { tokens: await issueTokens(req.user) } });
});

export default router;
