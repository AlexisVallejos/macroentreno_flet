// Capturas de navegación, entrenamientos, progreso, entrenador, administrador y pantallas grandes.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const URL = 'http://localhost:8081';
const API = 'http://localhost:3000/api';
const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const H = 844;
const newPage = async (viewport = { width: 390, height: H }) => {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme: 'dark', locale: 'es-AR' });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept());
  return page;
};
const shot = async (page, name, height) => {
  const vp = page.viewportSize();
  if (height) await page.setViewportSize({ width: vp.width, height });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  if (height) await page.setViewportSize(vp);
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
  await page.waitForTimeout(1500);
}
async function go(page, path) {
  await page.goto(`${URL}${path}`, { waitUntil: 'commit' });
  await page.waitForTimeout(2500);
}

await fetch(`${API}/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Lucía Gómez', email: 'lucia.gomez@mail.com', password: 'Lucia2026' }),
});

// ---------- Entrenamientos (Lucía) ----------
let p = await newPage();
await login(p, 'lucia.gomez@mail.com', 'Lucia2026');
await go(p, '/workouts');
await shot(p, 'e01_entrenos_vacio');
await text(p, 'Nueva sesión').click();
await field(p, 'Título').waitFor();
await btn(p, 'Guardar sesión').click();
await shot(p, 'e02_sesion_errores');
await field(p, 'Título').fill('Pecho y tríceps');
await text(p, 'Agregar ejercicio').click();
await text(p, 'Elegí un ejercicio').waitFor();
await shot(p, 'e03_elegir_ejercicio');
await text(p, 'Press de banca con barra').click();
await p.waitForTimeout(600);
await text(p, 'Agregar ejercicio').click();
await text(p, 'Extension de triceps en polea').click();
await p.waitForTimeout(600);
const kg = vis(p.getByPlaceholder('0'));
for (const [i, v] of ['40', '42,5', '45', '20', '20', '22,5'].entries()) await kg.nth(i).fill(v);
await btn(p, 'Realizada').click().catch(() => {});
await shot(p, 'e04_sesion_completa', 1500);
await btn(p, 'Guardar sesión').click();
await text(p, 'Pecho y tríceps').waitFor({ timeout: 15000 });
await shot(p, 'e05_entrenos_con_sesion');
await p.context().close();

// ---------- Progreso (cuenta de ejemplo con historial) ----------
p = await newPage();
await login(p, 'atleta@macroentreno.com', 'Demo1234');
await go(p, '/progress');
await shot(p, 'e06_progreso', 1500);
await p.context().close();

// ---------- Entrenador ----------
p = await newPage();
await login(p, 'coach@macroentreno.com', 'Demo1234');
await text(p, 'Ver seguimiento').click();
await p.waitForTimeout(2500);
await shot(p, 'e07_coach_ficha_atleta', 1300);
await go(p, '/catalog');
await shot(p, 'e08_coach_catalogo');
await p.context().close();

// ---------- Administrador: alta, modificación y baja de usuarios ----------
p = await newPage();
await login(p, 'admin@macroentreno.com', 'Demo1234');
await go(p, '/users');
await shot(p, 'e09_admin_usuarios');
await text(p, 'Nuevo usuario').click();
await field(p, 'Nombre').waitFor();
await field(p, 'Nombre').fill('Pablo Ruiz');
await field(p, 'Email').fill('pablo.ruiz@macroentreno.com');
await field(p, 'Contraseña inicial').fill('Entrena2026');
await btn(p, 'Entrenador').click();
await shot(p, 'e10_admin_nuevo_usuario');
await btn(p, 'Crear usuario').click();
await p.waitForTimeout(2500);
await shot(p, 'e11_admin_usuario_creado');
// Modificar: asignar entrenador a Martina
await text(p, 'Martina Atleta').click();
await text(p, 'Entrenador asignado').waitFor();
await p.waitForTimeout(1200);
await btn(p, 'Pablo Ruiz').click();
await shot(p, 'e12_admin_asignar_entrenador', 1100);
await btn(p, 'Guardar cambios').click();
await p.waitForTimeout(2500);
// Baja: eliminar un usuario de prueba creado para eso
await fetch(`${API}/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Usuario de prueba', email: 'prueba.baja@mail.com', password: 'Prueba2026' }),
});
await go(p, '/users');
await text(p, 'Usuario de prueba').click();
await text(p, 'Eliminar').waitFor();
await p.waitForTimeout(1000);
await text(p, 'Eliminar').click();
await p.waitForTimeout(2500);
await shot(p, 'e13_admin_usuarios_final');
await p.context().close();

// ---------- Pantallas grandes y orientación ----------
p = await newPage({ width: 1180, height: 820 });
await login(p, 'atleta@macroentreno.com', 'Demo1234');
await shot(p, 'e14_tablet_horizontal');
await p.context().close();
p = await newPage({ width: 844, height: 390 });
await login(p, 'atleta@macroentreno.com', 'Demo1234');
await go(p, '/diary');
await shot(p, 'e15_celular_horizontal');
await p.context().close();

await browser.close();
