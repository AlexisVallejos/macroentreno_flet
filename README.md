# MacroEntreno 💪

App móvil para registrar **comidas y macronutrientes** y **entrenamientos de gimnasio**, con
seguimiento por parte de un entrenador. Es la reestructuración de la versión original en
Flet/Python: mantiene el mismo concepto (diario de macros con alimentos argentinos, sesiones
con series y progreso semanal) sobre una arquitectura cliente-servidor:

- **App:** React Native + Expo SDK 58 (Expo Router, Context API, SecureStore)
- **API:** Node.js + Express 5, REST, JWT de acceso y renovación, login social OAuth
- **Base de datos:** MySQL 8 con índices pensados para cada consulta

## Índice

| Documento | Contenido |
|---|---|
| **Este README** | Resumen, cumplimiento de la consigna, arquitectura, estructura y arranque rápido |
| [docs/INSTALACION.md](docs/INSTALACION.md) | Guía de instalación y configuración: dependencias, variables de entorno, MySQL, redes sociales y **APK** |
| [docs/MANUAL_USUARIO.md](docs/MANUAL_USUARIO.md) | Manual de usuario por rol: iniciar sesión, navegar y usar cada pantalla |
| [Manual de usuario (PDF)](docs/manual-usuario/Manual_de_Usuario_MacroEntreno.pdf) · [Word](docs/manual-usuario/Manual_de_Usuario_MacroEntreno.docx) | Versión para imprimir o entregar del manual de usuario, con capturas de pantalla |
| [backend/README.md](backend/README.md) | **Documentación de la API**: endpoints, métodos, parámetros, respuestas y códigos de error |
| [docs/BASE_DE_DATOS.md](docs/BASE_DE_DATOS.md) | Modelo entidad-relación, tablas e **índices** (qué consulta usa cada uno) |

