// Contenido del manual de instalación. Las salidas de terminal son reales (docs/manual-instalacion/salidas).
import fs from 'node:fs';

const out = (file) => fs.readFileSync(new URL(`../manual-instalacion/salidas/${file}.txt`, import.meta.url), 'utf8').trimEnd().split('\n');

export const meta = {
  institution: 'E.E.S.T. N° 5',
  title: 'Manual de instalación de MacroEntreno',
  subtitle: 'Instalación, configuración y publicación de la app y la API',
  student: 'Alexis Vallejos',
  subject: 'Proyecto, Diseño e Implementación de Sistemas Computacionales',
  teacher: 'Martín A. Estanga Schulze',
  course: '7° 4° GB',
  date: '30 de octubre de 2026',
  sigla: 'MacroEntreno',
  fileName: 'Manual_de_Instalacion_MacroEntreno',
};

const term = (n, title, file, widthCm = 14) => ({ t: 'fig', n, title, terminal: out(file), termWidth: 700, widthCm });
const pair = 11.5;

export const blocks = [
  { t: 'cover' },

  { t: 'title', text: 'Resumen' },
  {
    t: 'p',
    text: 'Este manual explica cómo instalar y poner en marcha MacroEntreno en una computadora y cómo publicarla en internet. Se detallan los programas necesarios, cómo descargar el código, cómo configurar y levantar la API con su base de datos MySQL, cómo ejecutar la app de React Native y cómo comprobar que todo funciona con las pruebas automáticas. También se muestra la publicación en Vercel con una base MySQL externa. Cada paso se ejecutó sobre una copia nueva del repositorio y las figuras muestran las salidas reales de la terminal.',
  },
  { t: 'kw', text: 'instalación, Node.js, MySQL, variables de entorno, Expo, Vercel.' },
  { t: 'pb' },

  { t: 'title', text: 'Índice' },
  { t: 'toc' },
  { t: 'pb' },

  { t: 'h1', text: 'Introducción' },
  {
    t: 'p',
    text: 'MacroEntreno tiene dos partes que se instalan por separado. La **API** está hecha en Node.js con Express y guarda los datos en MySQL; se encarga del inicio de sesión, los permisos de cada rol y todos los datos. La **app** está hecha en React Native con Expo y funciona en Android, iPhone y en el navegador; muestra las pantallas y le pide los datos a la API.',
  },
  {
    t: 'p',
    text: 'Para comprobar que las instrucciones están completas, se siguieron desde cero sobre una copia recién descargada de GitHub, sin reutilizar nada de la carpeta de trabajo. Todo lo que aparece en las figuras es la salida obtenida en esa instalación.',
  },

  { t: 'h1', text: 'Desarrollo', pageBreak: true },
  { t: 'h2', text: 'Requisitos' },
  {
    t: 'table',
    n: 1,
    title: 'Programas necesarios',
    cols: [4, 3.2, 8.8],
    head: ['Programa', 'Versión', 'Para qué se usa'],
    rows: [
      ['Node.js y npm', '20 o superior', 'Ejecutar la API y las herramientas de Expo'],
      ['Git', 'Cualquiera reciente', 'Descargar el código del repositorio'],
      ['MySQL', '8.0 o superior', 'Base de datos (opcional en desarrollo: hay un modo con MySQL temporal)'],
      ['Navegador o Expo Go', 'Expo Go para SDK 58', 'Abrir la app en la computadora o en el celular'],
    ],
  },
  {
    t: 'p',
    text: 'Para ver qué versiones hay instaladas se usan los comandos de la Figura 1. En la instalación de prueba había Node.js 24, npm 11 y Git 2.39.',
  },
  term(1, 'Versiones de Node.js, npm y Git', 't01_versiones', 9),

  { t: 'h2', text: 'Descargar el código' },
  {
    t: 'p',
    text: 'El código está en GitHub. Se clona con `git clone` y se entra a la carpeta (Figura 2). Adentro están `backend/` (la API), `mobile/` (la app), `api/` (la entrada de la API para Vercel), `docs/` (manuales y guías) y `vercel.json`.',
  },
  term(2, 'Clonado del repositorio', 't02_clone'),

  { t: 'h2', text: 'Instalar y configurar la API' },
  { t: 'h3', text: 'Dependencias' },
  { t: 'p', text: 'Dentro de `backend/` se instalan las dependencias con `npm ci`, que respeta las versiones exactas de `package-lock.json` (Figura 3).' },
  term(3, 'Instalación de las dependencias de la API', 't03_backend_ci', 9),

  { t: 'h3', text: 'Variables de entorno' },
  {
    t: 'p',
    text: 'La configuración se guarda en el archivo `backend/.env`, que no se sube a Git porque tiene contraseñas. Se crea copiando el ejemplo con `cp .env.example .env` y se completan los datos (Figura 4). Las más importantes están en la Tabla 2.',
  },
  term(4, 'Creación de backend/.env a partir del ejemplo', 't04_env', 12),
  {
    t: 'table',
    n: 2,
    title: 'Variables de entorno principales de la API',
    cols: [5, 4, 7],
    head: ['Variable', 'Ejemplo', 'Descripción'],
    rows: [
      ['`PORT`', '`3000`', 'Puerto donde escucha la API'],
      ['`DB_HOST`, `DB_PORT`', '`localhost`, `3306`', 'Servidor MySQL'],
      ['`DB_USER`, `DB_PASSWORD`', '`root`, …', 'Usuario y contraseña de MySQL'],
      ['`DB_NAME`', '`macroentreno`', 'Nombre de la base'],
      ['`DB_SSL`', '`false`', '`true` si el servidor MySQL exige conexión cifrada'],
      ['`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`', '96 caracteres', 'Secretos que firman los tokens; se generan con `openssl rand -hex 48`'],
      ['`PUBLIC_API_URL`', '`https://…`', 'Dirección pública de la API, para el login con redes sociales'],
      ['`GOOGLE_CLIENT_ID`, `GITHUB_CLIENT_ID`, …', '—', 'Credenciales de cada red social'],
      ['`OPENAI_API_KEY`', '`sk-…`', 'Opcional: activa el asistente con IA'],
    ],
    note: 'La lista completa, con todas las variables y su explicación, está en `backend/.env.example` y en `docs/INSTALACION.md`.',
  },

  { t: 'h3', text: 'Base de datos' },
  {
    t: 'p',
    text: 'Con MySQL instalado, `npm run db:init` crea la base, aplica las tablas de `database/schema.sql` y carga los datos de ejemplo: un usuario por rol, el catálogo de alimentos y ejercicios y una semana de historial. Los usuarios de ejemplo son `admin@macroentreno.com`, `coach@macroentreno.com`, `atleta@macroentreno.com` y `martina@macroentreno.com`, todos con la contraseña `Demo1234`. Este comando vacía las tablas, así que cuando la base no está en la misma computadora exige agregar `--yes` para confirmar.',
  },

  { t: 'h3', text: 'Levantar la API' },
  {
    t: 'p',
    text: 'Con la base lista se ejecuta `npm run dev`. Para probar sin instalar MySQL existe `npm run dev:memory`, que descarga un MySQL temporal, carga los datos de ejemplo y levanta la API en un solo paso; los datos se pierden al cerrarla. Es el modo que se usó en la instalación de prueba (Figura 5). Al arrancar, la API avisa si el asistente con IA está activo.',
  },
  term(5, 'API levantada con un MySQL temporal', 't05_api', 15),
  {
    t: 'p',
    text: 'Para comprobar que la API funciona y llega a la base se consulta `/api/health` (Figura 6). La respuesta `"database":"ok"` confirma las dos cosas.',
  },
  term(6, 'Comprobación del estado de la API', 't06_health', 14),

  { t: 'h3', text: 'Pruebas automáticas de la API' },
  {
    t: 'p',
    text: 'Con `npm test` se ejecutan las pruebas del servidor. Cada archivo crea su propia base temporal, así que no hace falta tener MySQL instalado. En la instalación de prueba pasaron los 184 casos, en 25 grupos (Figura 7).',
  },
  term(7, 'Resultado de las pruebas de la API', 't07_backend_tests', 13),

  { t: 'h2', text: 'Instalar y ejecutar la app' },
  { t: 'h3', text: 'Dependencias y dirección de la API' },
  {
    t: 'p',
    text: 'Dentro de `mobile/` se instalan las dependencias con `npm ci` (Figura 8). Después hay que indicarle a la app dónde está la API, en el archivo `mobile/.env`, con la variable `EXPO_PUBLIC_API_URL`. En el navegador de la misma computadora alcanza con `http://localhost:3000/api`. En un celular hay que usar la IP de la computadora en la red Wi-Fi, por ejemplo `http://192.168.0.10:3000/api`, porque para el teléfono "localhost" es él mismo. Si existe `mobile/.env.local`, tiene prioridad sobre `.env` y su puerto tiene que coincidir con el de la API.',
  },
  term(8, 'Instalación de las dependencias de la app', 't08_mobile_ci', 8),

  { t: 'h3', text: 'Ejecutar' },
  {
    t: 'p',
    text: 'La app se inicia con `npx expo start`. Con `--web` se abre en el navegador (Figura 9); sin esa opción muestra un código QR que se escanea con Expo Go para abrirla en el celular, o se puede presionar `a` para un emulador de Android.',
  },
  term(9, 'Inicio de la app con Expo', 't09_expo', 15),
  {
    t: 'p',
    text: 'En la Figura 10 se ve la app funcionando en la instalación de prueba: la pantalla de inicio de sesión y, después de ingresar con la cuenta de ejemplo del Atleta, su resumen del día con los datos que devolvió la API.',
  },
  {
    t: 'fig',
    n: 10,
    title: 'App funcionando contra la API local',
    shots: [
      ['local_login', 'Inicio de sesión'],
      ['local_inicio', 'Inicio del Atleta'],
    ],
    widthCm: pair,
  },

  { t: 'h3', text: 'Pruebas y revisión del código de la app' },
  {
    t: 'p',
    text: 'La app tiene sus propias pruebas de las validaciones de los formularios (`npm test`) y un revisor de código (`npx expo lint`). Las 53 pruebas pasaron y el revisor no informó errores ni advertencias (Figura 11).',
  },
  term(11, 'Pruebas y revisión del código de la app', 't10_mobile_tests', 9),

  { t: 'h2', text: 'Inicio de sesión con redes sociales' },
  {
    t: 'p',
    text: 'El ingreso con Google, Facebook y GitHub lo resuelve la API con OAuth 2.0. Para cada red se crea una aplicación en su consola de desarrolladores, se registra como dirección de retorno `<PUBLIC_API_URL>/api/auth/oauth/<red>/callback` y se copian el identificador y el secreto en `backend/.env` (Tabla 3). Google y Facebook exigen HTTPS, por eso en desarrollo hace falta un túnel como ngrok o la versión publicada en Vercel. Mientras una red no está configurada, la app muestra su botón atenuado y avisa que todavía no está disponible.',
  },
  {
    t: 'table',
    n: 3,
    title: 'Configuración de cada red social',
    cols: [2.6, 5.4, 8],
    head: ['Red', 'Dónde se crea', 'Variables'],
    rows: [
      ['Google', 'console.cloud.google.com → Google Auth Platform → Clientes', '`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`'],
      ['Facebook', 'developers.facebook.com → Mis apps', '`FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`'],
      ['GitHub', 'github.com → Settings → Developer settings → OAuth Apps', '`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`'],
    ],
  },

  { t: 'h2', text: 'Generar el APK' },
  {
    t: 'p',
    text: 'Para instalar la app en un Android sin Expo Go se genera un APK con EAS Build, el servicio de compilación de Expo. Primero se escribe en `mobile/eas.json`, perfil `preview`, la dirección de la API que va a quedar dentro del APK. Después se ejecuta `npx eas-cli@latest build -p android --profile preview`. Al terminar, EAS muestra un link para descargar el archivo `.apk` e instalarlo en el teléfono.',
  },

  { t: 'h2', text: 'Publicar en Vercel' },
  {
    t: 'p',
    text: 'La versión web y la API se publican juntas en Vercel, en **https://macroentreno.vercel.app**. El archivo `vercel.json` indica cómo armar el proyecto: instala la API y la app, exporta la app para web con la API en `/api` y envía todos los pedidos a `/api` a la función de `api/index.mjs`, que usa la misma API de Express. Vercel no aloja MySQL, por eso la base está en un servidor propio administrado con EasyPanel, con el puerto expuesto a internet.',
  },
  {
    t: 'table',
    n: 4,
    title: 'Pasos para publicar en Vercel',
    cols: [1, 7, 8],
    head: ['#', 'Paso', 'Comando'],
    rows: [
      ['1', 'Cargar las tablas y los datos en la base remota', '`DB_HOST=… DB_PORT=… npm run db:init -- --yes`'],
      ['2', 'Iniciar sesión en Vercel y vincular el proyecto', '`npx vercel login` · `npx vercel link --project macroentreno`'],
      ['3', 'Cargar las variables de entorno: secretos JWT, datos de la base, `DB_CONNECTION_LIMIT=3` y `CRON_SECRET`', '`printf %s "valor" | npx vercel env add NOMBRE production`'],
      ['4', 'Publicar', '`npx vercel deploy --prod`'],
      ['5', 'Comprobar la API y la base', '`curl https://macroentreno.vercel.app/api/health`'],
    ],
  },
  {
    t: 'p',
    text: 'En la Figura 12 se ve la comprobación de la versión publicada: `/api/health` responde que la base está disponible y el inicio de sesión con la cuenta de ejemplo devuelve los datos del usuario. La Figura 13 muestra la app abierta desde la dirección de Vercel con esa cuenta.',
  },
  term(12, 'Comprobación de la versión publicada en Vercel', 't11_vercel', 15),
  {
    t: 'fig',
    n: 13,
    title: 'App publicada en macroentreno.vercel.app',
    shots: [
      ['vercel_login', 'Inicio de sesión'],
      ['vercel_inicio', 'Inicio del Atleta'],
    ],
    widthCm: pair,
  },
  {
    t: 'p',
    text: 'En Vercel no hay un servidor encendido todo el tiempo, por eso las tareas que la API hace periódicamente (generar los informes semanales y borrar sesiones vencidas) las dispara un cron de Vercel una vez por día, en `/api/cron/diario`.',
  },

  { t: 'h2', text: 'Problemas frecuentes' },
  {
    t: 'table',
    n: 5,
    title: 'Problemas frecuentes y cómo resolverlos',
    cols: [5, 5, 6],
    head: ['Síntoma', 'Causa probable', 'Solución'],
    rows: [
      ['"No se pudo conectar con el servidor"', 'La app no llega a la API', 'Revisar `EXPO_PUBLIC_API_URL` (IP y puerto), que la API esté corriendo y que el celular esté en la misma Wi-Fi'],
      ['`/api/health` responde 503', 'La API no llega a MySQL', 'Revisar `DB_HOST`, `DB_PORT`, usuario y contraseña, y que el puerto de MySQL esté expuesto'],
      ['La app usa otro puerto', '`mobile/.env.local` pisa a `.env`', 'Igualar el puerto de `.env.local` con el `PORT` de la API'],
      ['`db:init` pide `--yes`', 'La base no es local', 'Confirmar agregando `--yes` si de verdad se quiere vaciar y recargar'],
      ['Botón de Google atenuado', 'La red no está configurada', 'Cargar sus credenciales (Tabla 3) y reiniciar la API'],
      ['Google: `redirect_uri_mismatch`', 'La dirección de retorno no coincide', 'Registrar exactamente `<PUBLIC_API_URL>/api/auth/oauth/google/callback`'],
      ['Expo Go: "incompatible SDK"', 'Expo Go desactualizado', 'Actualizar Expo Go: el proyecto usa SDK 58'],
      ['"Tu sesión expiró"', 'Se cerraron las sesiones (cambio de contraseña o baja)', 'Volver a iniciar sesión'],
    ],
  },

  { t: 'h1', text: 'Conclusión', pageBreak: true },
  {
    t: 'p',
    text: 'Siguiendo estos pasos sobre una copia nueva del repositorio, MacroEntreno quedó funcionando en una computadora: la API levantó con su base de datos, respondió a la comprobación de estado y pasó sus 184 pruebas, y la app abrió en el navegador e inició sesión con la cuenta de ejemplo. La misma configuración permitió publicarla en Vercel con una base MySQL externa, donde también se comprobó que la API llega a la base y que se puede ingresar.',
  },
  {
    t: 'p',
    text: 'La instalación mostró la importancia de las variables de entorno: la mayoría de los problemas que pueden aparecer, como una app que no encuentra la API o una API que no llega a la base, se resuelven revisando una dirección, un puerto o una contraseña. Mantener esos datos fuera del código, en archivos `.env` que no se suben a Git, permite usar el mismo proyecto en la computadora, en el celular y en internet sin cambiar una sola línea.',
  },
];
