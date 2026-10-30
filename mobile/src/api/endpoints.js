import { api, publicApi } from './client';

/** Todas las llamadas al backend en un solo lugar. Devuelven `data` (o {data, meta} en listados). */
const data = (p) => p.then((json) => json?.data);

export const authApi = {
  login: (body) => data(publicApi('/auth/login', { method: 'POST', body })),
  register: (body) => data(publicApi('/auth/register', { method: 'POST', body })),
  oauthExchange: (body) => data(publicApi('/auth/oauth/exchange', { method: 'POST', body })),
  logout: (refreshToken) => publicApi('/auth/logout', { method: 'POST', body: { refreshToken } }),
  me: () => data(api('/auth/me')),
  changePassword: (body) => data(api('/auth/password', { method: 'PUT', body })),
};

export const usersApi = {
  list: (query) => api('/users', { query }),
  get: (id) => data(api(`/users/${id}`)),
  create: (body) => data(api('/users', { method: 'POST', body })),
  update: (id, body) => data(api(`/users/${id}`, { method: 'PUT', body })),
  updateGoals: (id, goals) => data(api(`/users/${id}/goals`, { method: 'PUT', body: { goals } })),
  remove: (id) => api(`/users/${id}`, { method: 'DELETE' }),
  updateMe: (body) => data(api('/users/me', { method: 'PATCH', body })),
};

export const foodsApi = {
  list: (query) => api('/foods', { query }),
  categories: () => data(api('/foods/categories')),
  get: (id) => data(api(`/foods/${id}`)),
  create: (body) => data(api('/foods', { method: 'POST', body })),
  update: (id, body) => data(api(`/foods/${id}`, { method: 'PUT', body })),
  remove: (id) => api(`/foods/${id}`, { method: 'DELETE' }),
  // MacroEntreno Pro: base de FatSecret con micronutrientes
  searchFatSecret: (search, query) => data(api('/foods/fatsecret/search', { query: { search, ...query } })),
  importFatSecret: (externalId) => data(api('/foods/fatsecret/import', { method: 'POST', body: { externalId } })),
  // Bases gratuitas: Open Food Facts (envasados) y USDA (genéricos, en inglés)
  searchExternal: (source, search) => data(api('/foods/external/search', { query: { source, search, limit: 20 }, timeout: 25000 })),
  importExternal: (source, externalId) => data(api('/foods/external/import', { method: 'POST', body: { source, externalId }, timeout: 25000 })),
  // Escáner: { found, source, food } o { found: false, barcode }
  barcode: (code) => data(api(`/foods/barcode/${encodeURIComponent(code)}`, { timeout: 25000 })),
};

/** Asistente con IA (OpenAI, desde el servidor). Las respuestas pueden tardar: timeouts más largos. */
export const aiApi = {
  /** { configured, model, warning? }: si el servidor tiene la clave de OpenAI. */
  status: () => data(api('/ai/status')),
  chat: (messages) => data(api('/ai/chat', { method: 'POST', body: { messages }, timeout: 90000 })),
  foodPhoto: (image, note) => data(api('/ai/food-photo', { method: 'POST', body: { image, note }, timeout: 90000 })),
  transcribe: (audio, mimeType) => data(api('/ai/transcribe', { method: 'POST', body: { audio, mimeType }, timeout: 60000 })),
  speech: (text) => data(api('/ai/speech', { method: 'POST', body: { text }, timeout: 60000 })),
};

export const diaryApi = {
  day: (date, userId) => data(api('/diary', { query: { date, userId } })),
  create: (body) => data(api('/diary', { method: 'POST', body })),
  update: (id, body) => data(api(`/diary/${id}`, { method: 'PUT', body })),
  remove: (id) => api(`/diary/${id}`, { method: 'DELETE' }),
};

export const exercisesApi = {
  list: (query) => data(api('/exercises', { query })),
  muscleGroups: () => data(api('/exercises/muscle-groups')),
  get: (id) => data(api(`/exercises/${id}`)),
  create: (body) => data(api('/exercises', { method: 'POST', body })),
  update: (id, body) => data(api(`/exercises/${id}`, { method: 'PUT', body })),
  remove: (id) => api(`/exercises/${id}`, { method: 'DELETE' }),
};

export const workoutsApi = {
  list: (query) => data(api('/workouts', { query })),
  get: (id) => data(api(`/workouts/${id}`)),
  create: (body) => data(api('/workouts', { method: 'POST', body })),
  update: (id, body) => data(api(`/workouts/${id}`, { method: 'PUT', body })),
  remove: (id) => api(`/workouts/${id}`, { method: 'DELETE' }),
};

export const progressApi = {
  get: (query) => data(api('/progress', { query })),
};

export const adminApi = {
  stats: () => data(api('/admin/stats')),
};

/** MacroEntreno Pro: suscripción mensual con Mercado Pago. */
export const billingApi = {
  plan: () => data(api('/billing/plan')),
  subscribe: () => data(api('/billing/subscribe', { method: 'POST' })),
  sync: () => data(api('/billing/sync', { method: 'POST' })),
  cancel: () => data(api('/billing/cancel', { method: 'POST' })),
  grant: (userId, days) => data(api('/billing/grant', { method: 'POST', body: { userId, days } })),
};

export const coachingApi = {
  dashboard: (date) => data(api('/coaching/dashboard', { query: { date } })),
  plans: (userId) => data(api('/coaching/plans', { query: { userId } })),
  createPlan: (body) => data(api('/coaching/plans', { method: 'POST', body })),
  archivePlan: (id) => data(api(`/coaching/plans/${id}/archive`, { method: 'POST' })),
  applyPlan: (id, date) => data(api(`/coaching/plans/${id}/apply`, { method: 'POST', body: { date } })),
  planPdf: (id) => data(api(`/coaching/plans/${id}/pdf`, { query: { format: 'base64' } })),
};
export const reportsApi = {
  weeklyPreview: (week, userId) => data(api('/reports/weekly/preview', { query: { week, userId } })),
  weeklyList: (userId) => data(api('/reports/weekly', { query: { userId } })),
  weekly: (id) => data(api(`/reports/weekly/${id}`)),
  generateWeekly: (week, userId) => data(api('/reports/weekly/generate', { method: 'POST', body: { week, userId } })),
  weeklyPdf: (id) => data(api(`/reports/weekly/${id}/pdf`, { query: { format: 'base64' } })),
  monthly: (month) => data(api('/reports/coaches/monthly', { query: { month } })),
  monthlyPdf: (month, coachId) => data(api('/reports/coaches/monthly/pdf', { query: { month, coachId, format: 'base64' } })),
};