**En esta página:** [Cumplimiento de la consigna](#cumplimiento-de-la-consigna) ·
[Arquitectura](#arquitectura) · [Roles](#roles) · [Estructura del repositorio](#estructura-del-repositorio) ·
[Arranque rápido](#arranque-rápido) · [Calidad y pruebas](#calidad-y-pruebas) · [Tecnologías](#tecnologías)

## Cumplimiento de la consigna

### 1. Requisitos funcionales

| Requisito | Cómo se cumple | Dónde |
|---|---|---|
| Registro e inicio de sesión | Formularios con validación, contraseñas con bcrypt | `mobile/src/features/auth/` · `backend/src/modules/auth/` |
| Autenticación con 3 redes sociales | **Google, Facebook y GitHub** con OAuth 2.0 del lado del servidor + PKCE | `backend/src/modules/auth/socialProviders.js`, `oauth.js` · `mobile/src/api/socialLogin.js` |
| Mínimo 3 roles con permisos distintos | **Administrador, Entrenador y Atleta** | [tabla de roles](#roles) |
| Comportamiento y accesos por rol | Pestañas y pantallas distintas por rol (`Tabs.Protected` / `Stack.Protected`) y verificación en cada endpoint | `mobile/src/app/(app)/` · `backend/src/middlewares/auth.js`, `src/utils/access.js` |
| UI amigable y adaptable a móviles | Tema oscuro, componentes táctiles de 48 px, estados de carga, vacío y error | `mobile/src/components/` |
| Navegación y componentes bien estructurados | Expo Router (stack + tabs) y 19 componentes reutilizables | `mobile/src/app/`, `mobile/src/components/` |
| Consumo de API con CRUD | CRUD de usuarios, alimentos, diario, ejercicios y entrenamientos | `mobile/src/api/endpoints.js` |
| Manejo de errores con mensajes adecuados | Errores normalizados de la API, mensajes en castellano, botón **Reintentar** | `mobile/src/api/client.js`, `components/States.jsx` |

### 2. Requisitos técnicos del frontend (React Native)

| Requisito | Cómo se cumple |
|---|---|
| Navegación fluida | Expo Router: stack nativo + pestañas, rutas protegidas por sesión y por rol |
| Estado global con Context API | `AuthContext` (Context + `useReducer`) maneja la sesión y el usuario |
| Autenticación persistente | Tokens en **SecureStore** (cifrado del sistema). La sesión se restaura al abrir la app, el token se renueva solo y la app abre sin conexión con el último usuario conocido |
| Componentes responsivos | `useWindowDimensions`: grilla de 1 a 3 columnas, ancho máximo en tablet u horizontal, `orientation: default` |
| Manejo de errores en formularios y conexión | Validación en el cliente (campo por campo) + errores de la API (`details`) + timeouts y errores de red |

### 3. Requisitos técnicos del backend

| Requisito | Cómo se cumple |
|---|---|
| API REST (login, registro, obtención y actualización de datos) | Express 5 con 73 endpoints organizados por módulo |
| JWT con tokens de acceso y renovación | Acceso de 15 min + renovación de 30 días con **rotación** y detección de reutilización |
| Base de datos MySQL bien estructurada | 9 tablas normalizadas, claves foráneas con reglas de borrado e **índices por consulta** → [BASE_DE_DATOS.md](docs/BASE_DE_DATOS.md) |
| Gestión de roles y endpoints protegidos | `authenticate` + `authorize(...roles)` + control de "solo mis atletas" |
| Documentación de la API en README | [backend/README.md](backend/README.md) |

### 4. Buenas prácticas

| Requisito | Cómo se cumple |
|---|---|
| Código limpio y documentado | Comentarios en castellano donde explican el porqué, ESLint sin advertencias |
| Estructura de carpetas lógica | Backend por módulos (rutas/servicio/esquemas); app separada en rutas (`app/`) y pantallas (`features/`) |
| Git y README | Repositorio en GitHub, este README y la guía de instalación |

### 5. Entregables

| Entregable | Estado |
|---|---|
| Código fuente completo (frontend + backend) | ✅ `mobile/` + `backend/` |
| Manual de usuario | ✅ [PDF](docs/manual-usuario/Manual_de_Usuario_MacroEntreno.pdf) · [Word](docs/manual-usuario/Manual_de_Usuario_MacroEntreno.docx) · [Markdown](docs/MANUAL_USUARIO.md) |
| Guía de instalación y configuración | ✅ [docs/INSTALACION.md](docs/INSTALACION.md) |
| Documentación de la API | ✅ [backend/README.md](backend/README.md) |
| APK | Se genera con `npx eas-cli build -p android --profile preview` → [instrucciones](docs/INSTALACION.md#6-generar-el-apk) |
| Video de demostración (opcional) | Pendiente: guion sugerido abajo |

**Guion sugerido para el video (3–4 min):** registro → login con una red social → el atleta
registra una comida desde el catálogo y una sesión → Progreso → logout → el coach ve el diario
del atleta y le asigna una rutina → el admin cambia el rol de un usuario y le asigna un coach →
se apaga el Wi-Fi y aparece el mensaje de error con **Reintentar**.

## Arquitectura

```
┌─────────────────────────┐   HTTPS/HTTP + JSON   ┌───────────────────────────┐   mysql2   ┌─────────┐
│  App (React Native)      │ ───────────────────▶ │  API REST (Express)       │ ─────────▶ │ MySQL 8 │
│  Expo Router · Context   │ ◀─────────────────── │  JWT · roles · zod        │            └─────────┘
│  SecureStore (tokens)    │  Bearer accessToken   │  OAuth Google/FB/GitHub   │
└─────────────────────────┘                       └───────────────────────────┘
            │  navegador del sistema (login social)            │
            └──────────────▶ Google / Facebook / GitHub ◀──────┘
```

## Seguimiento y reportes

Los entrenadores tienen un panel diario y semanal de clientes, planes de alimentación integrados al diario y PDF. Los atletas reciben informes semanales automáticos. El administrador dispone de reportes mensuales por entrenador y accesos a altas y asignaciones. Ver [guía de seguimiento, permisos y generación automática](docs/SEGUIMIENTO_ENTRENADORES.md).

## Roles

| | Atleta | Entrenador | Administrador |
|---|---|---|---|
| Pestañas | Inicio · Diario · Entrenos · Progreso · Perfil | Mis atletas · Catálogo · Perfil | Panel · Usuarios · Catálogo · Perfil |
| Diario y entrenos propios | CRUD | — | — |
| Datos de atletas | — | Solo los asignados: ve el diario y el progreso, asigna rutinas y objetivos | Todos |
| Catálogo de alimentos y ejercicios | Lee el catálogo y gestiona sus alimentos propios | CRUD | CRUD |
| Usuarios, roles y asignación de entrenador | — | — | CRUD + estadísticas |

## Estructura del repositorio

```
macroentreno_flet/
├── README.md                 ← índice general (este archivo)
├── docs/
│   ├── INSTALACION.md        ← instalación, configuración y APK
│   ├── MANUAL_USUARIO.md     ← manual de uso por rol
│   ├── manual-usuario/       ← manual de usuario en PDF y Word (con capturas)
│   └── BASE_DE_DATOS.md      ← modelo ER e índices
├── backend/                  ← API REST (Node.js + Express + MySQL)
│   ├── README.md             ← documentación de la API
│   ├── database/schema.sql   ← tablas e índices
│   ├── database/seeds/       ← alimentos y ejercicios de la versión Flet
│   ├── scripts/              ← db-init, dev-memory
│   ├── src/
│   │   ├── config/  middlewares/  utils/
│   │   └── modules/{auth,users,foods,diary,exercises,workouts,progress,admin}/
│   └── test/                 ← 184 pruebas de integración (api, auth, ai)
└── mobile/                   ← App React Native (Expo SDK 58)
    ├── app.json · eas.json   ← configuración de la app y del APK
    ├── test/                 ← 53 pruebas de las validaciones de formularios (node:test)
    └── src/
        ├── app/              ← rutas (Expo Router): login/register y (app)/(tabs) por rol
        ├── features/         ← pantallas por dominio: auth, home, diary, workouts, progress, catalog, users, profile
        ├── components/       ← UI reutilizable (Screen, Card, Button, TextField, Chips, gráficos…)
        ├── context/          ← AuthContext (estado global de la sesión)
        ├── api/              ← cliente HTTP con renovación de token, endpoints, login social
        ├── hooks/            ← useResource (carga + foco), useResponsive
        ├── storage/          ← persistencia segura de la sesión
        ├── theme/ · utils/   ← colores, fechas, validaciones, formato
```

## Arranque rápido

```bash
# 1) API con MySQL temporal (sin instalar MySQL)
cd backend && npm install && npm run dev:memory

# 2) App (en otra terminal). Cambiá la IP por la de tu PC.
cd mobile && npm install
echo "EXPO_PUBLIC_API_URL=http://192.168.0.10:3000/api" > .env
npx expo start            # escaneá el QR con Expo Go
```

Usuarios demo (contraseña `Demo1234`): `admin@macroentreno.com` · `coach@macroentreno.com` ·
`atleta@macroentreno.com`. Para MySQL real, redes sociales y APK, seguí la
[guía de instalación](docs/INSTALACION.md).

## Calidad y pruebas

| Verificación | Comando | Resultado |
|---|---|---|
| Pruebas de integración de la API (MySQL real): endpoints y permisos, login/registro, asistente con IA | `cd backend && npm test` | 184/184 ✅ (72 + 93 + 19) |
| Pruebas de las validaciones de la app (node:test) | `cd mobile && npm test` | 53/53 ✅ |
| Lint de la app | `cd mobile && npx expo lint` | sin errores ni advertencias ✅ |
| Diagnóstico de Expo | `cd mobile && npx expo-doctor` | 20/20 ✅ |
| Compilación del bundle Android | `cd mobile && npx expo export -p android` | ✅ |

## Tecnologías

**App:** React Native 0.88 · React 19 · Expo SDK 58 · Expo Router · expo-secure-store ·
expo-web-browser · expo-crypto · @expo/vector-icons.
**API:** Node.js · Express 5 · mysql2 · jsonwebtoken · bcryptjs · zod · helmet · cors ·
express-rate-limit · morgan.
**Pruebas:** node:test · supertest · mysql-memory-server.

---

La versión original en Flet (Python) sigue disponible en el historial de Git, en la rama `main`
anterior a esta reestructuración.
