# Manual de usuario · MacroEntreno

MacroEntreno sirve para registrar lo que comés (calorías y macronutrientes) y tus
entrenamientos de gimnasio. También permite que un entrenador siga a sus atletas.

## Índice

1. [Primeros pasos](#1-primeros-pasos)
   - [Crear una cuenta](#11-crear-una-cuenta) · [Iniciar sesión](#12-iniciar-sesión) ·
     [Redes sociales](#13-iniciar-sesión-con-google-facebook-o-github) · [Sesión guardada](#14-la-sesión-queda-guardada)
2. [Roles: qué puede hacer cada usuario](#2-roles-qué-puede-hacer-cada-usuario)
3. [Atleta](#3-atleta)
   - [Inicio](#31-inicio) · [Diario](#32-diario-de-comidas) · [Entrenos](#33-entrenos) ·
     [Progreso](#34-progreso) · [Perfil](#35-perfil)
4. [Entrenador](#4-entrenador)
5. [Administrador](#5-administrador)
6. [Mensajes de error](#6-mensajes-de-error)

---

## 1. Primeros pasos

### 1.1 Crear una cuenta

1. En la pantalla de inicio tocá **Registrate**.
2. Completá nombre, email y una contraseña de al menos 8 caracteres con letras y números.
3. Repetí la contraseña y tocá **Crear cuenta**.

Toda cuenta nueva es de tipo **Atleta**. Para ser Entrenador o Administrador, un administrador tiene que cambiarte el rol.

### 1.2 Iniciar sesión

Ingresá tu email y contraseña y tocá **Ingresar**. Si te equivocás, la app marca en rojo el
campo con problemas o muestra "Email o contraseña incorrectos".

Para probar la app hay cuentas de demostración (contraseña `Demo1234`):
`admin@macroentreno.com`, `coach@macroentreno.com`, `atleta@macroentreno.com`.

### 1.3 Iniciar sesión con Google, Facebook o GitHub

1. Tocá el botón de la red social.
2. Se abre el navegador: iniciá sesión en esa red y aceptá los permisos.
3. Volvés solo a la app, ya con la sesión iniciada.

Si ya tenías cuenta con el mismo email, se vincula a esa cuenta. Si un botón aparece atenuado,
esa red todavía no está habilitada en el servidor.

> Si entraste con una red social y querés ingresar también con email, creá una contraseña en
> **Perfil → Crear contraseña**.

### 1.4 La sesión queda guardada

No hace falta iniciar sesión cada vez que abrís la app: la sesión se guarda cifrada en el
celular. Se cierra cuando tocás **Cerrar sesión**, cuando cambiás tu contraseña (en los otros
dispositivos) o si un administrador desactiva tu cuenta.

## 2. Roles: qué puede hacer cada usuario

| | Atleta | Entrenador | Administrador |
|---|---|---|---|
| Pestañas | Inicio · Diario · Entrenos · Progreso · Perfil | Mis atletas · Catálogo · Perfil | Panel · Usuarios · Catálogo · Perfil |
| Registrar comidas y sesiones propias | ✅ | — | — |
| Ver el diario y el progreso de atletas | — | Solo los suyos | Todos |
| Asignar rutinas y objetivos a atletas | — | Solo a los suyos | ✅ |
| Editar el catálogo de alimentos y ejercicios | Solo alimentos propios | ✅ | ✅ |
| Gestionar usuarios y roles | — | — | ✅ |

La app solo muestra las pantallas que corresponden a tu rol. Además, el servidor verifica
los permisos en cada acción.

## 3. Atleta

### 3.1 Inicio

Muestra:
- Un saludo y el nombre de tu entrenador, si tenés uno asignado.
- **Registrar comida** y **Nueva sesión**, como accesos rápidos.
- **Hoy:** calorías consumidas contra tu meta, cuánto te queda y barras de proteínas, carbohidratos y grasas.
- **Últimos 7 días:** calorías por día contra tu meta (línea naranja). Las barras verdes son
  días en objetivo (±10 %) y el punto naranja marca los días que entrenaste.

Deslizá hacia abajo para actualizar los datos.

### 3.2 Diario de comidas

- Usá **‹** y **›** para cambiar de día. Tocá la fecha para volver a hoy.
- Arriba ves el resumen del día y abajo las comidas: Desayuno, Almuerzo, Merienda, Cena y Snack.

**Agregar una comida**
1. Tocá el **+** de la comida (por ejemplo, Merienda).
2. Con **Buscar en catálogo**, escribí el alimento ("havanna", "arroz", "pollo") y elegilo.
3. Ajustá los **gramos**: los macros se calculan solos y se ven antes de guardar.
4. Tocá **Agregar**.

Si el alimento no está, usá **Carga manual** e ingresá el nombre, los gramos, las kcal y los macros.

**Editar:** tocá el registro, cambiá lo que necesites y tocá **Guardar cambios**. Si el registro
viene del catálogo y solo cambiás los gramos, los macros se recalculan.

**Eliminar:** tocá el ícono 🗑️ del registro (o **Eliminar** dentro de la edición) y confirmá.

**Mis alimentos:** en **Perfil → Mis alimentos** podés crear alimentos propios (por ejemplo, una
receta casera). Solo los ves vos y aparecen en el buscador.

### 3.3 Entrenos

- Cada pantalla muestra una semana. Usá **‹ ›** para cambiar de semana y tocá el título para volver a la actual.
- Cada tarjeta muestra la fecha, el título, el **volumen total** (reps × kg) y las series de cada ejercicio.
- Las rutinas que te cargó tu entrenador dicen **"Asignada por …"**.

**Nueva sesión**
1. Tocá **Nueva sesión**, elegí la fecha y poné un título (ej. "Pierna").
2. Tocá **Agregar ejercicio**: filtrá por grupo muscular y elegí uno, o escribí uno nuevo y tocá **+**.
3. Cada ejercicio empieza con 3 series. Completá **Reps**, **Kg** y, si querés, **RPE** (esfuerzo del 1 al 10).
4. Usá **Agregar serie** o **⊖** para sumar o quitar series, y **⊗** para quitar el ejercicio.
5. Tocá **Guardar sesión**.

Para editar o eliminar una sesión, tocala en la lista.

### 3.4 Progreso

- Elegí el período: **7, 14 o 30 días**.
- Tarjetas con tu promedio de kcal y proteína, los días en objetivo y la cantidad de sesiones.
- Gráfico de calorías por día.
- **Fuerza:** cada ejercicio con su mejor peso y la diferencia de volumen contra la sesión
  anterior (verde si subiste, rojo si bajaste).

### 3.5 Perfil

- Cambiar tu nombre.
- **Mis objetivos diarios:** calorías, proteínas, carbohidratos y grasas. Tu entrenador también puede ajustarlos.
- **Mis alimentos**, **Cambiar contraseña** y **Cerrar sesión**.

## 4. Entrenador

**Mis atletas** lista a los atletas que tenés asignados, con buscador. Tocá uno para ver:

| Pestaña | Qué podés hacer |
|---|---|
| **Diario** | Ver lo que comió cada día. Es solo lectura: el diario lo carga el atleta |
| **Rutinas** | Ver sus sesiones y tocar **Asignar rutina** para cargarle una (por ejemplo, la de mañana). También podés editar o eliminar sus sesiones |
| **Progreso** | Las mismas estadísticas que ve el atleta |
| **Objetivos** | Ajustar sus metas de calorías y macros |

**Catálogo**
- **Alimentos:** agregá, editá o eliminá alimentos del catálogo global, que ven todos los usuarios.
  Con el interruptor "Agregar al catálogo global" desactivado, el alimento queda solo para vos.
- **Ejercicios:** agregá ejercicios nuevos con su grupo muscular, o editá y eliminá los existentes.
  Las sesiones ya cargadas conservan el nombre del ejercicio aunque lo elimines.

Los atletas te los asigna un administrador.

## 5. Administrador

**Panel:** cantidad de usuarios por rol, atletas sin entrenador, comidas y sesiones de los
últimos 7 días, tamaño del catálogo y últimos usuarios registrados.

**Usuarios**
- Filtrá por rol o buscá por nombre o email.
- **Nuevo usuario:** nombre, email, contraseña inicial y rol.
- Tocá un usuario para:
  - cambiarle el **rol** (Administrador, Entrenador o Atleta);
  - asignarle un **entrenador** (solo atletas);
  - **desactivar** la cuenta: no puede ingresar y se cierran sus sesiones;
  - **eliminarlo**, junto con su diario y sus entrenamientos.

No podés quitarte tu propio rol de administrador, ni desactivar o eliminar tu propia cuenta.

**Catálogo:** igual que el entrenador.

## 6. Mensajes de error

| Mensaje | Qué significa | Qué hacer |
|---|---|---|
| "No se pudo conectar con el servidor" | Sin internet o la API no responde | Revisá la conexión y tocá **Reintentar** |
| "El servidor tardó demasiado en responder" | Conexión lenta | Probá de nuevo |
| "Email o contraseña incorrectos" | Datos de acceso mal | Revisá mayúsculas y el email |
| "Esta cuenta se creó con una red social…" | La cuenta no tiene contraseña | Entrá con la red social, o creá una contraseña en Perfil |
| "Tu sesión expiró" | La sesión se cerró por seguridad | Iniciá sesión de nuevo |
| "Tu cuenta está desactivada" | Un admin desactivó la cuenta | Contactá a un administrador |
| "No tenés permisos para esta acción" | Tu rol no puede hacer eso | — |
| Texto rojo debajo de un campo | Dato inválido (vacío, negativo, formato) | Corregí ese campo |
| "Se canceló el inicio de sesión" | Cerraste el navegador del login social | Volvé a intentarlo |
