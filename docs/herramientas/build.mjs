// Genera un manual en DOCX y PDF (APA, A4, Arial, texto justificado) a partir de un archivo de contenido.
// Uso: node build.mjs <contenido.mjs> <dirCapturas> <dirSalida>
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import * as D from 'docx';
import { pathToFileURL } from 'node:url';
import { headingPages } from './pages.mjs';

const [CONTENT, CAP, OUT] = process.argv.slice(2);
const { meta, blocks } = await import(pathToFileURL(path.resolve(CONTENT)).href);
const IMG = path.join(OUT, 'figuras');
fs.mkdirSync(IMG, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });

// ---------- 1. Figuras: composiciones de capturas y salidas de terminal ----------
const b64 = (f) => fs.readFileSync(f).toString('base64');
async function renderHtml(html, out, width) {
  const p = await browser.newPage({ viewport: { width, height: 400 }, deviceScaleFactor: 2 });
  await p.setContent(html);
  await p.waitForTimeout(150);
  const el = await p.$('#root');
  await el.screenshot({ path: out, omitBackground: false });
  const box = await el.boundingBox();
  await p.close();
  return { w: box.width, h: box.height };
}
async function makeFigure(fig) {
  const out = path.join(IMG, `figura${fig.n}.png`);
  if (fig.shots) {
    const phone = fig.phoneWidth ?? 230;
    const items = fig.shots
      .map(([file, label], i) => `<div class="it"><img src="data:image/png;base64,${b64(path.join(CAP, file + '.png'))}" style="width:${phone}px">${fig.shots.length > 1 ? `<div class="lb">(${'abc'[i]}) ${label}</div>` : ''}</div>`)
      .join('');
    const html = `<style>body{margin:0;font-family:Arial}#root{display:inline-flex;gap:18px;padding:4px;background:#fff}.it{display:flex;flex-direction:column;align-items:center;gap:6px}img{border:1px solid #bbb;display:block}.lb{font-size:12px;color:#000;max-width:${phone}px;text-align:center}</style><div id="root">${items}</div>`;
    fig.size = await renderHtml(html, out, 1400);
  } else if (fig.terminal) {
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const lines = fig.terminal.map((l) => `<div>${esc(l).replace(/✔/g, '<span style="color:#3ad35a">✔</span>').replace(/^(\$ .*)$/, '<span style="color:#9cdcfe">$1</span>')}</div>`).join('');
    const html = `<style>body{margin:0}#root{display:inline-block;background:#1e1e1e;color:#e6e6e6;font:13px/1.45 Menlo,monospace;padding:14px 18px;border-radius:6px;width:${fig.termWidth ?? 640}px;white-space:pre}</style><div id="root">${lines}</div>`;
    fig.size = await renderHtml(html, out, 1000);
  }
  fig.file = out;
}
for (const b of blocks) if (b.t === 'fig') await makeFigure(b);

// ---------- 2. Texto con marcas simples: **negrita**, *cursiva*, `código` ----------
function parseRuns(text) {
  const runs = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index) });
    const s = m[0];
    if (s.startsWith('**')) runs.push({ text: s.slice(2, -2), bold: true });
    else if (s.startsWith('`')) runs.push({ text: s.slice(1, -1), code: true });
    else runs.push({ text: s.slice(1, -1), italics: true });
    last = m.index + s.length;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs;
}
const FONT = 'Arial';
const SIZE = 22; // 11 pt
const cm = (v) => Math.round((v / 2.54) * 1440);
const px = (v) => Math.round((v / 2.54) * 96);
const LINE = 360; // interlineado 1,5
const tr = (r, extra = {}) =>
  new D.TextRun({ text: r.text, bold: r.bold || extra.bold, italics: r.italics || extra.italics, font: r.code ? 'Courier New' : FONT, size: r.code ? SIZE - 2 : extra.size ?? SIZE });

