// Contenido del manual de usuario. Marcas: **negrita**, *cursiva*, `código`.
export const meta = {
  institution: 'E.E.S.T. N° 5',
  title: 'Manual de usuario de MacroEntreno',
  subtitle: 'Cuenta, registro de comidas y plan de alimentación',
  student: 'Alexis Vallejos',
  subject: 'Proyecto, Diseño e Implementación de Sistemas Computacionales',
  teacher: 'Martín A. Estanga Schulze',
  course: '7° 4° GB',
  date: '30 de octubre de 2026',
  sigla: 'MacroEntreno',
  fileName: 'Manual_de_Usuario_MacroEntreno',
};

const pair = 11.5; // ancho de una figura con dos capturas
const trio = 15.5; // ancho de una figura con tres capturas

export const blocks = [
  { t: 'cover' },

  { t: 'title', text: 'Resumen' },
  {
    t: 'p',
    text: 'Este manual explica, paso a paso y con capturas reales, cómo usar MacroEntreno, una aplicación para registrar comidas, macronutrientes y entrenamientos con el seguimiento de un entrenador. Se muestra cómo crear una cuenta, iniciar y cerrar sesión, cargar cada comida del día (desayuno, almuerzo, merienda, cena y snack), corregir o borrar lo cargado, crear alimentos propios, usar el plan de alimentación, registrar entrenamientos y ver el progreso. También se explican las funciones del entrenador y del administrador y cómo se navega según el rol. Para cada pantalla se indican los mensajes de error que puede ver el usuario y cómo resolverlos.',
  },
  { t: 'kw', text: 'manual de usuario, registro de comidas, macronutrientes, plan de alimentación, inicio de sesión.' },
  { t: 'pb' },

  { t: 'title', text: 'Índice' },
  { t: 'toc' },
  { t: 'pb' },

  { t: 'h1', text: 'Introducción' },
  {
    t: 'p',
    text: 'MacroEntreno sirve para llevar un diario de lo que se come y de los entrenamientos de gimnasio. Cada alimento cargado suma calorías, proteínas, carbohidratos y grasas, y la aplicación compara esos totales con los objetivos diarios de la persona. Hay tres roles: **Atleta**, que carga sus comidas y entrenamientos; **Entrenador**, que sigue a sus atletas y les arma planes; y **Administrador**, que gestiona usuarios y entrenadores.',
  },
  {
    t: 'p',
    text: 'Este manual cubre todo lo que necesita un usuario: crear la cuenta, entrar, registrar sus comidas y entrenamientos, seguir su progreso y usar el plan de alimentación, además de las tareas propias del entrenador y del administrador. Todas las capturas se tomaron usando la aplicación real, con los datos que se indican en cada paso, por lo que lo que se ve en las figuras es lo mismo que verá el usuario.',
  },

  { t: 'h1', text: 'Desarrollo', pageBreak: true },
  { t: 'h2', text: 'Antes de empezar' },
  {
    t: 'p',
    text: 'La aplicación funciona en Android, iPhone y en el navegador. Las capturas de este manual se tomaron en la versión web, en una ventana del tamaño de un celular (390 × 844 píxeles); las pantallas son las mismas en el teléfono. Para probar la aplicación sin crear una cuenta se pueden usar los usuarios de ejemplo de la Tabla 1.',
  },
  {
    t: 'table',
    n: 1,
    title: 'Usuarios de ejemplo',
    cols: [5.2, 3, 3, 4.8],
    head: ['Email', 'Contraseña', 'Rol', 'Pantalla de inicio'],
    rows: [
      ['admin@macroentreno.com', 'Demo1234', 'Administrador', 'Panel'],
      ['coach@macroentreno.com', 'Demo1234', 'Entrenador', 'Mis atletas'],
      ['atleta@macroentreno.com', 'Demo1234', 'Atleta', 'Inicio'],
      ['lucia.gomez@mail.com', 'Lucia2026', 'Atleta', 'Inicio (cuenta creada en este manual)'],
    ],
    note: 'Las tres primeras cuentas vienen cargadas en la base de datos de ejemplo. La cuarta se crea en la sección "Crear una cuenta".',
  },

  // ---------------- Cuenta ----------------
  { t: 'h2', text: 'Crear una cuenta' },
  {
    t: 'p',
    text: 'Desde la pantalla de inicio de sesión se toca **Registrate**. Aparece la pantalla **Creá tu cuenta** (Figura 1a), que pide nombre, email, contraseña y repetir la contraseña. Debajo de la contraseña se recuerda la regla: mínimo 8 caracteres, con letras y números. Toda cuenta creada desde acá es de tipo Atleta; los roles de Entrenador y Administrador los asigna un administrador.',
  },
  {
    t: 'fig',
    n: 1,
    title: 'Pantalla de registro',
    shots: [
      ['08_registro_pantalla', 'Pantalla inicial'],
      ['09_registro_campos_vacios', 'Al tocar Crear cuenta sin datos'],
    ],
    widthCm: pair,
  },
  {
    t: 'p',
    text: 'Si se toca **Crear cuenta** sin completar nada, cada campo obligatorio se marca en rojo con su mensaje (Figura 1b). Lo mismo pasa con datos incorrectos: en la Figura 2a se cargó un nombre de una letra, un email sin dominio, una contraseña sin números y una confirmación distinta; en la Figura 2b, un nombre de solo números, un email con una extensión de una letra y una contraseña demasiado larga. Cada campo dice qué corregir. Al escribir en un campo, su error desaparece. Las reglas completas están en la Tabla 2.',
  },
  {
    t: 'fig',
    n: 2,
    title: 'Errores al completar el registro',
    shots: [
      ['10_registro_errores', 'Datos incorrectos'],
      ['10b_registro_limites', 'Fuera de los límites'],
      ['11_registro_email_duplicado', 'Email que ya tiene cuenta'],
    ],
    phoneWidth: 210,
    widthCm: trio,
  },
  {
    t: 'table',
    n: 2,
    title: 'Reglas de los datos de la cuenta',
    cols: [2.6, 6.4, 7],
    head: ['Campo', 'Regla', 'Mensaje si no se cumple'],
    rows: [
      ['Nombre', 'Entre 2 y 100 caracteres, con al menos una letra', '"Ingresá tu nombre" / "Máximo 100 caracteres" / "El nombre debe tener letras"'],
      ['Email', 'Formato nombre@dominio.ext, extensión de 2 letras o más, hasta 190 caracteres', '"Ingresá un email válido" / "Máximo 190 caracteres"'],
      ['Contraseña', 'Entre 8 y 72 caracteres, con al menos una letra y un número', '"Mínimo 8 caracteres" / "Máximo 72 caracteres" / "Debe tener letras y números"'],
      ['Contraseña', 'Las tildes, la ñ y los emojis ocupan más espacio y cuentan doble o más', '"Es muy larga: las tildes, la ñ y los emojis ocupan más espacio"'],
      ['Repetir contraseña', 'Igual a la contraseña, letra por letra', '"Las contraseñas no coinciden"'],
    ],
    note: 'La aplicación avisa antes de enviar los datos y el servidor vuelve a controlarlos, así que no se puede crear una cuenta salteando estas reglas.',
  },
  {
    t: 'p',
    text: 'Si el email ya pertenece a otra cuenta aparece el aviso "Ya existe una cuenta con ese email" (Figura 2c). No importa si se escribe con mayúsculas o espacios: se considera el mismo email. En ese caso hay que iniciar sesión con esa cuenta o usar otro email.',
  },
  {
    t: 'p',
    text: 'Con todos los datos correctos (Figura 3a) se toca **Crear cuenta**. La aplicación crea la cuenta y entra directamente, sin volver a pedir los datos (Figura 3b). La pantalla de inicio saluda con el nombre cargado, muestra las calorías del día y los accesos **Registrar comida** y **Nueva sesión**.',
  },
  {
    t: 'fig',
    n: 3,
    title: 'Registro completo y primera pantalla de la cuenta nueva',
    shots: [
      ['12_registro_formulario_completo', 'Formulario válido'],
      ['13_registro_ok', 'Cuenta creada'],
    ],
    widthCm: pair,
  },

  { t: 'h2', text: 'Iniciar sesión' },
  {
    t: 'p',
    text: 'Al abrir la aplicación sin una sesión guardada aparece la pantalla de la Figura 4a. Se escribe el email, se pasa a la contraseña (la tecla Siguiente del teclado lleva directo a ese campo) y se toca **Ingresar**. Mientras el servidor responde, el botón muestra un indicador de carga. El ícono del sol, arriba a la derecha, cambia entre tema claro y oscuro.',
  },
  {
    t: 'fig',
    n: 4,
    title: 'Pantalla de inicio de sesión y sus validaciones',
    shots: [
      ['01_login_pantalla', 'Pantalla inicial'],
      ['02_login_campos_vacios', 'Campos vacíos'],
      ['03_login_email_invalido', 'Email incompleto'],
    ],
    phoneWidth: 210,
    widthCm: trio,
  },
  {
    t: 'p',
    text: 'Si se toca **Ingresar** con los campos vacíos o con un email incompleto, la aplicación lo marca antes de enviar nada (Figuras 4b y 4c). Si el email existe pero la contraseña es incorrecta, aparece "Email o contraseña incorrectos" (Figura 5a). El mensaje es el mismo cuando el email no está registrado, para que nadie pueda averiguar qué personas tienen cuenta probando emails.',
  },
  {
    t: 'fig',
    n: 5,
    title: 'Contraseña incorrecta y red social no disponible',
    shots: [
      ['04_login_credenciales_incorrectas', 'Contraseña incorrecta'],
      ['07_login_social_sin_configurar', 'Red social sin configurar'],
    ],
    widthCm: pair,
  },
  {
    t: 'p',
    text: 'Los botones **Google**, **Facebook** y **GitHub** permiten entrar con una cuenta de esas redes. Al tocarlos se abre el navegador para autorizar a MacroEntreno y después se vuelve a la aplicación con la sesión iniciada. Si el servidor todavía no tiene configurada esa red, la aplicación lo avisa (Figura 5b).',
  },
  {
    t: 'p',
    text: 'Con datos correctos, la aplicación muestra pestañas distintas según el rol (Figura 6): el Atleta ve su resumen diario; el Entrenador, la lista de sus atletas; el Administrador, el panel con estadísticas y la gestión de entrenadores.',
  },
  {
    t: 'fig',
    n: 6,
    title: 'Pantalla inicial según el rol',
    shots: [
      ['05_login_ok_atleta', 'Atleta'],
      ['06_login_ok_entrenador', 'Entrenador'],
      ['06_login_ok_admin', 'Administrador'],
    ],
    phoneWidth: 210,
    widthCm: trio,
  },
  {
    t: 'p',
    text: 'Si se hacen muchos intentos seguidos, el servidor responde "Demasiados intentos, probá de nuevo en unos minutos". Esto protege la cuenta de quien quiera adivinar la contraseña.',
  },

  { t: 'h2', text: 'Perfil y cierre de sesión' },
  {
    t: 'p',
    text: 'En la pestaña **Perfil** se ven el nombre, el email y el rol (Figura 7a). Ahí también se elige la apariencia (automática, clara u oscura), se cambia el nombre y se ajustan los objetivos diarios. Al final de la pantalla está **Cerrar sesión**: la aplicación pide confirmar y vuelve al inicio de sesión (Figura 7b).',
  },
  {
    t: 'fig',
    n: 7,
    title: 'Perfil del usuario y cierre de sesión',
    shots: [
      ['14_perfil_usuario_nuevo', 'Perfil'],
      ['15_logout', 'Después de cerrar sesión'],
    ],
    widthCm: pair,
  },
  {
    t: 'p',
    text: 'Mientras no se cierre la sesión, la aplicación la recuerda: al volver a abrirla entra sola (Figura 8a). En el teléfono los datos de la sesión se guardan cifrados en el almacenamiento seguro del sistema. La Figura 8b muestra la pantalla de inicio de sesión con el tema claro.',
  },
  {
    t: 'fig',
    n: 8,
    title: 'Sesión recordada al volver a abrir y tema claro',
    shots: [
      ['17_sesion_persistente', 'Sesión recordada'],
      ['18_login_tema_claro', 'Tema claro'],
    ],
    widthCm: pair,
  },

  // ---------------- Comidas ----------------
  { t: 'h2', text: 'Registro de comidas' },
  { t: 'h3', text: 'El diario' },
  {
    t: 'p',
    text: 'Las comidas se cargan en la pestaña **Diario** (Figura 9). Arriba están el botón **Mi plan de alimentación** y el selector de fecha, que muestra "Hoy" con flechas para ir al día anterior o al siguiente. Debajo, el anillo indica las calorías consumidas sobre el objetivo y cuántas faltan; los tres anillos chicos muestran las proteínas, los carbohidratos y las grasas. Después vienen las cinco comidas del día, cada una con sus calorías y un botón **+** para agregar alimentos (Tabla 3).',
  },
  { t: 'fig', n: 9, title: 'Diario de una cuenta nueva, sin comidas cargadas', shots: [['c01_diario_vacio']], widthCm: 5 },
  {
    t: 'table',
    n: 3,
    title: 'Comidas del día y lo que se cargó en cada una para este manual',
    cols: [2.8, 6.2, 7],
    head: ['Comida', 'Cómo se cargó', 'Alimentos'],
    rows: [
      ['Desayuno', 'Desde el catálogo', 'Avena en hojuelas 60 g y banana 120 g'],
      ['Almuerzo', 'Desde el catálogo', 'Pollo pechuga cocida 200 g'],
      ['Merienda', 'Desde el catálogo', 'Yogur griego descremado 170 g'],
      ['Cena', 'Desde el catálogo', 'Arroz integral cocido 150 g'],
      ['Snack', 'Carga manual', 'Barrita de cereal 25 g (95 kcal)'],
    ],
    note: 'La cuenta usada es la de Lucía Gómez, creada en la sección anterior. Su objetivo diario es de 2.000 kcal.',
  },

  { t: 'h3', text: 'Agregar un alimento del catálogo' },
  {
    t: 'p',
    text: 'Para cargar el desayuno se toca el **+** de **Desayuno**. Se abre **Registrar comida** con la comida ya elegida en la fila de opciones (Figura 10a); si hace falta se puede cambiar a otra tocando su nombre. Arriba aparecen accesos rápidos, como **Escanear**, que lee el código de barras del envase con la cámara del teléfono. En **Buscar en** se elige dónde buscar: **Mi catálogo** (los alimentos de la aplicación y los propios), Open Food Facts, USDA o **Carga manual**.',
  },
  {
    t: 'p',
    text: 'Se escribe el alimento en **Buscar alimento**; la lista se filtra sola mientras se escribe (Figura 10b). Al tocar un resultado aparece su tarjeta con la porción de referencia y el campo **Cantidad (g)**. Al cambiar los gramos, las calorías y los macronutrientes de abajo se recalculan solos (Figura 10c): 60 g de avena son 233,4 kcal, 10,1 g de proteínas, 39,8 g de carbohidratos y 4,1 g de grasas.',
  },
  {
    t: 'fig',
    n: 10,
    title: 'Carga del desayuno desde el catálogo',
    shots: [
      ['c02_registrar_desayuno', 'Registrar comida'],
      ['c03_buscar_alimento', 'Búsqueda "avena"'],
      ['c04_cantidad', 'Cantidad en gramos'],
    ],
    phoneWidth: 210,
    widthCm: trio,
  },
  {
    t: 'p',
    text: 'Al tocar **Agregar** se vuelve al diario con el alimento dentro de **Desayuno** y los totales del día actualizados (Figura 11a). Para el almuerzo, la merienda y la cena se repite lo mismo desde el **+** de cada comida; en la Figura 11b se ve la búsqueda de "pollo" para el almuerzo, con **Almuerzo** ya marcado.',
  },
  {
    t: 'fig',
    n: 11,
    title: 'Desayuno agregado y búsqueda para el almuerzo',
    shots: [
      ['c05_diario_con_desayuno', 'Desayuno cargado'],
      ['c06_buscar_almuerzo', 'Búsqueda para el almuerzo'],
    ],
    widthCm: pair,
  },

  { t: 'h3', text: 'Carga manual' },
  {
    t: 'p',
    text: 'Si un alimento no está en ningún catálogo se usa **Carga manual**, como se hizo con el snack. El formulario pide nombre, cantidad en gramos, calorías, proteínas, carbohidratos y grasas. El nombre, los gramos y las calorías son obligatorios; si faltan, se marcan en rojo (Figura 12a). Los macronutrientes que no se completen se guardan en cero. Se pueden escribir decimales con coma, por ejemplo 2,5 (Figura 12b).',
  },
  {
    t: 'fig',
    n: 12,
    title: 'Carga manual del snack',
    shots: [
      ['c07_manual_errores', 'Sin datos obligatorios'],
      ['c08_manual_completo', 'Formulario completo'],
    ],
    widthCm: pair,
  },

  { t: 'h3', text: 'Resumen del día' },
  {
    t: 'p',
    text: 'Con las cinco comidas cargadas, el diario queda como en la Figura 13. Cada registro muestra el alimento, los gramos, las calorías y los macronutrientes (P de proteínas, C de carbohidratos y G de grasas). El total del día llegó a 1.049,7 kcal de 2.000, y los anillos indican que se cubrió el 65 % de las proteínas, el 64 % de los carbohidratos y el 25 % de las grasas del objetivo.',
  },
  { t: 'fig', n: 13, title: 'Diario con desayuno, almuerzo, merienda, cena y snack', shots: [['c09_diario_completo']], widthCm: 4.6 },

  { t: 'h3', text: 'Editar y eliminar un registro' },
  {
    t: 'p',
    text: 'Para corregir un registro se toca sobre él. Se abre **Editar registro** con los datos cargados (Figura 14a). Si el alimento vino del catálogo y solo se cambian los gramos, los macronutrientes se recalculan solos. En el ejemplo se pasó el pollo de 200 g a 250 g y se tocó **Guardar cambios**. También se puede mover el registro a otra comida eligiéndola en la fila de arriba.',
  },
  {
    t: 'p',
    text: 'Para borrar un registro se toca el tacho rojo de su derecha y se confirma. En la Figura 14b se ve el diario después de los dos cambios: el almuerzo pasó a 412,5 kcal por los 250 g de pollo y el desayuno quedó solo con la avena, porque se eliminó la banana.',
  },
  {
    t: 'fig',
    n: 14,
    title: 'Edición de un registro y diario después de editar y eliminar',
    shots: [
      ['c10_editar_registro', 'Editar registro'],
      ['c11_despues_de_editar_y_eliminar', 'Diario actualizado'],
    ],
    widthCm: pair,
  },

  { t: 'h3', text: 'Consultar otros días' },
  {
    t: 'p',
    text: 'Con las flechas del selector de fecha se ve lo cargado otros días; tocando la fecha se vuelve a hoy. La Figura 15 muestra el día anterior de la cuenta de ejemplo del Atleta. Esta cuenta tiene MacroEntreno Pro, por eso además de los macronutrientes ve los micronutrientes (fibra, azúcares, sodio y otros). Sin Pro, ese recuadro ofrece conocer el plan.',
  },
  { t: 'fig', n: 15, title: 'Día anterior en el diario de la cuenta de ejemplo del Atleta', shots: [['c19_dia_anterior']], widthCm: 5.2 },

  { t: 'h2', text: 'Catálogo de alimentos' },
  {
    t: 'p',
    text: 'El catálogo reúne los alimentos que se pueden buscar al registrar una comida. Se abre desde **Perfil**, en la opción **Mis alimentos**, y tiene tres filtros: **Todos**, **Catálogo** (los de la aplicación) y **Mis alimentos** (los creados por el usuario). Una cuenta nueva no tiene alimentos propios (Figura 16a).',
  },
  {
    t: 'p',
    text: 'Con **Crear alimento personal** se abre el formulario **Nuevo alimento**. Pide nombre, categoría, marca y los valores de una porción: gramos, descripción (por ejemplo "2 tostadas"), calorías, proteínas, carbohidratos y grasas. Si se toca **Crear alimento** sin datos, se marcan los obligatorios (Figura 16b).',
  },
  {
    t: 'fig',
    n: 16,
    title: 'Catálogo de una cuenta nueva y validación del formulario',
    shots: [
      ['c12_catalogo', 'Mis alimentos vacío'],
      ['c13_alimento_errores', 'Formulario sin datos'],
    ],
    widthCm: pair,
  },
  {
    t: 'p',
    text: 'En la Figura 17a se completó el alimento "Tostadas de pan integral", con una porción de 30 g (2 tostadas) y 78 kcal. Al crearlo aparece en **Mis alimentos** (Figura 17b) y desde ese momento se puede buscar al registrar cualquier comida, igual que los del catálogo general. Los alimentos personales solo los ve quien los creó.',
  },
  {
    t: 'fig',
    n: 17,
    title: 'Alimento personal completo y ya guardado en el catálogo',
    shots: [
      ['c14_alimento_completo', 'Formulario completo'],
      ['c15_catalogo_alimento_creado', 'Alimento creado'],
    ],
    widthCm: pair,
  },

  { t: 'h2', text: 'Plan de alimentación' },
  {
    t: 'p',
    text: 'El entrenador puede armarle a cada atleta un plan con lo que tiene que comer en cada comida. Desde la ficha del atleta toca **Plan de alimentación** y luego **Crear plan de alimentación**. En el formulario (Figura 18a) escribe un título, las indicaciones y las fechas de inicio y fin. Después elige el día (**Todos los días** o uno en particular) y la comida, busca el alimento y lo toca para sumarlo al menú, donde puede ajustar los gramos. En el ejemplo se armó el "Plan semanal de volumen" para todos los días con avena en el desayuno, pollo en el almuerzo, yogur en la merienda y arroz en la cena. Se guarda con **Asignar plan al atleta**.',
  },
  {
    t: 'p',
    text: 'El atleta ve el plan desde **Mi plan de alimentación** (Figura 18b): las indicaciones, la vigencia, el menú del día elegido con los valores de cada alimento y el total del día, en este caso 777 kcal. Puede descargarlo en PDF con **Descargar plan completo en PDF**.',
  },
  {
    t: 'fig',
    n: 18,
    title: 'Plan de alimentación armado por el entrenador y visto por el atleta',
    shots: [
      ['c16_plan_formulario', 'Formulario del entrenador'],
      ['c17_plan_atleta', 'Plan visto por el atleta'],
    ],
    widthCm: 10.5,
  },
  {
    t: 'p',
    text: 'Cuando el atleta comió lo indicado, toca **Agregar estas comidas a mi diario** y confirma. Todas las comidas del plan para esa fecha se cargan en el diario, cada una en su momento del día (Figura 19). Después se pueden ajustar los gramos como cualquier otro registro. Si se toca dos veces, la aplicación avisa que el plan ya estaba agregado y no lo duplica. No se pueden agregar comidas de un plan vencido ni de un día futuro.',
  },
  {
    t: 'fig',
    n: 19,
    title: 'Diario del atleta después de agregar las comidas del plan',
    shots: [
      ['c18_diario_con_plan', 'Totales del día'],
      ['c18b_diario_con_plan_comidas', 'Comidas agregadas'],
    ],
    widthCm: pair,
  },

  { t: 'h2', text: 'Entrenamientos' },
  {
    t: 'p',
    text: 'Los entrenamientos se cargan en la pestaña **Entrenos**, que muestra las sesiones de la semana con flechas para ir a otras semanas (Figura 20a). Con **Nueva sesión** se abre el formulario. Si se toca **Guardar sesión** sin título ni ejercicios, la aplicación marca los dos errores (Figura 20b); al escribir el título, su error desaparece.',
  },
  {
    t: 'fig',
    n: 20,
    title: 'Semana sin sesiones y validación de una sesión nueva',
    shots: [
      ['e01_entrenos_vacio', 'Semana sin sesiones'],
      ['e02_sesion_errores', 'Sesión sin datos'],
    ],
    widthCm: pair,
  },
  {
    t: 'p',
    text: 'El formulario pide la fecha, el estado (**Pendiente** o **Realizada**), un título y notas opcionales. **Agregar ejercicio** abre la lista de ejercicios agrupados por músculo (Figura 21a); también se puede escribir uno nuevo. Cada ejercicio trae tres series con 10 repeticiones; en cada serie se cargan las repeticiones, los kilos y, si se quiere, el RPE (esfuerzo percibido de 1 a 10). Con **Agregar serie** se suman series y con el signo menos se quitan. En el ejemplo se cargó "Pecho y tríceps" con press de banca y extensión de tríceps en polea (Figura 21b).',
  },
  {
    t: 'fig',
    n: 21,
    title: 'Elección de ejercicios y sesión completa',
    shots: [
      ['e03_elegir_ejercicio', 'Lista de ejercicios'],
      ['e04_sesion_completa', 'Sesión completa'],
    ],
    widthCm: pair,
  },
  {
    t: 'p',
    text: 'Al guardar, la sesión aparece en la semana con su estado, los ejercicios y el volumen total, que es la suma de repeticiones por kilos de todas las series: 1.900 kg en este caso (Figura 22). Tocando la sesión se puede editar o eliminar.',
  },
  { t: 'fig', n: 22, title: 'Sesión guardada en la semana', shots: [['e05_entrenos_con_sesion']], widthCm: 5.2 },

  { t: 'h2', text: 'Progreso' },
  {
    t: 'p',
    text: 'La pestaña **Progreso** resume la semana (Figura 23): días con comidas registradas, sesiones realizadas y días en que se cumplió el objetivo de calorías, un gráfico de calorías por día y la comparación con la semana anterior. En el ejemplo, la carga máxima en press de banca subió 2,5 kg respecto a la semana anterior. Desde **Mis informes PDF semanales** se descarga el resumen de cada semana cerrada.',
  },
  { t: 'fig', n: 23, title: 'Progreso semanal de la cuenta de ejemplo del Atleta', shots: [['e06_progreso']], widthCm: 4.8 },

  { t: 'h2', text: 'Funciones del entrenador' },
  {
    t: 'p',
    text: 'El Entrenador entra a **Mis atletas** (Figura 6b), donde ve a sus clientes con lo que comieron y entrenaron. Con **Ver seguimiento** abre la ficha de un atleta (Figura 24a): puede revisar su semana, su diario (sin poder modificarlo), sus rutinas y su progreso, asignarle rutinas, armarle el plan de alimentación, descargar sus informes en PDF y ajustar sus objetivos diarios. En la pestaña **Catálogo** (Figura 24b) administra los alimentos y ejercicios que usan todos los usuarios; con **Nuevo alimento** suma uno al catálogo general.',
  },
  {
    t: 'fig',
    n: 24,
    title: 'Ficha de seguimiento de un atleta y catálogo del entrenador',
    shots: [
      ['e07_coach_ficha_atleta', 'Ficha del atleta'],
      ['e08_coach_catalogo', 'Catálogo'],
    ],
    widthCm: 10.5,
  },

  { t: 'h2', text: 'Administración de usuarios' },
  {
    t: 'p',
    text: 'El Administrador gestiona las cuentas desde la pestaña **Usuarios** (Figura 25a), con filtros por rol y un buscador por nombre o email. Con **Nuevo usuario** se da de alta una cuenta (Figura 25b): nombre, email, contraseña inicial, que sigue las reglas de la Tabla 2, y rol. En el ejemplo se creó a "Pablo Ruiz" como Entrenador.',
  },
  {
    t: 'fig',
    n: 25,
    title: 'Lista de usuarios y alta de un entrenador',
    shots: [
      ['e09_admin_usuarios', 'Usuarios'],
      ['e10_admin_nuevo_usuario', 'Nuevo usuario'],
    ],
    widthCm: pair,
  },
  {
    t: 'p',
    text: 'Tocando un usuario se abre **Editar usuario** (Figura 26a). Ahí se cambia el rol, se asigna el entrenador de un atleta, se regala o quita MacroEntreno Pro y se puede desactivar la cuenta; una cuenta desactivada no puede ingresar. A Martina se le asignó como entrenador a Pablo Ruiz y se tocó **Guardar cambios**. Con **Eliminar**, y después de confirmar, se da de baja una cuenta. La Figura 26b muestra la lista final: Pablo Ruiz agregado, Martina con su entrenador y la cuenta "Usuario de prueba" ya eliminada.',
  },
  {
    t: 'fig',
    n: 26,
    title: 'Modificación de un usuario y lista final',
    shots: [
      ['e12_admin_asignar_entrenador', 'Asignar entrenador'],
      ['e13_admin_usuarios_final', 'Lista actualizada'],
    ],
    widthCm: pair,
  },

  { t: 'h2', text: 'Navegación y uso en distintas pantallas' },
  {
    t: 'p',
    text: 'Para moverse por la aplicación se usa la barra de pestañas de abajo. Las pantallas que se abren desde una pestaña, como **Registrar comida** o **Nueva sesión**, tienen una flecha arriba a la izquierda para volver. Cada rol ve sus propias pestañas (Tabla 4); si alguien intenta abrir una pantalla de otro rol, la aplicación no la muestra y el servidor rechaza el pedido.',
  },
  {
    t: 'table',
    n: 4,
    title: 'Pestañas de la aplicación según el rol',
    cols: [3, 6.5, 6.5],
    head: ['Rol', 'Pestañas', 'Para qué se usan'],
    rows: [
      ['Atleta', 'Inicio · Diario · Entrenos · Progreso · Perfil', 'Registrar comidas y entrenamientos y ver su avance'],
      ['Entrenador', 'Mis atletas · Catálogo · Perfil', 'Seguir a sus atletas, asignar rutinas y planes, editar el catálogo'],
      ['Administrador', 'Panel · Usuarios · Catálogo · Perfil', 'Ver estadísticas y gestionar usuarios, entrenadores y catálogo'],
    ],
  },
  {
    t: 'p',
    text: 'La aplicación se adapta al tamaño y a la orientación de la pantalla. En una tablet o en una computadora, con 900 píxeles de ancho o más, las pestañas pasan a una barra lateral y el contenido se ordena en columnas (Figura 27). Con el celular en horizontal, el contenido se reacomoda al ancho disponible (Figura 28).',
  },
  { t: 'fig', n: 27, title: 'Inicio del Atleta en una tablet horizontal', shots: [['e14_tablet_horizontal']], phoneWidth: 590, widthCm: 15 },
  { t: 'fig', n: 28, title: 'Diario con el celular en horizontal', shots: [['e15_celular_horizontal']], phoneWidth: 422, widthCm: 12 },

  { t: 'h2', text: 'Mensajes frecuentes y qué hacer' },
  {
    t: 'table',
    n: 5,
    title: 'Mensajes que puede ver el usuario',
    cols: [5.6, 5.2, 5.2],
    head: ['Mensaje', 'Por qué aparece', 'Qué hacer'],
    rows: [
      ['"Email o contraseña incorrectos"', 'El email o la contraseña no coinciden con una cuenta', 'Revisar mayúsculas de la contraseña o registrarse'],
      ['"Ya existe una cuenta con ese email"', 'Ese email ya está registrado', 'Iniciar sesión con esa cuenta o usar otro email'],
      ['"Demasiados intentos, probá de nuevo en unos minutos"', 'Muchos intentos seguidos de entrar o registrarse', 'Esperar unos minutos'],
      ['"Tu cuenta está desactivada"', 'Un administrador desactivó la cuenta', 'Hablar con el administrador'],
      ['"Esta cuenta se creó con una red social…"', 'La cuenta no tiene contraseña propia', 'Entrar con Google, Facebook o GitHub'],
      ['"No se pudo conectar con el servidor"', 'No hay internet o el servidor no responde', 'Revisar la conexión y tocar Reintentar'],
      ['"Elegí un alimento de la lista"', 'Se tocó Agregar sin elegir un alimento', 'Buscar y tocar un resultado'],
      ['"Requerido" / "Debe ser mayor a 0"', 'Falta un dato o la cantidad es cero', 'Completar el campo con un número válido'],
      ['"Ingresá un nombre"', 'Nombre del alimento vacío o de una letra', 'Escribir un nombre de 2 letras o más'],
    ],
  },

  { t: 'h1', text: 'Conclusión', pageBreak: true },
  {
    t: 'p',
    text: 'Siguiendo este manual, un usuario nuevo puede crear su cuenta, entrar y empezar a registrar lo que come en cada momento del día. Las funciones se comprobaron una por una con la aplicación real: se creó una cuenta, se cargaron el desayuno, el almuerzo, la merienda, la cena y un snack, se corrigió y se borró un registro, se creó un alimento propio, se aplicó un plan armado por el entrenador, se registró una sesión de entrenamiento y se dio de alta, se modificó y se dio de baja un usuario como administrador. En cada paso los totales del día se actualizaron solos y los errores mostraron un mensaje que indica qué corregir.',
  },
  {
    t: 'p',
    text: 'Armar el manual también sirvió para revisar la aplicación desde el lado del usuario. Probar datos incorrectos a propósito permitió encontrar y corregir fallas reales en el registro y el inicio de sesión, como contraseñas demasiado largas que el sistema aceptaba sin avisar.',
  },

];
