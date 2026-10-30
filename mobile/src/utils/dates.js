const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Fecha local 'YYYY-MM-DD' (no usar toISOString: está en UTC). */
export function toIsoDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const today = () => toIsoDate(new Date());

export function parseIsoDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso, days) {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/** "Hoy", "Ayer", "Mañana" o "Lun 3 feb". */
export function formatDayLabel(iso) {
  const t = today();
  if (iso === t) return 'Hoy';
  if (iso === addDays(t, -1)) return 'Ayer';
  if (iso === addDays(t, 1)) return 'Mañana';
  const d = parseIsoDate(iso);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export const shortWeekday = (iso) => DAYS[parseIsoDate(iso).getDay()];

/** Lunes de la semana de `iso`. */
export function mondayOf(iso) {
  const day = parseIsoDate(iso).getDay(); // 0 = domingo
  return addDays(iso, day === 0 ? -6 : 1 - day);
}

export function formatWeek(mondayIso) {
  const sunday = addDays(mondayIso, 6);
  const a = parseIsoDate(mondayIso);
  const b = parseIsoDate(sunday);
  return `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]}`;
}
