// Lo que se dibuja sobre la cámara. El video se muestra espejado (como un espejo: moverse a la derecha mueve a la
// derecha en pantalla); el canvas no, así que acá se invierte la x y los números de los ángulos se leen al derecho.

/** Solo el cuerpo: los puntos de la cara y los dedos suman ruido, no información. */
const BONES = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 31], [24, 26], [26, 28], [28, 32],
];
const JOINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

// Verde y naranja de sistema de iOS: llegó a la profundidad / todavía no; rojo para lo que hay que corregir.
const OK = '#30D158';
const BAD = '#FF453A';
const ACCENT = '#FF9F0A';
const SEEN = 0.5;
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Rounded", system-ui, sans-serif';

const seen = (lm, index) => !!lm[index] && (lm[index].visibility ?? 1) >= SEEN;

/** Esquinas que marcan dónde pararse mientras la persona todavía no está encuadrada. */
function guide(ctx, width, height) {
  const x0 = width * 0.24;
  const x1 = width * 0.76;
  const y0 = height * 0.05;
  const y1 = height * 0.95;
  const arm = Math.min(width, height) * 0.08;
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = Math.max(3, width / 320);
  ctx.lineCap = 'round';
  for (const [x, y, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
    ctx.beginPath();
    ctx.moveTo(x, y + dy * arm);
    ctx.lineTo(x, y);
    ctx.lineTo(x + dx * arm, y);
    ctx.stroke();
  }
  ctx.restore();
}

function label(ctx, text, x, y, size, color) {
  ctx.save();
  ctx.font = `700 ${size}px ${FONT}`;
  const w = ctx.measureText(text).width + size * 0.6;
  const h = size * 1.15;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + size * 0.04);
  ctx.restore();
}

/**
 * input: { lm, failing (puntos en rojo), judged (true mientras una regla juzga el cuerpo: articulaciones verdes),
 * measured (los tres puntos del ángulo que se cuenta), degrees, reached (si llegó a la profundidad), guide }.
 */
export function drawOverlay(ctx, width, height, input) {
  ctx.clearRect(0, 0, width, height);
  const { lm } = input;
  if (input.guide) guide(ctx, width, height);
  if (!lm) return;

  const p = (index) => ({ x: (1 - lm[index].x) * width, y: lm[index].y * height });
  const bad = new Set(input.failing);
  const focus = new Set(input.measured ?? []);
  const line = Math.max(3, width / 240);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Huesos: blancos; los del ángulo que se cuenta, en color; rojos si falla una articulación de cualquier punta.
  for (const [a, b] of BONES) {
    if (!seen(lm, a) || !seen(lm, b)) continue;
    const from = p(a);
    const to = p(b);
    const counted = focus.has(a) && focus.has(b);
    ctx.strokeStyle = bad.has(a) || bad.has(b) ? BAD : counted ? (input.reached ? OK : ACCENT) : 'rgba(255, 255, 255, 0.82)';
    ctx.lineWidth = counted ? line * 1.6 : line;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  // Cabeza: un círculo del tamaño de los hombros, para que la figura se lea como una persona y no como un palito.
  if (seen(lm, 0) && seen(lm, 11) && seen(lm, 12)) {
    const nose = p(0);
    const radius = Math.max(width / 60, Math.hypot(p(11).x - p(12).x, p(11).y - p(12).y) * 0.32);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.lineWidth = line;
    ctx.beginPath();
    ctx.arc(nose.x, nose.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const index of JOINTS) {
    if (!seen(lm, index)) continue;
    const { x, y } = p(index);
    const failing = bad.has(index);
    if (failing) {
      ctx.fillStyle = 'rgba(255, 69, 58, 0.28)';
      ctx.beginPath();
      ctx.arc(x, y, width / 40, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = failing ? BAD : input.judged ? OK : ACCENT;
    ctx.beginPath();
    ctx.arc(x, y, failing ? width / 90 : width / 150, 0, Math.PI * 2);
    ctx.fill();
  }

  // El ángulo que se cuenta: un arco en su vértice y el valor en grados.
  if (input.measured && input.degrees !== null && input.measured.every((index) => seen(lm, index))) {
    const [a, b, c] = input.measured.map(p);
    const start = Math.atan2(a.y - b.y, a.x - b.x);
    let end = Math.atan2(c.y - b.y, c.x - b.x);
    let delta = end - start;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    end = start + delta;
    const radius = Math.max(width / 30, Math.min(Math.hypot(a.x - b.x, a.y - b.y), Math.hypot(c.x - b.x, c.y - b.y)) * 0.35);
    const color = input.reached ? OK : ACCENT;
    ctx.fillStyle = input.reached ? 'rgba(48, 209, 88, 0.22)' : 'rgba(255, 159, 10, 0.2)';
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.arc(b.x, b.y, radius, start, end, delta < 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = line;
    ctx.beginPath();
    ctx.arc(b.x, b.y, radius, start, end, delta < 0);
    ctx.stroke();
    // La etiqueta va por fuera del ángulo, del lado opuesto a su abertura.
    const middle = start + delta / 2 + Math.PI;
    const distance = radius + width / 28;
    label(ctx, `${Math.round(input.degrees)}°`, b.x + Math.cos(middle) * distance, b.y + Math.sin(middle) * distance, Math.max(18, width / 34), color);
  }
}
