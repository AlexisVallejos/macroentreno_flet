import 'dotenv/config';

/** Lee una variable obligatoria; en producción falla al arrancar si falta. */
function required(name, devFallback) {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV === 'production' || devFallback === undefined) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return devFallback;
}

const list = (value) =>
  (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  corsOrigin: process.env.CORS_ORIGIN || '*',

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'macroentreno',
  },

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', 'dev_access_secret_no_usar_en_produccion'),
    refreshSecret: required('JWT_REFRESH_SECRET', 'dev_refresh_secret_no_usar_en_produccion'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresDays: Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 30),
  },

  oauth: {
    // URL pública de esta API (ej. https://xxxx.ngrok-free.app). Se usa para armar el callback.
    publicApiUrl: (process.env.PUBLIC_API_URL || '').replace(/\/$/, ''),
    // Esquemas a los que se permite volver después del login social.
    appSchemes: list(process.env.APP_REDIRECT_SCHEMES || 'macroentreno,exp,exps'),
  },

  // Búsqueda de alimentos con micronutrientes (OAuth 1.0: no depende de la IP habilitada en FatSecret).
  fatsecret: {
    consumerKey: process.env.FATSECRET_CONSUMER_KEY || '',
    consumerSecret: process.env.FATSECRET_CONSUMER_SECRET || '',
    region: process.env.FATSECRET_REGION || '',
    language: process.env.FATSECRET_LANGUAGE || '',
  },

  // MacroEntreno Pro: suscripción mensual con Mercado Pago.
  billing: {
    mpAccessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
    mpWebhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET || '',
    price: Number(process.env.PRO_PRICE || 4999),
    currency: process.env.PRO_CURRENCY || 'ARS',
    // Adónde vuelve el navegador después de pagar (la app web, ej. https://app.midominio.com).
    appUrl: (process.env.PUBLIC_APP_URL || '').replace(/\/$/, ''),
  },

  social: {
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    facebookAppId: process.env.FACEBOOK_APP_ID || '',
    facebookAppSecret: process.env.FACEBOOK_APP_SECRET || '',
    githubClientId: process.env.GITHUB_CLIENT_ID || '',
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET || '',
  },
};
