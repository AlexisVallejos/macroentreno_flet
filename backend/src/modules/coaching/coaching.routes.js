import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../config/db.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { resolveTargetUser } from '../../utils/access.js';
import { badRequest, forbidden } from '../../utils/httpError.js';
import { idParam, isoDate } from '../../utils/validation.js';
import { addDays } from '../../utils/dates.js';
import { argentinaToday, mondayOf } from '../reports/periods.js';
import { planPdf, sendPdf } from '../reports/reports.pdf.js';
import * as plans from './nutrition.service.js';

const router = Router();
router.use(authenticate);
const target = z.object({ userId: z.coerce.number().int().positive().optional() });
const planSchema = z.object({
  athleteId: z.coerce.number().int().positive(), title: z.string().trim().min(2).max(120),
  notes: z.string().trim().max(3000).default(''), startDate: isoDate, endDate: isoDate,
  items: z.array(z.object({ foodId: z.coerce.number().int().positive(), grams: z.coerce.number().positive().max(5000),
    meal: z.enum(['desayuno', 'almuerzo', 'merienda', 'cena', 'snack']), dayOfWeek: z.coerce.number().int().min(0).max(7).default(0) })).min(1).max(100),
}).refine((v) => v.endDate >= v.startDate && v.endDate <= addDays(v.startDate, 366), { path: ['endDate'], message: 'La vigencia debe ser de hasta un año y terminar después del inicio' });
async function athleteTarget(req, id) {
  const userId = await resolveTargetUser(req, id, { coachCan: true });
  const [user] = await query("SELECT id FROM users WHERE id = ? AND role = 'athlete'", [userId]);
  if (!user) throw badRequest('Seleccioná un atleta');
  return userId;
}
async function accessiblePlan(req) {
  const p = await plans.getPlan(req.valid.params.id);
  await athleteTarget(req, p.athleteId);
  return p;
}

router.get('/dashboard', authorize('coach'), validate({ query: z.object({ date: isoDate.optional() }) }), async (req, res) => {
  const date = req.valid.query.date || argentinaToday();
  const from = mondayOf(date);
  const to = addDays(from, 6);
  const [clients, nutrition, workouts] = await Promise.all([
    query(`SELECT id, name, email, is_active AS isActive, kcal_goal AS kcalGoal FROM users WHERE role = 'athlete' AND coach_id = ? ORDER BY name`, [req.user.id]),
    query(`SELECT d.user_id AS userId, d.entry_date AS date, COUNT(*) AS meals, SUM(kcal) AS kcal, SUM(protein) AS protein
      FROM diary_entries d JOIN users u ON u.id = d.user_id WHERE u.role = 'athlete' AND u.coach_id = ?
      AND d.entry_date BETWEEN ? AND LEAST(?, ?) GROUP BY d.user_id, d.entry_date`, [req.user.id, from, to, argentinaToday()]),
    query(`SELECT w.user_id AS userId, w.workout_date AS date, w.status, COUNT(*) AS total FROM workouts w JOIN users u ON u.id = w.user_id
      WHERE u.role = 'athlete' AND u.coach_id = ? AND w.workout_date BETWEEN ? AND ? GROUP BY w.user_id, w.workout_date, w.status`, [req.user.id, from, to]),
  ]);
  res.json({ data: { date, from, to, clients: clients.map((c) => {
    const days = nutrition.filter((d) => d.userId === c.id);
    const sessions = workouts.filter((w) => w.userId === c.id);
    return { ...c, isActive: Boolean(c.isActive), loggedDays: days.length,
      onTargetDays: days.filter((d) => Math.abs(d.kcal - c.kcalGoal) <= c.kcalGoal * .1).length,
      avgKcal: days.length ? Math.round(days.reduce((s, d) => s + Number(d.kcal), 0) / days.length) : null,
      sessions: sessions.filter((w) => w.status === 'completed' && w.date <= argentinaToday()).reduce((s, w) => s + Number(w.total), 0),
      planned: sessions.filter((w) => w.status === 'planned').reduce((s, w) => s + Number(w.total), 0),
      day: days.find((d) => d.date === date) || null };
  }) } });
});
router.get('/plans', validate({ query: target }), async (req, res) => {
  res.json({ data: await plans.listPlans(await athleteTarget(req, req.valid.query.userId)) });
});
router.post('/plans', authorize('coach', 'admin'), validate({ body: planSchema }), async (req, res) => {
  const id = await athleteTarget(req, req.valid.body.athleteId);
  res.status(201).json({ data: await plans.createPlan(id, req.user.id, req.valid.body) });
});
router.get('/plans/:id', validate({ params: idParam }), async (req, res) => res.json({ data: await accessiblePlan(req) }));
router.get('/plans/:id/pdf', validate({ params: idParam }), async (req, res) => {
  const p = await accessiblePlan(req);
  sendPdf(req, res, await planPdf(p), `plan-alimentacion-${p.id}.pdf`);
});
router.post('/plans/:id/archive', authorize('coach', 'admin'), validate({ params: idParam }), async (req, res) => {
  const p = await accessiblePlan(req);
  res.json({ data: await plans.archivePlan(p.id) });
});
router.post('/plans/:id/apply', authorize('athlete'), validate({ params: idParam, body: z.object({ date: isoDate }) }), async (req, res) => {
  const p = await plans.getPlan(req.valid.params.id);
  if (p.athleteId !== req.user.id) throw forbidden('El plan pertenece a otro atleta');
  res.json({ data: await plans.applyPlan(p, req.user.id, req.valid.body.date) });
});
export default router;
