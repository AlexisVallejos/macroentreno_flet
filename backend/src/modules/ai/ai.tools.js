import { z } from 'zod';
import { query } from '../../config/db.js';
import { today } from '../../utils/dates.js';
import { MEALS, createEntrySchema } from '../diary/diary.schemas.js';
import * as diary from '../diary/diary.service.js';
import { foodSchema } from '../foods/foods.schemas.js';
import * as foods from '../foods/foods.service.js';
import { workoutSchema } from '../workouts/workouts.schemas.js';
import * as workouts from '../workouts/workouts.service.js';

/**
 * Herramientas que el asistente puede usar en nombre del usuario. Cada una vuelve a validar sus
 * argumentos con los mismos esquemas que la API REST y respeta los mismos permisos: la IA no puede
 * hacer nada que el usuario no pueda hacer desde la app.
 */

const macroProps = {
  kcal: { type: 'number', description: 'Kilocalorías de la cantidad indicada' },
  proteinas: { type: 'number', description: 'Gramos de proteína' },
  carbohidratos: { type: 'number', description: 'Gramos de carbohidratos' },
  grasas: { type: 'number', description: 'Gramos de grasa' },
};

const fn = (name, description, properties, required) => ({
  type: 'function',
  name,
  description,
  parameters: { type: 'object', properties, required, additionalProperties: false },
  strict: false,
});

export const TOOLS = [
  fn(
    'buscar_alimentos',
    'Busca alimentos en el catálogo de la app (con alimentos argentinos) y en Open Food Facts (productos envasados). Devuelve macros por porción. Usalo antes de registrar algo envasado o común para usar datos reales.',
    { texto: { type: 'string', description: 'Qué buscar, ej. "yogur ser", "milanesa", "alfajor guaymallen"' } },
    ['texto'],
  ),
  fn(
    'registrar_comida',
    'Agrega una o más comidas al diario del usuario. Con foodId los macros se calculan del catálogo a partir de los gramos; sin foodId hay que pasar nombre y macros estimados para esos gramos.',
    {
      comida: { type: 'string', enum: MEALS, description: 'Momento del día' },
      fecha: { type: 'string', description: 'YYYY-MM-DD; por defecto hoy' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            foodId: { type: 'integer', description: 'Id del catálogo, si salió de buscar_alimentos' },
            nombre: { type: 'string' },
            gramos: { type: 'number' },
            ...macroProps,
          },
          required: ['nombre', 'gramos'],
          additionalProperties: false,
        },
      },
    },
    ['comida', 'items'],
  ),
  fn(
    'crear_alimento',
    'Guarda un alimento nuevo en el catálogo personal del usuario (por ejemplo una receta propia o un producto que no existe). Los valores son por porción.',
    {
      nombre: { type: 'string' },
      marca: { type: 'string' },
      porcion_gramos: { type: 'number', description: 'Gramos de la porción a la que corresponden los valores (normalmente 100)' },
      descripcion_porcion: { type: 'string', description: 'Ej. "1 unidad (50 g)"' },
      codigo_barras: { type: 'string' },
      ...macroProps,
    },
    ['nombre', 'porcion_gramos', 'kcal', 'proteinas', 'carbohidratos', 'grasas'],
  ),
  fn('resumen_del_dia', 'Devuelve lo que el usuario comió en un día, los totales y sus objetivos de macros.', { fecha: { type: 'string', description: 'YYYY-MM-DD; por defecto hoy' } }, []),
  fn(
    'buscar_ejercicios',
    'Busca ejercicios en el catálogo de la app.',
    { texto: { type: 'string' }, grupo_muscular: { type: 'string', description: 'Ej. Pecho, Espalda, Piernas' } },
    [],
  ),
  fn(
    'crear_ejercicio',
    'Agrega un ejercicio nuevo al catálogo. Solo pueden hacerlo entrenadores y administradores.',
    { nombre: { type: 'string' }, grupo_muscular: { type: 'string' }, equipamiento: { type: 'string' } },
    ['nombre', 'grupo_muscular'],
  ),
  fn(
    'registrar_entrenamiento',
    'Guarda una sesión de entrenamiento del usuario con sus ejercicios y series. Usá exerciseId del catálogo cuando exista (buscar_ejercicios); si no, el nombre. Una fecha futura queda como planificada.',
    {
      fecha: { type: 'string', description: 'YYYY-MM-DD; por defecto hoy' },
      titulo: { type: 'string', description: 'Ej. "Pecho y tríceps"' },
      notas: { type: 'string' },
      estado: { type: 'string', enum: ['planned', 'completed'] },
      ejercicios: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            exerciseId: { type: 'integer' },
            nombre: { type: 'string' },
            series: {
              type: 'array',
              items: {
                type: 'object',
                properties: { reps: { type: 'integer' }, peso: { type: 'number', description: 'kg; 0 si es peso corporal' } },
                required: ['reps'],
                additionalProperties: false,
              },
            },
          },
          required: ['series'],
          additionalProperties: false,
        },
      },
    },
    ['titulo', 'ejercicios'],
  ),
];

/** Primer mensaje de error de zod, para que el modelo pueda corregir y reintentar. */
const firstIssue = (error) => error.issues?.map((i) => `${i.path.join('.') || 'datos'}: ${i.message}`).join('; ');

function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) throw new ToolError(firstIssue(result.error));
  return result.data;
}

class ToolError extends Error {}

const compactFood = (f) => ({
  foodId: f.id,
  nombre: f.brand ? `${f.name} (${f.brand})` : f.name,
  porcion: f.portionDescription || `${f.portionGrams} g`,
  porcionGramos: Number(f.portionGrams),
  kcal: Number(f.kcal),
  proteinas: Number(f.protein),
  carbohidratos: Number(f.carbs),
  grasas: Number(f.fat),
});

