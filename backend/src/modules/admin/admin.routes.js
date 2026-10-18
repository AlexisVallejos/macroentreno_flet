import { Router } from 'express';
import { query } from '../../config/db.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { addDays, today } from '../../utils/dates.js';

const router = Router();
router.use(authenticate, authorize('admin'));

/** Números generales para el panel del administrador. */
router.get('/stats', async (_req, res) => {
  const weekAgo = addDays(today(), -6);
  const [roles, [foods], [entries], [workouts], [unassigned], recentUsers] = await Promise.all([
    query('SELECT role, COUNT(*) AS total, SUM(is_active) AS active FROM users GROUP BY role'),
    query('SELECT SUM(owner_id IS NULL) AS global, SUM(owner_id IS NOT NULL) AS custom FROM foods'),
    query('SELECT COUNT(*) AS total FROM diary_entries WHERE entry_date >= ?', [weekAgo]),
    query('SELECT COUNT(*) AS total FROM workouts WHERE workout_date >= ?', [weekAgo]),
    query("SELECT COUNT(*) AS total FROM users WHERE role = 'athlete' AND coach_id IS NULL"),
    query('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC, id DESC LIMIT 5'),
  ]);

  const usersByRole = { admin: 0, coach: 0, athlete: 0 };
  let activeUsers = 0;
  for (const r of roles) {
    usersByRole[r.role] = Number(r.total);
    activeUsers += Number(r.active);
  }

  res.json({
    data: {
      usersByRole,
      totalUsers: usersByRole.admin + usersByRole.coach + usersByRole.athlete,
      activeUsers,
      athletesWithoutCoach: Number(unassigned.total),
      foods: { global: Number(foods.global ?? 0), custom: Number(foods.custom ?? 0) },
      last7Days: { diaryEntries: Number(entries.total), workouts: Number(workouts.total) },
      recentUsers: recentUsers.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.created_at })),
    },
  });
});

export default router;
