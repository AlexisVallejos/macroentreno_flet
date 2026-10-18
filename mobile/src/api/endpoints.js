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
