/** Convierte una fila de `users` en el objeto público (nunca expone el hash). */
export function toPublicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    coachId: row.coach_id,
    coachName: row.coach_name ?? undefined,
    avatarUrl: row.avatar_url,
    goals: {
      kcal: row.kcal_goal,
      protein: row.protein_goal,
      carbs: row.carbs_goal,
      fat: row.fat_goal,
    },
    // Pro por suscripción (atletas) o incluido por el rol (entrenadores y administradores).
    plan: {
      pro: row.role !== 'athlete' || Boolean(row.pro_active),
      source: row.role !== 'athlete' ? 'role' : row.pro_active ? 'subscription' : null,
      proUntil: row.pro_until ?? null,
    },
    isActive: Boolean(row.is_active),
    hasPassword: Boolean(row.password_hash),
    createdAt: row.created_at,
  };
}

export const USER_COLUMNS = `u.id, u.name, u.email, u.password_hash, u.role, u.coach_id, u.avatar_url,
  u.kcal_goal, u.protein_goal, u.carbs_goal, u.fat_goal, u.is_active, u.created_at, u.pro_until,
  (u.pro_until IS NOT NULL AND u.pro_until > NOW()) AS pro_active,
  c.name AS coach_name`;

export const USER_FROM = 'users u LEFT JOIN users c ON c.id = u.coach_id';
