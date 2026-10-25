import PDFDocument from 'pdfkit';

const days = ['Todos los días', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const number = (n) => n == null ? 'Sin datos' : Number(n).toLocaleString('es-AR', { maximumFractionDigits: 1 });
const clean = (s) => String(s ?? '').replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ').replace(/[\u2011-\u2014]/g, '-');

function build(title, subtitle, draw) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true, info: { Title: title, Author: 'MacroEntreno' } });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    const room = (height = 65) => {
      if (doc.y + height > doc.page.height - 70) { doc.addPage(); return true; }
      return false;
    };
    const text = (value, { bold = false, size = 10, color = '#243247', gap = 6 } = {}) => {
      const content = clean(value);
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(color);
      room(Math.min(200, doc.heightOfString(content, { width: 499 }) + gap));
      doc.text(content, 48, doc.y, { width: 499, lineGap: 3 });
      doc.moveDown(gap / size);
    };
    const section = (value) => { room(110); doc.moveDown(.5); text(value, { bold: true, size: 13, color: '#087b5b', gap: 9 }); };
    text('MACROENTRENO', { bold: true, size: 11, color: '#087b5b', gap: 14 });
    text(title, { bold: true, size: 23, gap: 10 });
    text(subtitle, { color: '#617086', size: 10, gap: 14 });
    draw({ text, section, room });
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(8).fillColor('#617086');
      doc.text(`MacroEntreno | ${i + 1} / ${range.count}`, 48, doc.page.height - 40, { lineBreak: false });
    }
    doc.end();
  });
}

export function weeklyPdf(s) {
  return build('Tu rendimiento semanal', `${s.athlete.name} | ${s.from} al ${s.to}`, ({ text, section, room }) => {
    text(`Entrenador: ${s.athlete.coachName || 'Sin entrenador asignado'}`);
    section('Esta semana');
    text(`${s.summary.sessions} sesiones realizadas | ${s.summary.sets} series | ${number(s.summary.volume)} kg de volumen`);
    text(`${s.summary.loggedDays} de 7 días con comidas | ${s.summary.daysOnTarget} días dentro del objetivo calórico`);
    text(`Promedio registrado: ${number(s.summary.avgKcal)} kcal | Proteínas ${number(s.summary.avgProtein)} g | Carbohidratos ${number(s.summary.avgCarbs)} g | Grasas ${number(s.summary.avgFat)} g`);
    text(`Objetivos diarios: ${number(s.goals.kcal)} kcal | P ${number(s.goals.protein)} g | C ${number(s.goals.carbs)} g | G ${number(s.goals.fat)} g`);
    section('Comparación con la semana anterior');
    text(`${s.previous.from} al ${s.previous.to}: ${s.previous.summary.sessions} sesiones, ${number(s.previous.summary.volume)} kg de volumen, ${s.previous.summary.loggedDays} días de comidas.`);
    text(s.assessment, { bold: true });
    text(`Cambio en sesiones: ${s.comparison.sessions > 0 ? '+' : ''}${s.comparison.sessions} | Cambio de volumen: ${number(s.comparison.volume)} kg`);
    section('Detalle diario');
    for (const day of s.daily) {
      room(65);
      text(day.date, { bold: true, gap: 2 });
      text(`${day.meals ? `${number(day.kcal)} kcal | P ${number(day.protein)} g | C ${number(day.carbs)} g | G ${number(day.fat)} g` : 'Sin comidas registradas'}\n${day.sessions} sesiones realizadas | ${day.planned} pendientes | ${number(day.volume)} kg de volumen`, { gap: 9 });
    }
    section('Cargas por ejercicio');
    if (!s.exercises.length) text('No se registraron series realizadas durante esta semana.');
    for (const e of s.exercises) text(`${e.name}: ${number(e.bestWeight)} kg de carga máxima | ${number(e.volume)} kg de volumen | ${e.deltaWeight == null ? 'Sin comparación previa' : `Cambio: ${number(e.deltaWeight)} kg`}`);
    section('Cómo leer este informe');
    text(s.methodology, { size: 9, color: '#617086' });
    text('Una semana con registros incompletos no permite concluir si hubo progreso físico. Revisá los resultados con tu entrenador.', { size: 9, color: '#617086' });
  });
}

export function planPdf(p) {
  return build('Plan de alimentación', `${p.athleteName} | ${p.startDate} al ${p.endDate}`, ({ text, section, room }) => {
    text(p.title, { bold: true, size: 15 });
    text(`Preparado por: ${p.coachName || 'Equipo MacroEntreno'}${p.archived ? ' | ARCHIVADO' : ''}`);
    if (p.notes) { section('Indicaciones'); text(p.notes); }
    text('En la app: Diario > Mi plan de alimentación. Confirmá las comidas consumidas para copiarlas al diario y luego ajustá sus cantidades si es necesario. Las comidas de Todos los días se suman a las específicas de cada día.', { size: 9, color: '#617086' });
    for (let day = 0; day <= 7; day++) {
      const mealOrder = ['desayuno', 'almuerzo', 'merienda', 'cena', 'snack'];
      const items = p.items.filter((i) => i.dayOfWeek === day).sort((a, b) => mealOrder.indexOf(a.meal) - mealOrder.indexOf(b.meal));
      if (!items.length) continue;
      section(days[day]);
      for (const item of items) {
        if (room(65)) section(`${days[day]} (continuación)`);
        text(`${item.meal.toUpperCase()} | ${item.name} - ${number(item.grams)} g`, { bold: true, gap: 3 });
        text(`${number(item.kcal)} kcal | Proteínas ${number(item.protein)} g | Carbohidratos ${number(item.carbs)} g | Grasas ${number(item.fat)} g`, { gap: 10 });
      }
    }
  });
}

export function monthlyPdf(report, coachId) {
  const coaches = coachId ? report.coaches.filter((c) => c.id === coachId) : report.coaches;
  return build('Reporte mensual de entrenadores', `${report.month}${report.partial ? ' | Mes en curso' : ''}`, ({ text, section, room }) => {
    for (const c of coaches) {
      room(190);
      section(c.name);
      text(c.email || 'Sin email');
      text(`${c.clientsServed} clientes atendidos | ${c.newClients} clientes nuevos | ${c.clientsAtEnd} clientes al cierre${report.partial ? ' (actual)' : ''}`);
      text(`${c.activeClients} clientes con comidas | ${c.trainingClients} clientes con entrenamientos`);
      text(`${c.meals} comidas | ${c.loggedDays} días de registro por cliente | ${c.workouts} sesiones realizadas`);
      text(`Trabajo del entrenador: ${c.routines} rutinas asignadas y ${c.plans} planes de alimentación creados`);
    }
    if (!coaches.length) text('No hay entrenadores para este período.');
    section('Definición de las métricas');
    text(report.methodology, { size: 9, color: '#617086' });
  });
}

export function sendPdf(req, res, buffer, filename) {
  res.set('Cache-Control', 'private, no-store');
  if (req.query.format === 'base64') return res.json({ data: { filename, base64: buffer.toString('base64') } });
  res.type('application/pdf').set('Content-Disposition', `attachment; filename="${filename}"`).send(buffer);
}
