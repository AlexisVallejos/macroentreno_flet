import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { resolveTargetUser } from '../../utils/access.js';
import { badRequest, notFound } from '../../utils/httpError.js';
import { idParam } from '../../utils/validation.js';
import { addDays } from '../../utils/dates.js';
import { argentinaToday, mondayOf, weekQuery, monthQuery } from './periods.js';
import { monthlyPdf, sendPdf } from './reports.pdf.js';
import * as reports from './reports.service.js';
const router = Router();
router.use(authenticate);
router.get('/weekly/preview', validate({ query: weekQuery }), async (req, res) => {
  const userId = await resolveTargetUser(req, req.valid.query.userId, { coachCan: true });
  const week = req.valid.query.week || mondayOf(argentinaToday());
  if (week > mondayOf(argentinaToday())) throw badRequest('La semana todavía no comenzó');
  res.json({ data: await reports.weeklySnapshot(userId, week) });
});
router.get('/weekly', validate({ query: weekQuery }), async (req, res) => {
  const userId = await resolveTargetUser(req, req.valid.query.userId, { coachCan: true });
  res.json({ data: await reports.listWeeklyReports(userId) });
});
router.post('/weekly/generate', validate({ body: weekQuery }), async (req, res) => {
  const userId = await resolveTargetUser(req, req.valid.body.userId, { coachCan: true });
  const week = req.valid.body.week || addDays(mondayOf(argentinaToday()), -7);
  if (addDays(week, 6) >= argentinaToday()) throw badRequest('El informe se genera cuando termina la semana');
  const id = await reports.ensureWeeklyReport(userId, week);
  res.json({ data: { id, weekStart: week } });
});
router.get('/weekly/:id', validate({ params: idParam }), async (req, res) => {
  const report = await reports.getWeeklyReport(req.valid.params.id);
  await resolveTargetUser(req, report.athlete_id, { coachCan: true });
  res.json({ data: { id: report.id, generatedAt: report.generated_at, ...report.snapshot } });
});
router.get('/weekly/:id/pdf', validate({ params: idParam }), async (req, res) => {
  const report = await reports.getWeeklyReport(req.valid.params.id);
  await resolveTargetUser(req, report.athlete_id, { coachCan: true });
  sendPdf(req, res, report.pdf, `rendimiento-semanal-${report.week_start}.pdf`);
});
router.get('/coaches/monthly', authorize('admin'), validate({ query: monthQuery }), async (req, res) => {
  res.json({ data: await reports.monthlyCoaches(req.valid.query.month) });
});
router.get('/coaches/monthly/pdf', authorize('admin'), validate({ query: monthQuery.extend({ coachId: z.coerce.number().int().positive().optional() }) }), async (req, res) => {
  const r = await reports.monthlyCoaches(req.valid.query.month);
  const coachId = req.valid.query.coachId;
  if (coachId && !r.coaches.some((c) => c.id === coachId)) throw notFound('Entrenador no encontrado');
  sendPdf(req, res, await monthlyPdf(r, coachId), `entrenadores-${r.month}${coachId ? `-${coachId}` : ''}.pdf`);
});
export default router;
