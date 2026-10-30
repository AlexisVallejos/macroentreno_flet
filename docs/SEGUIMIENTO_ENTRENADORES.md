# Seguimiento de atletas, alimentación e informes

## Entrenador

- **Mis atletas:** panel de sus clientes asignados. El selector de fecha muestra comidas del día y un resumen de la semana: días con registro, días en objetivo, sesiones realizadas y pendientes.
- **Ficha del atleta > Semana:** calorías y macros diarios, sesiones y cargas comparadas con la semana anterior. Tocá un día para abrir el diario detallado.
- **Diario:** consulta de alimentos, cantidades y nutrientes. **Objetivos:** ajuste de metas diarias. **Rutinas:** ejercicios, series, repeticiones, pesos e indicaciones para el atleta.
- **Plan de alimentación:** crear un plan con vigencia, indicaciones, alimentos del catálogo y cantidades. Cada alimento puede aplicarse todos los días o un día específico de la semana. Se descarga el plan completo en PDF. Para reemplazar un plan, archivá el anterior y creá el nuevo; el plan archivado conserva su consulta histórica.
- **Informes PDF semanales:** consulta y descarga de los informes de sus atletas actuales.

El entrenador solo puede acceder a sus atletas. Si el administrador cambia una asignación, el acceso pasa al nuevo entrenador inmediatamente, incluidos los planes e informes del atleta.

## Atleta

Se mantienen su diario, entrenamientos, progreso y funciones actuales. Se agregan accesos a **Mi plan de alimentación** y **Mis informes semanales** en Inicio y Diario/Progreso.

- El plan muestra las comidas y cantidades del día elegido, sus macros y el PDF completo.
- **Agregar estas comidas a mi diario** pide confirmar que se consumieron. Copia las comidas del día con los valores nutricionales del plan. El atleta puede corregir cantidades y borrar registros desde el diario.
- Un plan solo se copia una vez por fecha, incluso con clics o peticiones simultáneas. Borrar una comida después no permite volver a copiar todo el plan: se agrega esa comida manualmente desde el diario.
- No se puede copiar un plan archivado, fuera de vigencia o para una fecha futura. Los alimentos diarios se suman a los específicos del día de la semana.
- Las rutinas que asigna el entrenador quedan **Pendientes**. El atleta ajusta las repeticiones y pesos reales y cambia la sesión a **Realizada**. Solo estas sesiones alimentan las estadísticas de progreso. No se puede completar una sesión futura.

## Administrador

En **Panel > Gestión de entrenadores**:

- **Crear entrenador:** abre el alta de usuario con ese rol seleccionado.
- **Asignar atletas a entrenadores:** abre Usuarios; editá al atleta y elegí su entrenador. Solo se admiten entrenadores activos.
- **Reportes mensuales:** elegí un mes para ver y descargar el PDF general o el de un entrenador.

El reporte incluye clientes atendidos, nuevos y al cierre; clientes con comidas o entrenamientos, días de registro, comidas, sesiones realizadas, rutinas asignadas y planes creados. Los meses abiertos se identifican como resultados parciales.

**Definiciones:** un cliente nuevo es un atleta asignado en ese mes; se cuenta una vez por entrenador aunque se reasigne. Un cliente atendido tuvo una asignación vigente en algún momento del mes. La actividad se atribuye por la fecha de la comida o sesión y por el historial de asignaciones. Si un cliente cambia de entrenador en un día, la actividad de ese día corresponde al nuevo desde esa fecha; el diario no registra hora de consumo. Las altas anteriores a la instalación se registran como una base inicial, sin inventar fechas históricas ni contarlas como clientes nuevos.

## Informes automáticos y persistencia

La semana va del lunes al domingo. La zona horaria de negocio y de las conexiones SQL es **America/Argentina/Buenos_Aires (UTC-03:00)**.

