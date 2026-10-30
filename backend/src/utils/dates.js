/** Fecha local del servidor como 'YYYY-MM-DD'. */
export function today() {
  const now = new Date();
  return toIsoDate(now);
}

export function toIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Suma (o resta) días a una fecha 'YYYY-MM-DD'. */
export function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return toIsoDate(new Date(y, m - 1, d + days));
}

/** Lista de fechas consecutivas entre from y to (inclusive). */
export function dateRange(from, to) {
  const out = [];
  for (let current = from; current <= to; current = addDays(current, 1)) out.push(current);
  return out;
}