const HANDLERS = {
  async buscar_alimentos(user, { texto }) {
    const local = await foods.listFoods(user, { page: 1, limit: 6, search: String(texto ?? '').slice(0, 100), scope: 'all' });
    const results = local.data.map(compactFood);
    // Si el catálogo no alcanza, se suman productos envasados de Open Food Facts (se guardan al elegirlos).
    if (results.length < 3) {
      const external = await foods.searchExternal('openfoodfacts', String(texto), { limit: 4 }).catch(() => []);
      for (const item of external) {
        const saved = await foods.importExternal(user, 'openfoodfacts', item.externalId).catch(() => null);
        if (saved) results.push(compactFood(saved));
      }
    }
    return { resultados: results, nota: results.length ? undefined : 'Sin resultados: estimá los valores vos.' };
  },

  async registrar_comida(user, { comida, fecha, items }) {
    const saved = [];
    for (const item of items ?? []) {
      const body = parse(createEntrySchema, {
        date: fecha || today(),
        meal: comida,
        grams: item.gramos,
        foodId: item.foodId || undefined,
        name: item.nombre,
        kcal: item.kcal,
        protein: item.proteinas,
        carbs: item.carbohidratos,
        fat: item.grasas,
      });
      // Con foodId los macros los calcula el backend; el nombre se deja el del catálogo.
      if (body.foodId) delete body.name;
      const entry = await diary.createEntry(user, body);
      saved.push({ id: entry.id, nombre: entry.name, gramos: Number(entry.grams), kcal: Number(entry.kcal) });
    }
    return { ok: true, registrados: saved, action: { type: 'diary', date: fecha || today(), label: `${saved.length} ${saved.length === 1 ? 'comida registrada' : 'comidas registradas'} en ${comida}` } };
  },

  async crear_alimento(user, args) {
    const body = parse(foodSchema, {
      name: args.nombre,
      brand: args.marca || null,
      category: 'Mis alimentos',
      portionGrams: args.porcion_gramos,
      portionDescription: args.descripcion_porcion || null,
      barcode: args.codigo_barras || null,
      kcal: args.kcal,
      protein: args.proteinas,
      carbs: args.carbohidratos,
      fat: args.grasas,
    });
    const food = await foods.createFood(user, body);
    return { ok: true, alimento: compactFood(food), action: { type: 'food', label: `Alimento creado: ${food.name}` } };
  },

  async resumen_del_dia(user, { fecha }) {
    const day = await diary.getDay(user.id, fecha || today());
    return {
      fecha: day.date,
      totales: day.totals,
      objetivos: day.goals,
      registros: day.entries.map((e) => ({ comida: e.meal, nombre: e.name, gramos: Number(e.grams), kcal: Number(e.kcal) })),
    };
  },

  async buscar_ejercicios(_user, { texto, grupo_muscular: group }) {
    const where = [];
    const params = [];
    if (texto) {
      where.push('name LIKE ?');
      params.push(`%${String(texto).slice(0, 100)}%`);
    }
    if (group) {
      where.push('muscle_group = ?');
      params.push(String(group).slice(0, 40));
    }
    const rows = await query(`SELECT id, name, muscle_group, equipment FROM exercises ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY name LIMIT 25`, params);
    return { ejercicios: rows.map((r) => ({ exerciseId: r.id, nombre: r.name, grupo: r.muscle_group, equipamiento: r.equipment })) };
  },

  async crear_ejercicio(user, { nombre, grupo_muscular: group, equipamiento }) {
    if (!['coach', 'admin'].includes(user.role)) {
      throw new ToolError('Solo entrenadores y administradores pueden agregar ejercicios al catálogo. Ofrecé registrar el entrenamiento usando el nombre del ejercicio.');
    }
    const data = parse(
      z.object({ name: z.string().trim().min(2).max(120), muscleGroup: z.string().trim().min(2).max(40), equipment: z.string().trim().max(60).nullable() }),
      { name: nombre, muscleGroup: group, equipment: equipamiento || null },
    );
    const result = await query('INSERT INTO exercises (name, muscle_group, equipment) VALUES (?, ?, ?)', [data.name, data.muscleGroup, data.equipment]);
    return { ok: true, exerciseId: result.insertId, action: { type: 'exercise', label: `Ejercicio agregado: ${data.name}` } };
  },

  async registrar_entrenamiento(user, args) {
    const data = parse(workoutSchema, {
      date: args.fecha || today(),
      title: args.titulo,
      notes: args.notas || null,
      status: args.estado,
      exercises: (args.ejercicios ?? []).map((e) => ({
        exerciseId: e.exerciseId || undefined,
        name: e.nombre,
        sets: (e.series ?? []).map((s) => ({ reps: s.reps, weight: s.peso ?? 0 })),
      })),
    });
    if (data.date > today()) data.status = 'planned';
    const workout = await workouts.createWorkout(user.id, user.id, data);
    return {
      ok: true,
      workoutId: workout.id,
      action: { type: 'workout', id: workout.id, label: `Entrenamiento guardado: ${workout.title} (${workout.exercises.length} ejercicios)` },
    };
  },
};

/** Ejecuta una llamada del modelo. Los errores esperables se le devuelven como texto para que corrija. */
export async function runTool(user, name, rawArgs) {
  const handler = HANDLERS[name];
  if (!handler) return { error: `Herramienta desconocida: ${name}` };
  let args;
  try {
    args = JSON.parse(rawArgs || '{}');
  } catch {
    return { error: 'Los argumentos no son JSON válido' };
  }
  try {
    return await handler(user, args);
  } catch (err) {
    if (err instanceof ToolError || err.status) return { error: err.message };
    throw err;
  }
}
