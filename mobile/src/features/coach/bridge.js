// Puente entre el formulario de sesión y el entrenador con cámara: el formulario deja un callback y le pasa el id
// a la pantalla de la cámara por parámetro; al terminar, la cámara le devuelve las series contadas y vuelve atrás.
// Vive en memoria: si se recarga la página, el pedido se pierde y la cámara ofrece guardar la sesión por su cuenta.

const waiting = new Map();
let seq = 0;

/** Registra quién espera el resultado y devuelve el id para pasarle a la pantalla de la cámara. */
export function requestCoach(onResult) {
  const id = `coach-${Date.now()}-${++seq}`;
  waiting.set(id, onResult);
  return id;
}

export const hasCoachRequest = (id) => Boolean(id) && waiting.has(id);

/** Entrega el resultado ({ ruleId, mode, sets: [número por serie] }) a quien lo pidió. */
export function resolveCoach(id, result) {
  const onResult = waiting.get(id);
  waiting.delete(id);
  onResult?.(result);
  return Boolean(onResult);
}
