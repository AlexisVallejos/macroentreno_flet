// Recorre login y registro en la versión web de la app y guarda capturas numeradas.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const URL = 'http://localhost:8081';
const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const log = [];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const newPage = async (scheme = 'dark') => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, locale: 'es-AR' });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept());
  return page;
};
const shot = async (page, name, note) => {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  log.push({ name, note, url: page.url() });
  console.log('OK', name, '-', note);
};
const field = (page, label) => page.getByLabel(label, { exact: true }).locator('visible=true');
const btn = (page, text) => page.getByRole('button', { name: text, exact: true }).locator('visible=true');
const goLogin = async (page) => {
  await page.goto(`${URL}/login`, { waitUntil: 'commit', timeout: 180000 });
  await field(page, 'Email').waitFor({ timeout: 180000 });
  await page.waitForTimeout(1200);
};
const doLogin = async (page, email, pass) => {
  await field(page, 'Email').fill(email);
  await field(page, 'Contraseña').fill(pass);
  await btn(page, 'Ingresar').click();
};

// --- LOGIN ---
let p = await newPage();
await goLogin(p);
await shot(p, '01_login_pantalla', 'Pantalla de inicio de sesión vacía');
await btn(p, 'Ingresar').click();
await shot(p, '02_login_campos_vacios', 'Validación de campos vacíos');
await field(p, 'Email').fill('atleta@macroentreno');
await field(p, 'Contraseña').fill('x');
await btn(p, 'Ingresar').click();
await shot(p, '03_login_email_invalido', 'Email con formato inválido');
await doLogin(p, 'atleta@macroentreno.com', 'Incorrecta1');
await p.getByText('Email o contraseña incorrectos').waitFor();
await shot(p, '04_login_credenciales_incorrectas', 'Contraseña incorrecta: respuesta 401 del servidor');
await doLogin(p, 'atleta@macroentreno.com', 'Demo1234');
await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
await shot(p, '05_login_ok_atleta', 'Ingreso correcto como Atleta');
await p.context().close();

for (const [role, email] of [['entrenador', 'coach@macroentreno.com'], ['admin', 'admin@macroentreno.com']]) {
  p = await newPage();
  await goLogin(p);
  await doLogin(p, email, 'Demo1234');
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  await shot(p, `06_login_ok_${role}`, `Ingreso correcto como ${role}`);
  await p.context().close();
}

// --- SOCIAL (sin configurar en el servidor local) ---
p = await newPage();
await goLogin(p);
await p.getByRole('button', { name: 'Iniciar sesión con Google' }).click();
await shot(p, '07_login_social_sin_configurar', 'Botón de Google sin credenciales OAuth en el servidor');
await p.context().close();

// --- REGISTRO ---
p = await newPage();
await goLogin(p);
await p.getByText('Registrate', { exact: true }).click();
await field(p, 'Nombre').waitFor();
await shot(p, '08_registro_pantalla', 'Pantalla de registro vacía');
await btn(p, 'Crear cuenta').click();
await shot(p, '09_registro_campos_vacios', 'Validación de campos vacíos');
await field(p, 'Nombre').fill('A');
await field(p, 'Email').fill('lucia.gomez@');
await field(p, 'Contraseña').fill('abcdefgh');
await field(p, 'Repetir contraseña').fill('abcdefgh1');
await btn(p, 'Crear cuenta').click();
await shot(p, '10_registro_errores', 'Nombre corto, email inválido, contraseña sin números y confirmación distinta');
await field(p, 'Nombre').fill('12345');
await field(p, 'Email').fill('lucia@mail.c');
await field(p, 'Contraseña').fill('a1'.repeat(37));
await field(p, 'Repetir contraseña').fill('a1'.repeat(37));
await btn(p, 'Crear cuenta').click();
await shot(p, '10b_registro_limites', 'Nombre sin letras, extensión de una letra y contraseña de 74 caracteres');
await field(p, 'Nombre').fill('Lucía Gómez');
await field(p, 'Email').fill('atleta@macroentreno.com');
await field(p, 'Contraseña').fill('Lucia2026');
await field(p, 'Repetir contraseña').fill('Lucia2026');
await btn(p, 'Crear cuenta').click();
await p.getByText('Ya existe una cuenta con ese email').waitFor();
await shot(p, '11_registro_email_duplicado', 'Email ya registrado: respuesta 409 del servidor');
await field(p, 'Email').fill('lucia.gomez@mail.com');
await shot(p, '12_registro_formulario_completo', 'Formulario de registro completo y válido');
await btn(p, 'Crear cuenta').click();
await p.waitForURL((u) => !u.pathname.startsWith('/register'), { timeout: 30000 });
await shot(p, '13_registro_ok', 'Cuenta creada: ingresa directo con rol Atleta');

// Perfil y cierre de sesión
await p.getByRole('tab', { name: /Perfil/ }).first().click().catch(async () => p.getByText('Perfil', { exact: true }).last().click());
await p.getByText('Cerrar sesión').first().waitFor();
await shot(p, '14_perfil_usuario_nuevo', 'Perfil de la cuenta recién creada');
await p.getByText('Cerrar sesión').first().click();
await field(p, 'Email').waitFor({ timeout: 30000 });
await shot(p, '15_logout', 'Sesión cerrada: vuelve al inicio de sesión');

// Login con la cuenta recién registrada
await doLogin(p, 'lucia.gomez@mail.com', 'Lucia2026');
await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
await shot(p, '16_login_usuario_nuevo', 'Ingreso con la cuenta registrada');

// Sesión persistente: recargar la página mantiene la sesión
await p.reload();
await p.waitForTimeout(2500);
await shot(p, '17_sesion_persistente', 'Al recargar, la sesión se restaura sola');
await p.context().close();

// Asistente con IA sin clave de OpenAI: atleta y administrador
for (const [who, email] of [['atleta', 'atleta@macroentreno.com'], ['admin', 'admin@macroentreno.com']]) {
  p = await newPage();
  await goLogin(p);
  await doLogin(p, email, 'Demo1234');
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  await p.waitForTimeout(1500);
  await p.goto(`${URL}/assistant`, { waitUntil: 'commit' });
  await p.waitForTimeout(4000);
  await shot(p, `19_asistente_sin_clave_${who}`, `Asistente sin OPENAI_API_KEY (${who})`);
  await p.context().close();
}

// Tema claro
p = await newPage('light');
await goLogin(p);
await shot(p, '18_login_tema_claro', 'Inicio de sesión con tema claro del sistema');
await p.context().close();

await browser.close();
fs.writeFileSync(`${OUT}/capturas.json`, JSON.stringify(log, null, 2));
