# MacroEntreno API · Documentación

API REST de MacroEntreno (Node.js + Express 5 + MySQL 8). Maneja autenticación con JWT
(token de acceso + token de renovación), login social (Google, Facebook, GitHub), roles y
el CRUD de alimentos, diario de comidas, ejercicios y entrenamientos.

> Instalación y configuración: [docs/INSTALACION.md](../docs/INSTALACION.md) ·
> Modelo de datos e índices: [docs/BASE_DE_DATOS.md](../docs/BASE_DE_DATOS.md)

## Índice

1. [Convenciones](#1-convenciones)
2. [Autenticación y tokens](#2-autenticación-y-tokens)
3. [Roles y permisos](#3-roles-y-permisos)
4. [Errores](#4-errores)
5. [Endpoints](#5-endpoints)
   - [Salud](#51-salud) · [Auth](#52-auth) · [Login social](#53-login-social-oauth) ·
     [Usuarios](#54-usuarios) · [Alimentos](#55-alimentos) · [Diario](#56-diario) ·
     [Ejercicios](#57-ejercicios) · [Entrenamientos](#58-entrenamientos) ·
     [Progreso](#59-progreso) · [Admin](#510-admin)
6. [Scripts y pruebas](#6-scripts-y-pruebas)
7. [Estructura del código](#7-estructura-del-código)

---

## 1. Convenciones

| Tema | Regla |
|---|---|
| URL base | `http://<host>:3000/api` |
| Formato | JSON (`Content-Type: application/json`), UTF-8 |
| Tamaño del body | Hasta 100 kB (más → `413 PAYLOAD_TOO_LARGE`). Solo `/ai/*` acepta hasta 12 MB (fotos y audio) |
| Campos desconocidos | Se descartan: un `role` o `isActive` de más en el body nunca llega al servicio |
| Respuesta exitosa | `{ "data": ... }`. Los listados paginados agregan `meta`. |
| Paginación | `?page=1&limit=20` (máx. 100) → `meta: { page, limit, total, totalPages }` |
| Fechas | `AAAA-MM-DD` (fecha local del usuario) |
| Nombres | camelCase en JSON, snake_case en MySQL |
| Sin contenido | `DELETE` y `logout` responden `204 No Content` |

## 2. Autenticación y tokens

Los endpoints protegidos (🔒) requieren el header:

```
Authorization: Bearer <accessToken>
```

| Token | Tipo | Duración | Dónde vive |
|---|---|---|---|
| `accessToken` | JWT HS256 (`sub`, `role`, `type: "access"`) | 15 min (`JWT_ACCESS_EXPIRES_IN`) | Memoria de la app |
| `refreshToken` | JWT HS256 (`sub`, `jti`, `type: "refresh"`) | 30 días (`JWT_REFRESH_EXPIRES_DAYS`) | SecureStore del celular; en la base solo se guarda su hash SHA-256 |

**Rotación:** cada `POST /auth/refresh` revoca el refresh token usado y entrega un par nuevo.
Si alguien reutiliza un refresh token ya revocado (posible robo), la API revoca **todas** las
sesiones de ese usuario y responde `401 REFRESH_REUSED`.

Los dos tokens se verifican **solo con HS256**: un token firmado con otro algoritmo (por ejemplo
`none`) se rechaza con `401 TOKEN_INVALID` (o `REFRESH_INVALID`).

La app renueva el token automáticamente cuando recibe un `401` y reintenta la petición una vez.

## 3. Roles y permisos

| Recurso | `athlete` (Atleta) | `coach` (Entrenador) | `admin` (Administrador) |
|---|---|---|---|
| Perfil propio y objetivos | ✅ | ✅ | ✅ |
| Diario propio (CRUD) | ✅ | ✅ | ✅ (puede corregir cualquiera) |
| Diario de otro usuario | ❌ | 👁️ solo sus atletas (lectura) | 👁️ |
| Alimentos personales (CRUD) | ✅ | ✅ | ✅ |
| Catálogo global de alimentos | 👁️ lectura | ✅ CRUD | ✅ CRUD |
| Catálogo de ejercicios | 👁️ lectura | ✅ CRUD | ✅ CRUD |
| Entrenamientos propios (CRUD) | ✅ | ✅ | ✅ |
| Entrenamientos de atletas | ❌ | ✅ solo sus atletas (asignar rutinas) | ✅ |
| Progreso de otros | ❌ | 👁️ solo sus atletas | 👁️ |
| Objetivos de otros | ❌ | ✅ solo sus atletas | ✅ |
| Listar usuarios | ❌ | solo sus atletas | ✅ todos |
| Crear / editar / borrar usuarios, cambiar roles | ❌ | ❌ | ✅ |
| Estadísticas del sistema | ❌ | ❌ | ✅ |

Implementación: `authenticate` valida el JWT y vuelve a leer el usuario (un cambio de rol o una
baja aplican al instante); `authorize(...roles)` corta por rol; `resolveTargetUser` decide si
se puede actuar sobre otro usuario (`src/utils/access.js`).

El registro público siempre crea usuarios `athlete`. Los demás roles los asigna un admin.

## 4. Errores

Todas las respuestas de error tienen la misma forma:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Hay datos inválidos en la solicitud",
    "details": [{ "field": "email", "message": "Email inválido" }]
  }
}
```

| HTTP | `code` | Cuándo |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Body, query o params no cumplen el esquema (`details` indica el campo) |
| 400 | `INVALID_JSON` | El body no es JSON válido |
| 400 | `BAD_REQUEST` / `INVALID_PASSWORD` | Regla de negocio (ej. un admin no puede quitarse su rol) |
| 401 | `UNAUTHORIZED` | Falta el header `Authorization` |
| 401 | `TOKEN_EXPIRED` | El access token venció → llamar a `/auth/refresh` |
| 401 | `TOKEN_INVALID` | Token mal formado, firmado con otra clave o con un algoritmo distinto de HS256, o usuario inexistente |
| 401 | `INVALID_CREDENTIALS` | Email o contraseña incorrectos |
| 401 | `SOCIAL_ACCOUNT` | La cuenta solo tiene login social (no tiene contraseña) |
| 401 | `REFRESH_INVALID` / `REFRESH_REUSED` | Refresh token inválido, vencido, revocado o reutilizado |
| 401 | `SOCIAL_LOGIN_FAILED` | Falló el canje del código social o el proveedor rechazó el login |
| 403 | `FORBIDDEN` | El rol no tiene permiso o la cuenta está desactivada |
| 404 | `NOT_FOUND` | El recurso o la ruta no existen (o no son visibles para el usuario) |
| 409 | `CONFLICT` | Registro duplicado (email, nombre de ejercicio) |
| 413 | `PAYLOAD_TOO_LARGE` | El body supera los 100 kB (12 MB en `/ai/*`) |
| 429 | `TOO_MANY_REQUESTS` | Más de 50 solicitudes en 15 minutos desde la misma IP sumando registro, login, login social y cambio de contraseña. En el asistente: más de 60 llamadas en 10 minutos por usuario |
| 501 | `PROVIDER_NOT_CONFIGURED` | El proveedor social no tiene credenciales en `.env` |
| 502 | `PROVIDER_UNAVAILABLE` | No se pudo contactar a Google/Facebook/GitHub |
| 503 | `DB_UNAVAILABLE` | MySQL caído o mal configurado |
| 429 · 502 · 503 · 504 | `AI_*` | Errores del asistente con IA (clave, saldo, modelo, conexión con OpenAI): ver [tabla del asistente](#55-bis-asistente-con-ia-openai) |
| 500 | `INTERNAL_ERROR` | Error inesperado (se registra en consola) |

## 5. Endpoints

### 5.1 Salud

#### `GET /health`
Verifica la API y la conexión a MySQL.
`200` → `{ "data": { "status": "ok", "database": "ok", "time": "2026-10-15T12:00:00.000Z" } }` · `503 DB_UNAVAILABLE`

### 5.2 Auth

#### `POST /auth/register`
Crea una cuenta con rol `athlete` (un `role` enviado en el body se ignora).

| Campo | Tipo | Reglas |
|---|---|---|
| `name` | string | Se recortan los espacios de los extremos. 2–100 caracteres, al menos una letra (de cualquier alfabeto) y sin caracteres de control ni invisibles (saltos de línea, `\0`, espacios de ancho cero) |
| `email` | string | Primero se recorta y se pasa a minúsculas, después se valida el formato. Máximo 190 caracteres. `"  Ana@Mail.COM "` se guarda como `ana@mail.com` |
| `password` | string | 8–72 caracteres **y** como máximo 72 bytes en UTF-8 (las tildes, la ñ y los emojis ocupan más de un byte; bcrypt ignora lo que pasa de 72 bytes). Al menos una letra (`a–z`/`A–Z`) y un número |

Estas mismas reglas se aplican en el alta y la edición de usuarios por un admin
(`POST /users`, `PUT /users/:id`), en `PATCH /users/me` (nombre) y en la nueva contraseña de
`PUT /auth/password`. Cada error vuelve en `details` con el campo y un mensaje en castellano:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Hay datos inválidos en la solicitud",
  "details": [{ "field": "password", "message": "La contraseña debe incluir al menos un número" }] } }
```

`201` → sesión:
```json
{
  "data": {
    "user": {
      "id": 5, "name": "Ana", "email": "ana@mail.com", "role": "athlete",
      "coachId": null, "avatarUrl": null,
      "goals": { "kcal": 2000, "protein": 150, "carbs": 200, "fat": 65 },
      "isActive": true, "hasPassword": true, "createdAt": "2026-10-15 12:00:00"
    },
    "tokens": { "accessToken": "eyJ…", "refreshToken": "eyJ…", "tokenType": "Bearer", "expiresIn": "15m" }
  }
}
```
Errores: `400 VALIDATION_ERROR`, `409 CONFLICT` (email ya registrado, aunque se escriba con
mayúsculas o espacios), `413`, `429`.

#### `POST /auth/login`
Body `{ "email", "password" }`. El email se normaliza igual que en el registro (recorte +
minúsculas). A la contraseña no se le exigen las reglas de fortaleza, pero sí que no esté vacía y
que no supere los 72 bytes (si no, "clave de 72 caracteres + cualquier cosa" también entraría).
`200` → misma sesión que el registro.
Errores: `400`, `401 INVALID_CREDENTIALS` (mismo mensaje para email o contraseña incorrectos),
`401 SOCIAL_ACCOUNT`, `403` (cuenta desactivada), `413`, `429`.

#### `POST /auth/refresh`
Body `{ "refreshToken" }` (string de 1 a 2000 caracteres). `200` → sesión nueva (rota el refresh token).
Errores: `400`, `401 REFRESH_INVALID`, `401 REFRESH_REUSED`.

#### `POST /auth/logout`
Body `{ "refreshToken"? }`: opcional, pero si viene tiene que ser un string de hasta 2000
caracteres. Revoca ese refresh token; sin él responde igual `204` sin revocar nada.
Errores: `400 VALIDATION_ERROR` (por ejemplo, `refreshToken` numérico).

#### `POST /auth/logout-all` 🔒
Cierra la sesión en todos los dispositivos. `204`.

#### `GET /auth/me` 🔒
Usuario actual (incluye `coachName` si tiene entrenador). `200 { data: user }`.

#### `PUT /auth/password` 🔒
Body `{ "currentPassword"?, "newPassword" }`. `currentPassword` es obligatorio si la cuenta ya
tenía contraseña (una cuenta solo social puede crear una). `newPassword` sigue las mismas reglas
que en el registro; `currentPassword`, las del login. Tiene el mismo límite de intentos que el
login (frena a quien tenga un token robado y quiera adivinar la contraseña actual). Revoca todas
las sesiones y devuelve un par nuevo para el dispositivo actual: `200 { data: { tokens } }`.
Errores: `400 VALIDATION_ERROR`, `400 INVALID_PASSWORD`, `401`, `429`.

### 5.3 Login social (OAuth)

El flujo de *authorization code* corre **del lado del servidor**, así los secretos de Google,
Facebook y GitHub nunca están en la app. Con PKCE, aunque otra app intercepte el deep link
no puede usar el código.

```
App                          API                                 Proveedor
 │ 1. genera code_verifier (aleatorio) y code_challenge = SHA256(verifier)
 │── GET /auth/oauth/google/start?redirect_uri=macroentreno://oauth-callback&code_challenge=… ─▶│
 │                            │── 302 a accounts.google.com (state firmado) ─────────────────▶│
 │                            │◀── GET /auth/oauth/google/callback?code=…&state=… ────────────│
 │                            │   canjea el code, lee el perfil, crea o vincula el usuario
 │◀── 302 macroentreno://oauth-callback?code=<código de un solo uso, 2 min> ──│
 │── POST /auth/oauth/exchange { code, codeVerifier } ─▶│
 │◀── 200 { user, tokens } ─────────────────────────────│
```

Vinculación de cuentas: si la cuenta social ya existe, entra con ese usuario. Si no, la vincula
al usuario con el mismo email verificado. Si tampoco hay uno, crea un `athlete` nuevo.

#### `GET /auth/oauth/providers`
`200` → `{ "data": [{ "id": "google", "label": "Google", "configured": true }, …] }`.
La app lo usa para desactivar los botones de proveedores sin configurar.

#### `GET /auth/oauth/:provider/start`
`provider` = `google` · `facebook` · `github`. Se abre en el navegador, no con `fetch`.

| Query | Descripción |
|---|---|
| `redirect_uri` | URI de la app. Su esquema debe estar en `APP_REDIRECT_SCHEMES` (`macroentreno`, `exp`, `exps`) |
| `code_challenge` | SHA-256 en hexadecimal (64 caracteres) del `code_verifier` |

`302` → página de login del proveedor. Errores: `400` (proveedor o redirect inválido), `501 PROVIDER_NOT_CONFIGURED`.

#### `GET /auth/oauth/:provider/callback`
Lo llama el proveedor. Siempre redirige (`302`) a la app:
- éxito: `…/oauth-callback?code=<código>`
- cancelado: `…?error=cancelled`
- error: `…?error=<CODE>&message=<texto>`

#### `POST /auth/oauth/exchange`
Body `{ "code", "codeVerifier" }`. `200` → sesión (`{ user, tokens }`).
El código es de un solo uso y vence a los 2 minutos. Errores: `400`, `401 SOCIAL_LOGIN_FAILED`.

### 5.4 Usuarios

| Método y ruta | Roles | Descripción |
|---|---|---|
| `GET /users/me` 🔒 | todos | Perfil propio |
| `PATCH /users/me` 🔒 | todos | Edita `name`, `avatarUrl`, `goals` |
| `GET /users` 🔒 | admin, coach | Listado paginado. Coach: solo sus atletas |
| `GET /users/:id` 🔒 | admin, coach | Detalle (coach: solo sus atletas) |
| `PUT /users/:id/goals` 🔒 | admin, coach | Objetivos de un atleta |
| `POST /users` 🔒 | admin | Crea un usuario con cualquier rol |
| `PUT /users/:id` 🔒 | admin | Edita nombre, email, rol, entrenador, estado y objetivos |
| `DELETE /users/:id` 🔒 | admin | Borra el usuario y sus datos (en cascada) |

**`GET /users`** query: `page`, `limit`, `role` (`admin`·`coach`·`athlete`), `search` (nombre o email).
`200` → `{ data: [user…], meta }`.

**`PATCH /users/me`** body (todos opcionales):
```json
{ "name": "Ana López", "avatarUrl": "https://…", "goals": { "kcal": 1900, "protein": 140, "carbs": 190, "fat": 60 } }
```
Rangos: `kcal` 800–10000, `protein`/`fat` 0–1000, `carbs` 0–2000.

**`PUT /users/:id/goals`** body `{ "goals": { … } }` (mismo formato).

**`POST /users`** body `{ name, email, password, role = "athlete", coachId? }` → `201`. `name`,
`email` y `password` siguen las [mismas reglas que el registro](#post-authregister).

**`PUT /users/:id`** body (todos opcionales): `{ name, email, role, coachId, isActive, goals }`.
`name` y `email` se validan y normalizan igual que en el registro.
- `coachId` debe ser un usuario con rol `coach`. Si el rol final no es `athlete`, se borra.
- Desactivar una cuenta o cambiarle el rol revoca sus sesiones.
- Un admin no puede quitarse el rol ni desactivarse (`400`).

Errores comunes: `400`, `403`, `404`, `409` (email repetido).

### 5.5 Alimentos

Valores nutricionales **por porción** (`portionGrams`, 100 g por defecto).

| Método y ruta | Roles | Descripción |
|---|---|---|
| `GET /foods` 🔒 | todos | Globales + propios, paginado y con búsqueda |
| `GET /foods/categories` 🔒 | todos | Categorías del catálogo global |
| `GET /foods/:id` 🔒 | todos | Detalle (global o propio) |
| `POST /foods` 🔒 | todos | Crea uno propio. `isGlobal: true` solo coach/admin |
| `PUT /foods/:id` 🔒 | dueño · coach/admin para globales | Edita |
| `DELETE /foods/:id` 🔒 | dueño · coach/admin para globales | Borra (el diario conserva sus copias) |

**`GET /foods`** query: `page`, `limit`, `search`, `category`, `scope` (`all`·`global`·`mine`).
La búsqueda usa el índice FULLTEXT `(name, brand)`: `"pollo cocido"` → `+pollo* +cocido*`.
Las palabras de menos de 3 letras se buscan con `LIKE`.

```json
{
  "data": [{
    "id": 12, "name": "Alfajor Havanna dulce de leche", "category": "Alfajores", "brand": "Havanna",
    "portionGrams": 55, "portionDescription": "1 unidad (55 g)",
    "kcal": 270, "protein": 4, "carbs": 36, "fat": 12, "isGlobal": true, "ownerId": null
  }],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

**`POST /foods`** body: `name` (2–150), `kcal`, `protein`, `carbs`, `fat` (≥ 0), y opcionales
`category`, `brand`, `portionGrams` (> 0), `portionDescription`, `barcode` (6–14 dígitos), `isGlobal`.

#### Código de barras y bases gratuitas

| Método y ruta | Roles | Descripción |
|---|---|---|
| `GET /foods/barcode/:code` 🔒 | todos | Busca el EAN/UPC en el catálogo (propios y globales) y, si no está, en **Open Food Facts**; lo encontrado afuera se guarda en el catálogo global. Responde `{ found, source, food }` o `{ found: false, barcode }` |
| `GET /foods/external/search?source=&search=&limit=` 🔒 | todos | `source`: `openfoodfacts` (envasados, prioriza Argentina) o `usda` (genéricos, en inglés). Valores cada 100 g y `microsCount` |
| `POST /foods/external/import` 🔒 | todos | `{ source, externalId }` → guarda el alimento en el catálogo global sin duplicarlo |

| Fuente | Qué tiene | Clave | Límite |
|---|---|---|---|
| [Open Food Facts](https://world.openfoodfacts.org) | ~4 M de productos envasados con código de barras, muchas marcas argentinas. Licencia ODbL | No (pide `User-Agent` propio: `OFF_USER_AGENT`) | ~15 productos y ~10 búsquedas por minuto por IP: la app busca al confirmar, no letra por letra |
| [USDA FoodData Central](https://fdc.nal.usda.gov) | Alimentos genéricos analizados en laboratorio (Foundation y SR Legacy) | `USDA_API_KEY` gratuita (sin clave usa `DEMO_KEY`) | 1000 consultas por hora |
| FatSecret | Genéricos y marcas con micronutrientes | Sí (Pro, ver 5.11) | Según el plan |

Los valores de Open Food Facts los cargan voluntarios: los micronutrientes imposibles (por ejemplo,
mg cargados como g) se descartan al importar.

### 5.5 bis Asistente con IA (OpenAI)

Todas las rutas requieren sesión y aceptan cuerpos de hasta 12 MB (fotos y audio en base64).
Salvo `/ai/status`, tienen un tope de 60 llamadas cada 10 minutos por usuario
(`429 TOO_MANY_REQUESTS`) y sin `OPENAI_API_KEY` responden `503 AI_NOT_CONFIGURED`.
La clave nunca llega a la app.

| Método y ruta | Body | Respuesta |
|---|---|---|
| `GET /ai/status` 🔒 | — | `{ configured, model, warning? }`. No llama a OpenAI ni cuenta para el tope: la app lo consulta al abrir el chat. `warning` aparece si la clave no empieza con `sk-`. Nunca incluye la clave |
| `POST /ai/chat` 🔒 | `{ messages: [{ role: 'user'\|'assistant', text, image? }] }`: 1–30 mensajes, `text` de hasta 4000 caracteres; el último tiene que ser del usuario y tener texto o foto | `{ reply, actions: [{ type: 'diary'\|'workout'\|'exercise'\|'food', label }] }` |
| `POST /ai/food-photo` 🔒 | `{ image, note? }` (`note` hasta 300 caracteres) | `{ esComida, descripcion, confianza, items: [{ nombre, gramos, kcal, proteinas, carbohidratos, grasas }] }`. No registra nada |
| `POST /ai/transcribe` 🔒 | `{ audio (base64), mimeType }` (`mimeType` del tipo `audio/…`) | `{ text }` |
| `POST /ai/speech` 🔒 | `{ text }` (1–1500 caracteres) | `{ audio (MP3 en base64), mimeType }` |

`image` es un data URL (`data:image/jpeg;base64,…`, también PNG, WebP o HEIC) de hasta ~6,5 MB
de imagen (9 MB en base64); el audio tiene el mismo tope.

Ejemplo de `GET /ai/status`: `200` → `{ "data": { "configured": true, "model": "gpt-6.1-sol" } }`.

**Errores del asistente.** Ante un error pasajero de OpenAI (5xx, límite por minuto o red caída)
la API reintenta una vez después de 1 segundo. Si igual falla, responde con un mensaje que la
app muestra tal cual:

| HTTP | `code` | Cuándo |
|---|---|---|
| 503 | `AI_NOT_CONFIGURED` | Falta `OPENAI_API_KEY` en `backend/.env` |
| 503 | `AI_INVALID_KEY` | OpenAI rechazó la clave (401): revisar `OPENAI_API_KEY` y reiniciar la API |
| 503 | `AI_QUOTA` | La cuenta de OpenAI se quedó sin saldo (429 `insufficient_quota`): no se reintenta |
| 503 | `AI_FORBIDDEN` | La cuenta no tiene acceso al servicio o al modelo configurado (403) |
| 503 | `AI_MODEL_NOT_FOUND` | OpenAI no encontró el modelo de `OPENAI_MODEL` (404) |
| 429 | `AI_RATE_LIMIT` | OpenAI está saturado (429 por límite de uso) |
| 502 | `AI_UNAVAILABLE` | OpenAI respondió con un error 5xx |
| 502 | `AI_UNREACHABLE` | No se pudo conectar con OpenAI (sin internet en el servidor) |
| 502 | `AI_EMPTY` / `AI_ERROR` | El modelo no devolvió respuesta, o devolvió otro error / un análisis de foto que no se pudo leer |
| 504 | `AI_TIMEOUT` | Una llamada a OpenAI tardó más de 45 s (el chat completo, con sus herramientas, tiene 80 s) |

En el chat el modelo puede usar estas herramientas, que vuelven a validar con los mismos esquemas
de la API y respetan los mismos permisos del usuario: `buscar_alimentos`, `registrar_comida`,
`crear_alimento`, `resumen_del_dia`, `buscar_ejercicios`, `crear_ejercicio` (solo coach/admin) y
`registrar_entrenamiento`. Los modelos se configuran con `OPENAI_MODEL` (por defecto `gpt-6.1-sol`,
con visión), `OPENAI_TRANSCRIBE_MODEL`, `OPENAI_TTS_MODEL` y `OPENAI_TTS_VOICE`.

### 5.6 Diario

| Método y ruta | Roles | Descripción |
|---|---|---|
| `GET /diary?date=AAAA-MM-DD[&userId=]` 🔒 | todos (coach/admin con `userId`) | Registros del día + totales + objetivos |
| `POST /diary` 🔒 | todos | Agrega al diario propio |
| `PUT /diary/:id` 🔒 | dueño, admin | Edita |
| `DELETE /diary/:id` 🔒 | dueño, admin | Borra |

**`GET /diary`** `200`:
```json
{
  "data": {
    "date": "2026-10-15",
    "entries": [{ "id": 40, "foodId": 1, "date": "2026-10-15", "meal": "almuerzo", "name": "Pollo pechuga cocida",
                  "grams": 150, "kcal": 247.5, "protein": 46.5, "carbs": 0, "fat": 5.4 }],
    "totals": { "kcal": 247.5, "protein": 46.5, "carbs": 0, "fat": 5.4 },
    "goals": { "kcal": 1800, "protein": 140, "carbs": 180, "fat": 60 }
  }
}
```

**`POST /diary`** — dos modos:
- **Desde el catálogo:** `{ "date", "meal", "foodId", "grams" }`. La API calcula los macros
  escalando el alimento: `valor × grams / portionGrams`.
- **Carga manual:** `{ "date", "meal", "grams", "name", "kcal", "protein"?, "carbs"?, "fat"? }`.

`meal` ∈ `desayuno` · `almuerzo` · `merienda` · `cena` · `snack`. `201` → registro creado.

**`PUT /diary/:id`** campos opcionales `date`, `meal`, `grams`, `name`, `kcal`, `protein`, `carbs`, `fat`.
Si solo cambian los `grams` de un registro que viene del catálogo, los macros se recalculan.

### 5.7 Ejercicios

| Método y ruta | Roles | Descripción |
|---|---|---|
| `GET /exercises[?muscleGroup=&search=]` 🔒 | todos | Catálogo ordenado por grupo y nombre |
| `GET /exercises/muscle-groups` 🔒 | todos | Grupos musculares existentes |
| `GET /exercises/:id` 🔒 | todos | Detalle |
| `POST /exercises` 🔒 | coach, admin | Crea `{ name, muscleGroup, equipment?, imageUrl? }` → `201` |
| `PUT /exercises/:id` 🔒 | coach, admin | Edita (campos parciales) |
| `DELETE /exercises/:id` 🔒 | coach, admin | Borra; las sesiones guardadas conservan el nombre |

`409 CONFLICT` si ya existe un ejercicio con ese nombre.

### 5.8 Entrenamientos

Una sesión tiene ejercicios y cada ejercicio, series. Se guarda todo en una transacción.

| Método y ruta | Roles | Descripción |
|---|---|---|
| `GET /workouts?from=&to=&userId=&limit=` 🔒 | todos (coach: sus atletas) | Sesiones con ejercicios y series |
| `GET /workouts/:id` 🔒 | dueño, su coach, admin | Detalle |
| `POST /workouts` 🔒 | dueño · coach con `userId` de su atleta | Crea → `201` |
| `PUT /workouts/:id` 🔒 | dueño, su coach, admin | Reemplaza la sesión completa |
| `DELETE /workouts/:id` 🔒 | dueño, su coach, admin | Borra (series en cascada) |

Body de `POST`/`PUT`:
```json
{
  "date": "2026-10-15",
  "title": "Pecho pesado",
  "notes": "Buen día",
  "userId": 3,
  "exercises": [
    { "exerciseId": 2, "sets": [{ "reps": 10, "weight": 70 }, { "reps": 8, "weight": 75, "rpe": 9 }] },
    { "name": "Fondos con lastre", "sets": [{ "reps": 12, "weight": 10 }] }
  ]
}
```
Cada ejercicio lleva `exerciseId` (del catálogo) o `name` (libre). Hay 1–30 ejercicios por sesión
y 1–30 series por ejercicio, `reps` 0–1000, `weight` 0–2000 kg y `rpe` 1–10. `userId` solo lo usan coach y admin.

La respuesta incluye `createdBy` y `createdByName`, para que el atleta vea que una rutina se la cargó su entrenador.

### 5.9 Progreso

#### `GET /progress` 🔒
Query: `to` (fecha local, por defecto hoy), `days` (1–90, por defecto 7), `exerciseDays` (7–180,
por defecto 30), `userId` (coach/admin).

```json
{
  "data": {
    "from": "2026-10-09", "to": "2026-10-15",
    "goals": { "kcal": 1800, "protein": 140, "carbs": 180, "fat": 60 },
    "daily": [{ "date": "2026-10-09", "kcal": 747.9, "protein": 76.2, "carbs": 78.2, "fat": 12.8, "workouts": 0 }],
    "summary": { "loggedDays": 7, "daysOnTarget": 0, "avgKcal": 747.9, "avgProtein": 76.2,
                 "avgCarbs": 78.2, "avgFat": 12.8, "totalWorkouts": 2 },
    "exercises": [{
      "exerciseId": 2, "name": "Press de banca con barra", "sessions": 3,
      "latest":   { "date": "2026-10-15", "sets": 3, "reps": 30, "volume": 2175, "bestWeight": 75 },
      "previous": { "date": "2026-10-12", "sets": 3, "reps": 24, "volume": 1500, "bestWeight": 62.5 },
      "delta": { "volume": 675, "bestWeight": 12.5 }
    }]
  }
}
```
Un día está "en objetivo" cuando sus calorías quedan dentro de ±10 % de la meta.

### 5.10 Admin

#### `GET /admin/stats` 🔒 admin
Usuarios por rol, activos, atletas sin coach, alimentos globales y personales, actividad de los
últimos 7 días y últimos 5 usuarios registrados.

### 5.11 MacroEntreno Pro (micronutrientes y suscripción)

Los atletas acceden a Pro con una suscripción mensual (Mercado Pago) o porque un admin se la regala; entrenadores y administradores lo tienen incluido. Sin Pro, las funciones devuelven **402 `PRO_REQUIRED`** y las respuestas del diario, progreso y alimentos no incluyen micronutrientes (`micros: null`).

**Micronutrientes** (fibra, azúcares, grasas saturadas, colesterol, sodio, potasio, calcio, hierro, vitaminas A, C y D): cada alimento y registro los guarda por porción; `null` significa *desconocido* (no suma cero). Los resúmenes informan `value`, `percent` del valor diario de referencia (FDA, adultos), `kind` (`goal` o `limit`) y la cobertura (`known` de `entries`).

| Método | Ruta | Quién | Descripción |
|---|---|---|---|
| GET | `/api/diary?date=` | todos | Con Pro agrega `micros` (resumen del día) y `entries[].micros` |
| GET | `/api/progress` | todos | Con Pro agrega `micros: { days, nutrients }` (promedio diario) |
| GET | `/api/foods/fatsecret/search?search=&page=&limit=` | Pro | Busca en FatSecret; valores cada 100 g y `microsCount` |
| POST | `/api/foods/fatsecret/import` | Pro | `{ externalId }` → guarda el alimento en el catálogo global (si ya existe lo actualiza) |
| GET | `/api/billing/plan` | todos | `{ plan, price, checkoutAvailable, subscription }` |
| POST | `/api/billing/subscribe` | atleta | Crea la suscripción pendiente en Mercado Pago → `{ checkoutUrl }` |
| POST | `/api/billing/sync` | atleta | Consulta el estado en Mercado Pago (la app lo llama al volver del pago) |
| POST | `/api/billing/cancel` | atleta | Da de baja; Pro sigue hasta el final del período pagado |
| POST | `/api/billing/webhook` | Mercado Pago | Valida `x-signature` (si hay `MERCADOPAGO_WEBHOOK_SECRET`) y vuelve a consultar la suscripción |
| POST | `/api/billing/grant` | admin | `{ userId, days }` suma días de Pro; `days: 0` lo quita |

Una suscripción autorizada deja Pro activo hasta la fecha del próximo cobro más 3 días de gracia; cada cobro mensual lo extiende.

## 6. Scripts y pruebas

| Comando | Qué hace |
|---|---|
| `npm run dev` | API con recarga automática (`node --watch`) |
| `npm start` | API en modo producción |
| `npm run db:init` | Crea la base, aplica `database/schema.sql` y carga los datos demo (**borra todo**) |
| `npm run db:seed` | Recarga solo los datos demo |
| `npm run dev:memory` | API + MySQL temporal descargado automáticamente (no hace falta instalar MySQL) |
| `npm test` | 184 pruebas de integración contra un MySQL real temporal (no toca tu base) |

| Archivo | Pruebas | Qué cubre |
|---|---|---|
| `test/api.test.js` | 72 | Rotación y reutilización de tokens, el flujo OAuth completo con un proveedor simulado, los permisos de cada rol, el CRUD de todos los recursos, las validaciones y, con `EXPLAIN`, que las consultas principales usen sus índices |
| `test/auth.test.js` | 93 | Registro, login, refresh, logout, cambio de contraseña y `/auth/me`: límites exactos de cada campo, normalización del email, mensajes de error, tokens con otro algoritmo, body de más de 100 kB e intentos de saltear la validación (también en el alta de usuarios por un admin) |
| `test/ai.test.js` | 19 | Asistente con IA con OpenAI simulado (nunca se llama de verdad): `/ai/status`, validación de mensajes (largo, cantidad, último mensaje), reintentos y la traducción de los errores de OpenAI (`AI_NOT_CONFIGURED`, `AI_INVALID_KEY`, `AI_QUOTA`, `AI_RATE_LIMIT`, `AI_UNAVAILABLE`, `AI_MODEL_NOT_FOUND`, `AI_UNREACHABLE`, `AI_TIMEOUT`) |

Resultado actual: **184/184** ✅.

Ejemplo rápido con `curl`:

```bash
TOKEN=$(curl -s -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"atleta@macroentreno.com","password":"Demo1234"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.tokens.accessToken')
curl -s "localhost:3000/api/diary?date=$(date +%F)" -H "Authorization: Bearer $TOKEN"
```

## 7. Estructura del código

```
backend/
├── database/
│   ├── schema.sql            # tablas, claves foráneas e índices
│   └── seeds/                # 145 alimentos argentinos + 21 ejercicios (de la versión Flet)
├── scripts/
│   ├── db-init.js            # crea la base y carga los datos demo
│   └── dev-memory.js         # API + MySQL temporal
├── src/
│   ├── app.js                # arma Express: middlewares + rutas
│   ├── server.js             # arranca el servidor
│   ├── config/               # env.js (variables) · db.js (pool MySQL y transacciones)
│   ├── middlewares/          # auth (JWT + roles) · validate (zod) · errorHandler
│   ├── utils/                # errores HTTP, fechas, validaciones, control de acceso
│   └── modules/              # un módulo por recurso: *.routes.js · *.service.js · *.schemas.js
│       ├── auth/  users/  foods/  diary/  exercises/  workouts/  progress/  admin/  ai/ …
└── test/                     # api.test.js · auth.test.js · ai.test.js
```

## Seguimiento, planes e informes

La API incorpora el panel de entrenadores, planes alimentarios y reportes semanales/mensuales. Consultá las [rutas, permisos, migración y configuración del generador automático](../docs/SEGUIMIENTO_ENTRENADORES.md).