// ---------- 3. DOCX ----------
function docxBlocks() {
  const out = [];
  const P = (opts) => out.push(new D.Paragraph(opts));
  let firstH1 = true;
  for (const b of blocks) {
    switch (b.t) {
      case 'cover': {
        const c = (text, o = {}) => P({ alignment: D.AlignmentType.CENTER, spacing: { line: LINE, before: o.before ?? 0 }, children: [new D.TextRun({ text, font: FONT, size: o.size ?? SIZE, bold: o.bold })] });
        c(meta.institution, { before: cm(5), bold: true });
        c(meta.title, { before: cm(2), bold: true, size: 28 });
        c(meta.subtitle, { size: SIZE });
        c(meta.student, { before: cm(5) });
        c(`Materia: ${meta.subject}`);
        c(`Docente: ${meta.teacher}`);
        c(`Curso: ${meta.course}`);
        c(`Fecha: ${meta.date}`);
        P({ children: [new D.PageBreak()] });
        break;
      }
      case 'pb':
        P({ children: [new D.PageBreak()] });
        break;
      case 'h1':
        if (b.pageBreak && !firstH1) P({ children: [new D.PageBreak()] });
        firstH1 = false;
        P({ heading: D.HeadingLevel.HEADING_1, alignment: D.AlignmentType.CENTER, spacing: { before: 240, after: 240, line: LINE }, children: [new D.TextRun({ text: b.text, bold: true, font: FONT, size: 24, color: '000000' })] });
        break;
      case 'h2':
        P({ heading: D.HeadingLevel.HEADING_2, keepNext: true, spacing: { before: 240, after: 120, line: LINE }, children: [new D.TextRun({ text: b.text, bold: true, font: FONT, size: SIZE, color: '000000' })] });
        break;
      case 'h3':
        P({ heading: D.HeadingLevel.HEADING_3, keepNext: true, spacing: { before: 180, after: 60, line: LINE }, children: [new D.TextRun({ text: b.text, bold: true, italics: true, font: FONT, size: SIZE, color: '000000' })] });
        break;
      case 'title': // título no numerado (Resumen, Índice, Referencias)
        P({ alignment: D.AlignmentType.CENTER, spacing: { after: 240, line: LINE }, children: [new D.TextRun({ text: b.text, bold: true, font: FONT, size: 24 })] });
        break;
      case 'p':
        P({ alignment: D.AlignmentType.JUSTIFIED, indent: b.noIndent ? undefined : { firstLine: cm(1.27) }, spacing: { line: LINE, after: 0 }, children: parseRuns(b.text).map((r) => tr(r)) });
        break;
      case 'kw':
        P({ alignment: D.AlignmentType.JUSTIFIED, indent: { firstLine: cm(1.27) }, spacing: { line: LINE, before: 120 }, children: [new D.TextRun({ text: 'Palabras clave: ', italics: true, font: FONT, size: SIZE }), new D.TextRun({ text: b.text, font: FONT, size: SIZE })] });
        break;
      case 'list':
        for (const item of b.items)
          P({ alignment: D.AlignmentType.JUSTIFIED, numbering: { reference: b.ordered ? 'num' : 'bullets', level: 0, instance: b.instance }, spacing: { line: LINE }, children: parseRuns(item).map((r) => tr(r)) });
        break;
      case 'code':
        for (const line of b.lines)
          P({ indent: { left: cm(1.27) }, spacing: { line: 276 }, shading: { type: D.ShadingType.CLEAR, fill: 'F2F2F2' }, children: [new D.TextRun({ text: line || ' ', font: 'Courier New', size: 19 })] });
        P({ spacing: { after: 120 }, children: [] });
        break;
      case 'fig': {
        P({ keepNext: true, spacing: { before: 240, line: LINE }, children: [new D.TextRun({ text: `Figura ${b.n}`, bold: true, font: FONT, size: SIZE })] });
        P({ keepNext: true, spacing: { line: LINE, after: 120 }, children: [new D.TextRun({ text: b.title, italics: true, font: FONT, size: SIZE })] });
        const w = px(b.widthCm);
        const h = Math.round((w * b.size.h) / b.size.w);
        P({ alignment: D.AlignmentType.CENTER, keepNext: Boolean(b.note), children: [new D.ImageRun({ type: 'png', data: fs.readFileSync(b.file), transformation: { width: w, height: h }, altText: { title: `Figura ${b.n}`, description: b.title, name: `figura${b.n}` } })] });
        if (b.note) P({ alignment: D.AlignmentType.JUSTIFIED, spacing: { line: LINE, after: 120 }, children: [new D.TextRun({ text: 'Nota. ', italics: true, font: FONT, size: 20 }), ...parseRuns(b.note).map((r) => tr(r, { size: 20 }))] });
        else P({ spacing: { after: 120 }, children: [] });
        break;
      }
      case 'table': {
        P({ keepNext: true, spacing: { before: 240, line: LINE }, children: [new D.TextRun({ text: `Tabla ${b.n}`, bold: true, font: FONT, size: SIZE })] });
        P({ keepNext: true, spacing: { line: LINE, after: 120 }, children: [new D.TextRun({ text: b.title, italics: true, font: FONT, size: SIZE })] });
        const widths = b.cols.map(cm);
        const total = widths.reduce((a, c) => a + c, 0);
        const none = { style: D.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
        const line = { style: D.BorderStyle.SINGLE, size: 6, color: '000000' };
        const mkRow = (cells, { head = false, last = false } = {}) =>
          new D.TableRow({
            tableHeader: head,
            cantSplit: true,
            children: cells.map((txt, i) =>
              new D.TableCell({
                width: { size: widths[i], type: D.WidthType.DXA },
                margins: { top: 50, bottom: 50, left: 90, right: 90 },
                borders: { top: head ? line : none, bottom: head || last ? line : none, left: none, right: none },
                children: [new D.Paragraph({ spacing: { line: 260 }, children: parseRuns(String(txt)).map((r) => tr(r, { bold: head, size: 19 })) })],
              }),
            ),
          });
        out.push(new D.Table({ width: { size: total, type: D.WidthType.DXA }, columnWidths: widths, alignment: D.AlignmentType.CENTER, rows: [mkRow(b.head, { head: true }), ...b.rows.map((r, i) => mkRow(r, { last: i === b.rows.length - 1 }))] }));
        if (b.note) P({ alignment: D.AlignmentType.JUSTIFIED, spacing: { before: 80, line: LINE, after: 120 }, children: [new D.TextRun({ text: 'Nota. ', italics: true, font: FONT, size: 20 }), ...parseRuns(b.note).map((r) => tr(r, { size: 20 }))] });
        else P({ spacing: { after: 120 }, children: [] });
        break;
      }
      case 'toc':
        out.push(new D.TableOfContents('Índice', { hyperlink: true, headingStyleRange: '1-3' }));
        break;
      case 'refs':
        for (const r of b.items)
          P({ alignment: D.AlignmentType.LEFT, indent: { left: cm(1.27), hanging: cm(1.27) }, spacing: { line: LINE, after: 120 }, children: parseRuns(r).map((x) => tr(x)) });
        break;
    }
  }
  return out;
}

const doc = new D.Document({
  creator: meta.student,
  title: meta.title,
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: FONT, size: SIZE } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: 24, bold: true, color: '000000' }, paragraph: { outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: SIZE, bold: true, color: '000000' }, paragraph: { outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: SIZE, bold: true, italics: true, color: '000000' }, paragraph: { outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [{ level: 0, format: D.LevelFormat.BULLET, text: '•', alignment: D.AlignmentType.LEFT, style: { paragraph: { indent: { left: cm(1.6), hanging: cm(0.5) } } } }] },
      { reference: 'num', levels: [{ level: 0, format: D.LevelFormat.DECIMAL, text: '%1.', alignment: D.AlignmentType.LEFT, style: { paragraph: { indent: { left: cm(1.6), hanging: cm(0.6) } } } }] },
    ],
  },
  sections: [
    {
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: cm(2.54), bottom: cm(2.54), left: cm(2.54), right: cm(2.54) } } },
      headers: {
        default: new D.Header({
          children: [new D.Paragraph({ alignment: D.AlignmentType.RIGHT, children: [new D.TextRun({ text: `${meta.sigla}  |  `, font: FONT, size: 20 }), new D.TextRun({ children: [D.PageNumber.CURRENT], font: FONT, size: 20 })] })],
        }),
      },
      children: docxBlocks(),
    },
  ],
});
const base = path.join(OUT, meta.fileName);
fs.writeFileSync(`${base}.docx`, await D.Packer.toBuffer(doc));

