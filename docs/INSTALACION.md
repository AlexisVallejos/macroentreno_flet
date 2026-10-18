# Guía de instalación y configuración

## Índice

1. [Requisitos](#1-requisitos)
2. [Clonar el repositorio](#2-clonar-el-repositorio)
3. [Backend (API + MySQL)](#3-backend-api--mysql)
4. [App móvil (React Native + Expo)](#4-app-móvil-react-native--expo)
5. [Inicio de sesión con Google, Facebook y GitHub](#5-inicio-de-sesión-con-google-facebook-y-github)
6. [Generar el APK](#6-generar-el-apk)
7. [Variables de entorno (referencia)](#7-variables-de-entorno-referencia)
8. [Problemas frecuentes](#8-problemas-frecuentes)

---

## 1. Requisitos

| Herramienta | Versión | Para qué |
|---|---|---|
| Node.js | 20 o superior (probado con 24) | Backend y herramientas de Expo |
| MySQL Server | 8.0 o superior | Base de datos (opcional para probar: ver `npm run dev:memory`) |
| Git | cualquiera | Clonar el repositorio |
| Celular Android/iPhone con **Expo Go** (SDK 58), o un emulador | — | Probar la app en desarrollo |
| Cuenta gratuita en [expo.dev](https://expo.dev) | — | Generar el APK con EAS Build |

> La PC y el celular tienen que estar en la **misma red Wi-Fi** para que el celular llegue a la API.

## 2. Clonar el repositorio

```bash
git clone https://github.com/AlexisVallejos/macroentreno_flet.git
cd macroentreno_flet
```

## 3. Backend (API + MySQL)

### 3.1 Instalar dependencias

```bash
cd backend
npm install
```

### 3.2 Configurar variables de entorno

```bash
cp .env.example .env      # en Windows: copy .env.example .env
```

Editá `.env` con los datos de tu MySQL y dos secretos JWT distintos:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # correr 2 veces
```

```ini
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_clave_de_mysql
DB_NAME=macroentreno
JWT_ACCESS_SECRET=<primer valor generado>
JWT_REFRESH_SECRET=<segundo valor generado>
```

### 3.3 Crear la base de datos

```bash
npm run db:init
```

Crea la base `macroentreno`, aplica `database/schema.sql` (tablas, claves e índices) y carga los datos demo:

| Rol | Email | Contraseña |
|---|---|---|
| Administrador | `admin@macroentreno.com` | `Demo1234` |
| Entrenador | `coach@macroentreno.com` | `Demo1234` |
| Atleta (con entrenador) | `atleta@macroentreno.com` | `Demo1234` |
| Atleta (sin entrenador) | `martina@macroentreno.com` | `Demo1234` |

También carga 145 alimentos (muchos de marcas argentinas), 21 ejercicios y una semana de
historial para el atleta demo.

> ⚠️ `db:init` **borra y recrea** todas las tablas. Usalo solo para instalar o reiniciar.

### 3.4 Levantar la API

```bash
npm run dev        # desarrollo, se reinicia al guardar
# o
npm start          # producción
```

Verificá en el navegador: <http://localhost:3000/api/health> → `{"data":{"status":"ok","database":"ok",…}}`

### 3.5 Alternativa sin instalar MySQL

```bash
npm run dev:memory
```

Descarga un MySQL 8.4 temporal (solo la primera vez, unos minutos), crea la base con los datos
demo y levanta la API en el puerto 3000. **Los datos se pierden al cerrarla.** Sirve para
corregir o probar rápido.

### 3.6 Pruebas automáticas

```bash
npm test
```

Corre 41 pruebas de integración contra un MySQL temporal (no toca tu base).

## 4. App móvil (React Native + Expo)

### 4.1 Instalar dependencias

```bash
cd mobile
npm install
```

### 4.2 Apuntar la app a la API

Desde el celular, `localhost` es el propio celular. Hay que usar la **IP de la PC** en la red local:

- Windows: `ipconfig` → "Dirección IPv4" (ej. `192.168.0.10`)
- macOS: `ipconfig getifaddr en0`
- Linux: `hostname -I`

```bash
cp .env.example .env
```

```ini
EXPO_PUBLIC_API_URL=http://192.168.0.10:3000/api
```

> Cada vez que cambies `.env`, reiniciá Expo con `npx expo start --clear`.

### 4.3 Ejecutar

```bash
npx expo start
```

- **Celular:** abrí Expo Go y escaneá el QR (en iPhone, con la cámara).
- **Emulador Android:** tecla `a` (requiere Android Studio).
- **Navegador:** tecla `w` (para una vista rápida; la app está pensada para celular).

Para confirmar la conexión, abrí `http://<IP>:3000/api/health` en el navegador **del celular**.

### 4.4 Calidad de código

```bash
npx expo lint        # ESLint (configuración oficial de Expo)
npx expo-doctor      # chequea versiones y configuración
```

## 5. Inicio de sesión con Google, Facebook y GitHub

El login social se hace **en el servidor** (flujo OAuth "authorization code" + PKCE): la app
abre el navegador, el backend habla con el proveedor y devuelve a la app un código de un solo
uso. Así los secretos nunca están dentro del APK. Los detalles están en la
[documentación de la API](../backend/README.md#53-login-social-oauth).

Mientras un proveedor no esté configurado, su botón aparece atenuado y avisa que falta configurarlo.

### 5.1 Exponer la API con HTTPS (Google y Facebook lo exigen)

Google y Facebook no aceptan redirecciones a `http://192.168…`. En desarrollo usá un túnel:

```bash
npx ngrok http 3000          # o: cloudflared tunnel --url http://localhost:3000
```

Con la URL que te dé (ej. `https://abcd-1234.ngrok-free.app`):

```ini
# backend/.env
PUBLIC_API_URL=https://abcd-1234.ngrok-free.app

# mobile/.env  (la app también entra por el túnel)
EXPO_PUBLIC_API_URL=https://abcd-1234.ngrok-free.app/api
```

La URL de callback que hay que registrar en cada proveedor es:

```
<PUBLIC_API_URL>/api/auth/oauth/<proveedor>/callback
```

### 5.2 Google

1. Entrá a [Google Cloud Console](https://console.cloud.google.com/) → creá un proyecto.
2. **APIs y servicios → Pantalla de consentimiento de OAuth**: tipo "Externo", completá nombre y email, y agregá tu cuenta como usuario de prueba.
3. **Credenciales → Crear credenciales → ID de cliente de OAuth** → tipo **Aplicación web**.
4. En **URI de redireccionamiento autorizados** agregá `https://<tu-túnel>/api/auth/oauth/google/callback`.
5. Copiá los valores a `backend/.env`: `GOOGLE_CLIENT_ID=…` y `GOOGLE_CLIENT_SECRET=…`.

### 5.3 Facebook

1. Entrá a [Meta for Developers](https://developers.facebook.com/apps) → **Crear app** → caso de uso "Autenticar y solicitar datos a los usuarios con el inicio de sesión con Facebook".
2. En **Inicio de sesión con Facebook → Configuración**, agregá en **URI de redireccionamiento de OAuth válidos**: `https://<tu-túnel>/api/auth/oauth/facebook/callback`.
3. Activá el permiso `email` (en "Permisos y funciones").
4. En **Configuración de la app → Básica** copiá: `FACEBOOK_APP_ID=…` y `FACEBOOK_APP_SECRET=…`.
5. Mientras la app esté en modo desarrollo, solo pueden entrar las cuentas agregadas en **Roles → Evaluadores**.

### 5.4 GitHub

1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. **Homepage URL:** la URL de tu API. **Authorization callback URL:** `<PUBLIC_API_URL>/api/auth/oauth/github/callback` (GitHub acepta `http://` de la red local).
3. Copiá `GITHUB_CLIENT_ID=…` y generá un secret: `GITHUB_CLIENT_SECRET=…`.

Reiniciá la API después de editar `.env`. Podés verificar qué quedó activo en
`GET /api/auth/oauth/providers`.

## 6. Generar el APK

### 6.1 Con EAS Build (recomendado, no necesita Android Studio)

1. Configurá la URL de la API que va a quedar **dentro** del APK en `mobile/eas.json`, perfil
   `preview` → `env.EXPO_PUBLIC_API_URL`. EAS **no** lee el archivo `.env`.
   Usá una IP fija de la red local, la URL del túnel o la de un servidor publicado.
2. Iniciá sesión y generá el APK:

   ```bash
   cd mobile
   npx eas-cli@latest login
   npx eas-cli@latest build -p android --profile preview
   ```

   La primera vez pregunta si querés crear el proyecto en EAS y generar el keystore: respondé que sí.
3. Al terminar (10–20 minutos en la cola gratuita), EAS muestra un link y un QR para **descargar el `.apk`**.
4. En el celular: abrí el link, descargá el archivo y permití "instalar apps de orígenes desconocidos".

El APK permite tráfico HTTP (`usesCleartextTraffic` en `app.json`), así funciona contra una API
de la red local sin HTTPS.

### 6.2 Local (requiere Android Studio y JDK 17)

```bash
cd mobile
npx expo prebuild -p android
cd android
./gradlew assembleRelease          # Windows: gradlew.bat assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

En este caso, `EXPO_PUBLIC_API_URL` se toma del `.env` en el momento del build.

## 7. Variables de entorno (referencia)

### `backend/.env`

| Variable | Obligatoria | Ejemplo | Descripción |
|---|---|---|---|
| `PORT` | no | `3000` | Puerto de la API |
| `NODE_ENV` | no | `development` | En `production` exige los secretos JWT |
| `CORS_ORIGIN` | no | `*` | Orígenes permitidos (separados por coma) |
| `DB_HOST` / `DB_PORT` | sí | `localhost` / `3306` | Servidor MySQL |
| `DB_USER` / `DB_PASSWORD` | sí | `root` / `…` | Credenciales MySQL |
| `DB_NAME` | sí | `macroentreno` | Nombre de la base |
| `JWT_ACCESS_SECRET` | sí | 96 caracteres hex | Firma de los tokens de acceso |
| `JWT_REFRESH_SECRET` | sí | otro distinto | Firma de los tokens de renovación |
| `JWT_ACCESS_EXPIRES_IN` | no | `15m` | Vida del token de acceso |
| `JWT_REFRESH_EXPIRES_DAYS` | no | `30` | Vida del token de renovación |
| `PUBLIC_API_URL` | para login social | `https://…ngrok-free.app` | URL pública para armar los callbacks |
| `APP_REDIRECT_SCHEMES` | no | `macroentreno,exp,exps` | Esquemas de la app permitidos tras el login social |
| `GOOGLE_CLIENT_ID` / `_SECRET` | para Google | — | Credenciales OAuth web |
| `FACEBOOK_APP_ID` / `_SECRET` | para Facebook | — | Credenciales de la app de Meta |
| `GITHUB_CLIENT_ID` / `_SECRET` | para GitHub | — | Credenciales de la OAuth App |

### `mobile/.env`

| Variable | Ejemplo | Descripción |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `http://192.168.0.10:3000/api` | URL base de la API (con `/api`) |

## 8. Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| "No se pudo conectar con el servidor" | La app no llega a la API | Revisá `EXPO_PUBLIC_API_URL` (IP, no `localhost`), que la API esté corriendo, la misma Wi-Fi y el firewall (puerto 3000). Reiniciá con `npx expo start --clear` |
| `/health` responde `503 DB_UNAVAILABLE` | MySQL apagado o credenciales mal | Revisá `DB_*` en `backend/.env` y que el servicio MySQL esté activo |
| `ER_NOT_SUPPORTED_AUTH_MODE` | Usuario MySQL viejo | `ALTER USER 'root'@'localhost' IDENTIFIED WITH caching_sha2_password BY 'clave';` |
| Botón de Google/Facebook atenuado | Falta configurar el proveedor | Ver sección 5 y reiniciar la API |
| Google: `redirect_uri_mismatch` | El callback no coincide | La URI registrada debe ser exactamente `<PUBLIC_API_URL>/api/auth/oauth/google/callback` |
| Después de loguearse con una red, el navegador no vuelve a la app | Esquema no permitido | `APP_REDIRECT_SCHEMES` debe incluir `macroentreno` (APK) y `exp` (Expo Go) |
| `npm install` en `mobile` falla con `ERESOLVE` | Conflicto de dependencias web de expo-router | Ya está resuelto con `mobile/.npmrc`: no lo borres |
| Expo Go dice "incompatible SDK" | Expo Go desactualizado | Actualizá Expo Go: el proyecto usa SDK 58 |
| "Tu sesión expiró" | Se revocó el refresh token (cambio de contraseña, baja o reutilización) | Volver a iniciar sesión |
