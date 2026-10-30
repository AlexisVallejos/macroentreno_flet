import { z } from 'zod';
import { addDays } from '../../utils/dates.js';
import { isoDate } from '../../utils/validation.js';

export const argentinaToday = (now = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(now);
export const mondayOf = (date) => addDays(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7));
export const weekQuery = z.object({
  week: isoDate.refine((s) => mondayOf(s) === s, 'La semana debe comenzar un lunes').optional(),
  userId: z.coerce.number().int().positive().optional(),
});
export const monthQuery = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mes esperado: AAAA-MM').optional(),
});
export function monthPeriod(month = argentinaToday().slice(0, 7)) {
  const from = `${month}-01`;
  const [year, m] = month.split('-').map(Number);
  const next = `${m === 12 ? year + 1 : year}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`;
  return { month, from, to: addDays(next, -1), next };
}
