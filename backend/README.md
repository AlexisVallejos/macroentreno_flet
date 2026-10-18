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
| 401 | `TOKEN_INVALID` | Token mal formado, firmado con otra clave o usuario inexistente |
| 401 | `INVALID_CREDENTIALS` | Email o contraseña incorrectos |
| 401 | `SOCIAL_ACCOUNT` | La cuenta solo tiene login social (no tiene contraseña) |
| 401 | `REFRESH_INVALID` / `REFRESH_REUSED` | Refresh token inválido, vencido, revocado o reutilizado |
| 401 | `SOCIAL_LOGIN_FAILED` | Falló el canje del código social o el proveedor rechazó el login |
| 403 | `FORBIDDEN` | El rol no tiene permiso o la cuenta está desactivada |
| 404 | `NOT_FOUND` | El recurso o la ruta no existen (o no son visibles para el usuario) |
| 409 | `CONFLICT` | Registro duplicado (email, nombre de ejercicio) |
| 429 | `TOO_MANY_REQUESTS` | Más de 50 intentos de login/registro en 15 minutos |
| 501 | `PROVIDER_NOT_CONFIGURED` | El proveedor social no tiene credenciales en `.env` |
| 502 | `PROVIDER_UNAVAILABLE` | No se pudo contactar a Google/Facebook/GitHub |
| 503 | `DB_UNAVAILABLE` | MySQL caído o mal configurado |
| 500 | `INTERNAL_ERROR` | Error inesperado (se registra en consola) |

## 5. Endpoints

### 5.1 Salud

#### `GET /health`
Verifica la API y la conexión a MySQL.
`200` → `{ "data": { "status": "ok", "database": "ok", "time": "2026-10-15T12:00:00.000Z" } }` · `503 DB_UNAVAILABLE`

### 5.2 Auth

#### `POST /auth/register`
Crea una cuenta con rol `athlete`.

| Campo | Tipo | Reglas |
|---|---|---|
| `name` | string | 2–100 caracteres |
| `email` | string | email válido, se guarda en minúsculas |
| `password` | string | 8–72 caracteres, al menos una letra y un número |

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
Errores: `400 VALIDATION_ERROR`, `409 CONFLICT` (email ya registrado), `429`.

#### `POST /auth/login`
Body `{ "email", "password" }`. `200` → misma sesión que el registro.
Errores: `400`, `401 INVALID_CREDENTIALS`, `401 SOCIAL_ACCOUNT`, `403` (cuenta desactivada), `429`.

#### `POST /auth/refresh`
Body `{ "refreshToken" }`. `200` → sesión nueva (rota el refresh token).
Errores: `400`, `401 REFRESH_INVALID`, `401 REFRESH_REUSED`.

#### `POST /auth/logout`
Body `{ "refreshToken" }`. Revoca ese refresh token. `204`.

#### `POST /auth/logout-all` 🔒
Cierra la sesión en todos los dispositivos. `204`.

#### `GET /auth/me` 🔒
Usuario actual (incluye `coachName` si tiene entrenador). `200 { data: user }`.

#### `PUT /auth/password` 🔒
Body `{ "currentPassword"?, "newPassword" }`. `currentPassword` es obligatorio si la cuenta ya
tenía contraseña (una cuenta solo social puede crear una). Revoca todas las sesiones y devuelve
un par nuevo para el dispositivo actual: `200 { data: { tokens } }`.
Errores: `400 VALIDATION_ERROR`, `400 INVALID_PASSWORD`.

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

**`POST /users`** body `{ name, email, password (mín. 8), role = "athlete", coachId? }` → `201`.

**`PUT /users/:id`** body (todos opcionales): `{ name, email, role, coachId, isActive, goals }`.
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
`category`, `brand`, `portionGrams` (> 0), `portionDescription`, `isGlobal`.

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

## 6. Scripts y pruebas

| Comando | Qué hace |
|---|---|
| `npm run dev` | API con recarga automática (`node --watch`) |
| `npm start` | API en modo producción |
| `npm run db:init` | Crea la base, aplica `database/schema.sql` y carga los datos demo (**borra todo**) |
| `npm run db:seed` | Recarga solo los datos demo |
| `npm run dev:memory` | API + MySQL temporal descargado automáticamente (no hace falta instalar MySQL) |
| `npm test` | 41 pruebas de integración contra un MySQL real temporal |

Las pruebas (`test/api.test.js`) cubren registro, login, rotación y reutilización de tokens,
el flujo OAuth completo con un proveedor simulado, los permisos de cada rol, el CRUD de todos
los recursos, las validaciones y, con `EXPLAIN`, que las consultas principales usen sus índices.

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
│       ├── auth/  users/  foods/  diary/  exercises/  workouts/  progress/  admin/
└── test/api.test.js
```
