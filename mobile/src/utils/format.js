export const round1 = (n) => Math.round(Number(n || 0) * 10) / 10;
export const fmt = (n, unit = '') => `${round1(n).toLocaleString('es-AR')}${unit}`;
export const signed = (n, unit = '') => `${n > 0 ? '+' : ''}${fmt(n, unit)}`;