Al arrancar la API y cada hora, el proceso busca semanas cerradas de los atletas activos y genera los informes faltantes desde su primer registro/alta. Al terminar el domingo, el PDF queda disponible durante la siguiente revisión del lunes. Recupera semanas pendientes si la API estuvo apagada. Una clave única por atleta y semana evita duplicados. Cada informe guarda su resumen JSON y el PDF en MySQL; los cambios posteriores en registros y objetivos no modifican el informe guardado.

El PDF incluye los siete días, macros y metas al momento de generación, sesiones realizadas, series, volumen, comparación de cargas máximas por ejercicio y cobertura de registros frente a la semana anterior. Los promedios nutricionales usan únicamente días con comidas. Un día en objetivo tiene calorías dentro de +/-10% de la meta vigente. El sistema describe cambios observados y falta de datos; no infiere progreso físico a partir de volumen o de registros incompletos.

Para una ejecución externa opcional:

```bash
cd backend
npm run reports:weekly
```

El proceso de la API debe permanecer activo para la generación automática por hora. También puede programarse ese comando con cron usando la misma base y variables del backend. Los informes se consultan dentro de la app y no se envían por correo.

**Base temporal:** `dev:memory` pierde todos los datos e informes cuando se detiene. Para conservarlos entre reinicios se necesita MySQL persistente y sus copias de seguridad.

## Migración

El arranque del servidor aplica `database/migrations/001-coaching.sql` de forma aditiva y agrega el estado de las sesiones antiguas: las cargadas por el atleta quedan realizadas y las cargadas por otra persona quedan pendientes. No borra usuarios, comidas ni sesiones.

Se crean `coach_assignments`, `meal_plans`, `meal_plan_items`, `meal_plan_applications` y `weekly_reports`. Las cantidades y nutrientes de los planes se guardan como una copia: modificar o borrar un alimento del catálogo no cambia el plan. El índice único de aplicaciones y una transacción protegen la copia al diario.

`npm run db:init` sigue siendo el comando destructivo para recrear la base de demostración; no se debe usar para actualizar una base con datos reales.

## API

Todas las rutas requieren token Bearer. Los PDF se descargan con ese token; no hay enlaces públicos con tokens en la URL. `?format=base64` devuelve `{data:{filename,base64}}` para los clientes web y nativos.

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/coaching/dashboard?date=AAAA-MM-DD` | Panel del entrenador |
| GET | `/api/coaching/plans?userId=ID` | Planes propios o del atleta autorizado |
| POST | `/api/coaching/plans` | Crear plan; coach asignado o admin |
| GET | `/api/coaching/plans/:id` | Consultar plan |
| GET | `/api/coaching/plans/:id/pdf` | PDF del plan |
| POST | `/api/coaching/plans/:id/archive` | Archivar plan; coach asignado o admin |
| POST | `/api/coaching/plans/:id/apply` | Copiar al diario; solo el atleta dueño, cuerpo `{date}` |
| GET | `/api/reports/weekly/preview?week=AAAA-MM-DD&userId=ID` | Seguimiento vivo; la fecha es un lunes |
| GET | `/api/reports/weekly?userId=ID` | Informes guardados, últimos 104 |
| POST | `/api/reports/weekly/generate` | Recuperar una semana cerrada, cuerpo opcional `{week,userId}` |
| GET | `/api/reports/weekly/:id` | Resumen guardado |
| GET | `/api/reports/weekly/:id/pdf` | PDF semanal guardado |
| GET | `/api/reports/coaches/monthly?month=AAAA-MM` | Reporte mensual; solo admin |
| GET | `/api/reports/coaches/monthly/pdf?month=AAAA-MM&coachId=ID` | PDF general o por entrenador; solo admin |

Crear plan usa `{athleteId,title,notes,startDate,endDate,items:[{foodId,grams,meal,dayOfWeek}]}`. `dayOfWeek` es 0 para todos los días o 1 (lunes) a 7 (domingo). Se admiten hasta 100 alimentos por plan y vigencia de hasta un año.

Los entrenamientos ahora exponen `status: "planned" | "completed"`. En la creación de rutinas para otros usuarios se fuerza `planned`; el atleta es quien confirma el estado realizado en la edición de su sesión.
