// Recorre el diario de comidas, el catálogo y el plan de alimentación, y guarda capturas.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const URL = 'http://localhost:8081';
const API = 'http://localhost:3000/api';
const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const H = 844;
const newPage = async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: H }, deviceScaleFactor: 2, colorScheme: 'dark', locale: 'es-AR' });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept());
  return page;
};
const shot = async (page, name, height) => {
  if (height) await page.setViewportSize({ width: 390, height });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  if (height) await page.setViewportSize({ width: 390, height: H });
  console.log('OK', name);
};
const vis = (loc) => loc.locator('visible=true');
const field = (page, label) => vis(page.getByLabel(label, { exact: true })).first();
const btn = (page, name) => vis(page.getByRole('button', { name, exact: true })).first();
const text = (page, t) => vis(page.getByText(t, { exact: true })).first();

async function login(page, email, pass) {
  await page.goto(`${URL}/login`, { waitUntil: 'commit', timeout: 180000 });
  await field(page, 'Email').waitFor({ timeout: 180000 });
  await page.waitForTimeout(800);
  await field(page, 'Email').fill(email);
  await field(page, 'Contraseña').fill(pass);
  await btn(page, 'Ingresar').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  await page.waitForTimeout(1200);
}
async function go(page, path) {
  await page.goto(`${URL}${path}`, { waitUntil: 'commit' });
  await page.waitForTimeout(2500);
}
/** Desde el diario: + de la comida, busca en el catálogo, elige y agrega. */
async function addFromCatalog(page, meal, term, foodName, grams, shots = {}) {
  await vis(page.getByLabel(`Agregar a ${meal}`)).first().click();
  await field(page, 'Buscar alimento').waitFor();
  if (shots.form) await shot(page, shots.form);
  await field(page, 'Buscar alimento').fill(term);
  await page.waitForTimeout(1500);
  if (shots.search) await shot(page, shots.search);
  await text(page, foodName).click();
  await field(page, 'Cantidad (g)').fill(String(grams));
  if (shots.grams) await shot(page, shots.grams);
  await btn(page, 'Agregar').click();
  await text(page, 'Mi plan de alimentación').waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
}