// ---------- 4. HTML → PDF (dos pasadas para numerar el índice) ----------
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const inline = (text) =>
  parseRuns(text)
    .map((r) => (r.bold ? `<b>${esc(r.text)}</b>` : r.italics ? `<i>${esc(r.text)}</i>` : r.code ? `<code>${esc(r.text)}</code>` : esc(r.text)))
    .join('');
function html(pages = {}) {
  const heads = blocks.filter((b) => ['h1', 'h2', 'h3'].includes(b.t) && !b.noToc);
  let body = '';
  let firstH1 = true;
  let id = 0;
  for (const b of blocks) {
    switch (b.t) {
      case 'cover':
        body += `<section class="cover"><p class="b">${esc(meta.institution)}</p><p class="tt">${esc(meta.title)}</p><p>${esc(meta.subtitle)}</p><div class="who"><p>${esc(meta.student)}</p><p>Materia: ${esc(meta.subject)}</p><p>Docente: ${esc(meta.teacher)}</p><p>Curso: ${esc(meta.course)}</p><p>Fecha: ${esc(meta.date)}</p></div></section>`;
        break;
      case 'pb':
        body += '<div class="pb"></div>';
        break;
      case 'h1':
        if (b.pageBreak && !firstH1) body += '<div class="pb"></div>';
        firstH1 = false;
        body += `<h1 id="h${id++}">${esc(b.text)}</h1>`;
        break;
      case 'h2':
        body += `<h2 id="h${id++}">${esc(b.text)}</h2>`;
        break;
      case 'h3':
        body += `<h3 id="h${id++}">${esc(b.text)}</h3>`;
        break;
      case 'title':
        body += `<h1 class="plain">${esc(b.text)}</h1>`;
        break;
      case 'p':
        body += `<p class="${b.noIndent ? 'ni' : ''}">${inline(b.text)}</p>`;
        break;
      case 'kw':
        body += `<p class="kw"><i>Palabras clave:</i> ${inline(b.text)}</p>`;
        break;
      case 'list':
        body += `<${b.ordered ? 'ol' : 'ul'}>${b.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${b.ordered ? 'ol' : 'ul'}>`;
        break;
      case 'code':
        body += `<pre>${b.lines.map(esc).join('\n')}</pre>`;
        break;
      case 'fig':
        body += `<figure><div class="keep"><p class="fn">Figura ${b.n}</p><p class="ft">${esc(b.title)}</p><img src="data:image/png;base64,${b64(b.file)}" style="width:${b.widthCm}cm"></div>${b.note ? `<p class="note"><i>Nota.</i> ${inline(b.note)}</p>` : ''}</figure>`;
        break;
      case 'table':
        body += `<div class="tbl${b.rows.length > 12 ? ' long' : ''}"><p class="fn">Tabla ${b.n}</p><p class="ft">${esc(b.title)}</p><table><colgroup>${b.cols.map((c) => `<col style="width:${c}cm">`).join('')}</colgroup><thead><tr>${b.head.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${inline(String(c))}</td>`).join('')}</tr>`).join('')}</tbody></table>${b.note ? `<p class="note"><i>Nota.</i> ${inline(b.note)}</p>` : ''}</div>`;
        break;
      case 'toc':
        body += `<div class="toc">${heads.map((h, i) => `<div class="l${h.t[1]}"><span>${esc(h.text)}</span><span class="dots"></span><span>${pages[i] ?? ''}</span></div>`).join('')}</div>`;
        break;
      case 'refs':
        body += b.items.map((r) => `<p class="ref">${inline(r)}</p>`).join('');
        break;
    }
  }
  return `<!DOCTYPE html><html lang="es"><meta charset="utf-8"><style>
  @page{size:A4;margin:2.54cm}
  body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;line-height:1.5;color:#000;margin:0}
  p{margin:0;text-align:justify;text-indent:1.27cm;hyphens:auto}
  p.ni{text-indent:0}
  p.kw{margin-top:8pt}
  h1{font-size:12pt;text-align:center;margin:0 0 12pt;break-after:avoid}
  h2{font-size:11pt;margin:12pt 0 6pt;break-after:avoid}
  h3{font-size:11pt;font-style:italic;margin:9pt 0 3pt;break-after:avoid}
  .pb{break-after:page}
  .cover{text-align:center;padding-top:4.5cm;break-after:page}
  .cover p{text-align:center;text-indent:0}
  .cover .b{font-weight:bold}.cover .tt{font-weight:bold;font-size:14pt;margin-top:2cm}
  .cover .who{margin-top:5cm}
  figure{margin:12pt 0 8pt}
  .keep{break-inside:avoid}
  .fn{font-weight:bold;text-indent:0;text-align:left}
  .ft{font-style:italic;text-indent:0;text-align:left;margin-bottom:6pt}
  figure img{display:block;margin:0 auto}
  .note{font-size:10pt;text-indent:0;margin-top:4pt;text-align:left}
  .tbl{margin:12pt 0 8pt;break-inside:avoid}
  .tbl.long{break-inside:auto}.tbl .ft{break-after:avoid}thead{display:table-header-group}
  table{border-collapse:collapse;margin:0 auto;font-size:9.5pt;line-height:1.3}
  th{text-align:left;border-top:1px solid #000;border-bottom:1px solid #000;padding:3pt 4pt}
  td{padding:3pt 4pt;vertical-align:top}
  tbody tr:last-child td{border-bottom:1px solid #000}
  tr{break-inside:avoid}
  code{font-family:'Courier New',monospace;font-size:9.5pt}
  pre{font-family:'Courier New',monospace;font-size:9.5pt;background:#f2f2f2;padding:6pt 10pt;margin:4pt 0 8pt 1.27cm;line-height:1.35;white-space:pre-wrap;break-inside:avoid}
  ul,ol{margin:2pt 0 4pt;padding-left:1.6cm}li{text-align:justify}
  .ref{text-indent:-1.27cm;padding-left:1.27cm;text-align:left;margin-bottom:6pt;word-break:break-word}
  .toc div{display:flex;gap:4pt;align-items:baseline}
  .toc .dots{flex:1;border-bottom:1px dotted #000;transform:translateY(-3pt)}
  .toc .l1{font-weight:bold}.toc .l2{padding-left:0.8cm}.toc .l3{padding-left:1.6cm;font-size:10pt}
  </style><body>${body}</body></html>`;
}
const header = `<div style="font-family:Arial;font-size:9pt;width:100%;text-align:right;padding-right:2.54cm;padding-top:1cm">${meta.sigla}&nbsp;&nbsp;|&nbsp;&nbsp;<span class="pageNumber"></span></div>`;
async function pdf(htmlText, file) {
  const p = await browser.newPage();
  await p.setContent(htmlText, { waitUntil: 'load' });
  await p.pdf({ path: file, format: 'A4', displayHeaderFooter: true, headerTemplate: header, footerTemplate: '<span></span>', margin: { top: '2.54cm', bottom: '2.54cm', left: '2.54cm', right: '2.54cm' }, printBackground: true });
  await p.close();
}
await pdf(html(), `${base}.pdf`);
// Segunda pasada: busca en qué página cae cada título para numerar el índice.
const heads = blocks.filter((b) => ['h1', 'h2', 'h3'].includes(b.t) && !b.noToc).map((b) => b.text);
const pages = await headingPages(`${base}.pdf`, heads);
await pdf(html(pages), `${base}.pdf`);
await browser.close();
console.log(`Listo: ${base}.docx y ${base}.pdf`);
