// Devuelve la página de cada título del índice, salteando portada e índice.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export async function headingPages(pdfPath, heads) {
  const doc = await getDocument({ url: pdfPath, useSystemFonts: true }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    const lines = new Map();
    for (const item of content.items) {
      const y = Math.round(item.transform[5]);
      lines.set(y, (lines.get(y) ?? '') + item.str);
    }
    pages.push([...lines.values()].map((l) => l.trim()));
  }
  const start = pages.findIndex((p) => p.includes('Índice')) + 1;
  const out = {};
  let page = start;
  heads.forEach((h, i) => {
    for (let j = page; j < pages.length; j++) {
      if (pages[j].includes(h)) {
        out[i] = j + 1;
        page = j;
        return;
      }
    }
  });
  return out;
}