// Cuenta nueva para empezar con el diario vacío (el registro se documenta aparte).
await fetch(`${API}/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Lucía Gómez', email: 'lucia.gomez@mail.com', password: 'Lucia2026' }),
});

// ---------- Diario: Lucía ----------
let p = await newPage();
await login(p, 'lucia.gomez@mail.com', 'Lucia2026');
await shot(p, 'c00_inicio_atleta');
await go(p, '/diary');
await text(p, 'Desayuno').waitFor();
await shot(p, 'c01_diario_vacio', 1330);

await addFromCatalog(p, 'Desayuno', 'avena', 'Avena en hojuelas', 60, { form: 'c02_registrar_desayuno', search: 'c03_buscar_alimento', grams: 'c04_cantidad' });
await shot(p, 'c05_diario_con_desayuno');
await addFromCatalog(p, 'Desayuno', 'banana', 'Banana', 120);
await addFromCatalog(p, 'Almuerzo', 'pollo', 'Pollo pechuga cocida', 200, { search: 'c06_buscar_almuerzo' });
await addFromCatalog(p, 'Merienda', 'yogur', 'Yogur griego descremado', 170);
await addFromCatalog(p, 'Cena', 'arroz integral cocido', 'Arroz integral cocido', 150);

// Snack con carga manual: primero vacío para ver la validación
await vis(p.getByLabel('Agregar a Snack')).first().click();
await field(p, 'Buscar alimento').waitFor();
await btn(p, 'Carga manual').click();
await field(p, 'Nombre').fill('');
await field(p, 'Cantidad (g)').fill('');
await btn(p, 'Agregar').click();
await shot(p, 'c07_manual_errores');
await field(p, 'Nombre').fill('Barrita de cereal');
await field(p, 'Cantidad (g)').fill('25');
await field(p, 'Kcal').fill('95');
await field(p, 'Proteínas').fill('2');
await field(p, 'Carbohidratos').fill('17');
await field(p, 'Grasas').fill('2,5');
await shot(p, 'c08_manual_completo');
await btn(p, 'Agregar').click();
await text(p, 'Mi plan de alimentación').waitFor({ timeout: 15000 });
await shot(p, 'c09_diario_completo', 1580);

// Editar: tocar el registro del almuerzo y cambiar los gramos
await text(p, 'Pollo pechuga cocida · 200 g').click();
await field(p, 'Cantidad (g)').waitFor();
await p.waitForTimeout(1200);
await field(p, 'Cantidad (g)').fill('250');
await shot(p, 'c10_editar_registro');
await btn(p, 'Guardar cambios').click();
await text(p, 'Mi plan de alimentación').waitFor({ timeout: 15000 });

// Eliminar la banana
await vis(p.getByLabel('Eliminar Banana')).first().click();
await p.waitForTimeout(1500);
await shot(p, 'c11_despues_de_editar_y_eliminar', 1500);

// Catálogo: crear un alimento personal
await go(p, '/foods');
await shot(p, 'c12_catalogo');
await text(p, 'Crear alimento personal').click();
await field(p, 'Nombre').waitFor();
await btn(p, 'Crear alimento').click();
await shot(p, 'c13_alimento_errores');
await field(p, 'Nombre').fill('Tostadas de pan integral');
await field(p, 'Categoría').fill('Panificados');
await field(p, 'Porción (g)').fill('30');
await field(p, 'Descripción').fill('2 tostadas');
await field(p, 'Kcal').fill('78');
await field(p, 'Proteínas (g)').fill('3,6');
await field(p, 'Carbohidratos (g)').fill('13');
await field(p, 'Grasas (g)').fill('1,2');
await shot(p, 'c14_alimento_completo', 1100);
await btn(p, 'Crear alimento').click();
await p.waitForTimeout(1500);
await vis(p.getByPlaceholder('Buscar por nombre o marca…')).first().fill('tostadas');
await p.waitForTimeout(1500);
await shot(p, 'c15_catalogo_alimento_creado');
await p.context().close();

// ---------- Plan de alimentación: el entrenador lo arma para Alexis (id 3) ----------
p = await newPage();
await login(p, 'coach@macroentreno.com', 'Demo1234');
await go(p, '/nutrition-plan-form?userId=3');
await field(p, 'Título').fill('Plan semanal de volumen');
await field(p, 'Indicaciones para el atleta').fill('Tomar 2 litros de agua por día y respetar las cantidades indicadas.');
for (const [meal, term, name] of [
  ['Desayuno', 'avena', 'Avena en hojuelas'],
  ['Almuerzo', 'pollo pechuga', 'Pollo pechuga cocida'],
  ['Merienda', 'yogur griego', 'Yogur griego descremado'],
  ['Cena', 'arroz integral cocido', 'Arroz integral cocido'],
]) {
  await btn(p, meal).click();
  await field(p, 'Buscar en el catálogo').fill(term);
  await btn(p, 'Buscar alimentos').click();
  await p.waitForTimeout(1300);
  await vis(p.getByRole('button', { name: new RegExp(`^${name}`) })).first().click();
  await p.waitForTimeout(400);
}
await shot(p, 'c16_plan_formulario', 1650);
await text(p, 'Asignar plan al atleta').click();
await p.waitForTimeout(2500);
await p.context().close();

// ---------- Plan de alimentación: lo ve y lo aplica el atleta ----------
p = await newPage();
await login(p, 'atleta@macroentreno.com', 'Demo1234');
await go(p, '/nutrition-plans');
await text(p, 'Agregar estas comidas a mi diario').waitFor({ timeout: 15000 });
await shot(p, 'c17_plan_atleta', 920);
await text(p, 'Agregar estas comidas a mi diario').click();
await p.waitForTimeout(2500);
await go(p, '/diary');
await text(p, 'Desayuno').waitFor();
await shot(p, 'c18_diario_con_plan');
await text(p, 'Desayuno').scrollIntoViewIfNeeded();
await p.evaluate(() => { const el = [...document.querySelectorAll('div')].find((d) => d.textContent === 'Desayuno' && d.offsetParent); el?.scrollIntoView({ block: 'start' }); });
await shot(p, 'c18b_diario_con_plan_comidas', 1250);
await vis(p.getByLabel('Día anterior')).first().click();
await p.waitForTimeout(2000);
await shot(p, 'c19_dia_anterior');
await p.context().close();

await browser.close();
