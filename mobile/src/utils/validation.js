/**
 * Validaciones de formularios del lado del cliente. Devuelven un objeto
 * { campo: 'mensaje' } que se muestra debajo de cada input. El backend vuelve a validar.
 */
export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());

export function validateLogin({ email, password }) {
  const errors = {};
  if (!isEmail(email)) errors.email = 'Ingresá un email válido';
  if (!password) errors.password = 'Ingresá tu contraseña';
  return errors;
}

export function validatePassword(password) {
  if (!password || password.length < 8) return 'Mínimo 8 caracteres';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Debe tener letras y números';
  return null;
}

export function validateRegister({ name, email, password, confirm }) {
  const errors = {};
  if (!name || name.trim().length < 2) errors.name = 'Ingresá tu nombre';
  if (!isEmail(email)) errors.email = 'Ingresá un email válido';
  const pwd = validatePassword(password);
  if (pwd) errors.password = pwd;
  if (password !== confirm) errors.confirm = 'Las contraseñas no coinciden';
  return errors;
}

/** Valida que los campos sean números >= 0. `required` lista los obligatorios. */
export function validateNumbers(values, fields, { required = fields, positive = [] } = {}) {
  const errors = {};
  for (const field of fields) {
    const raw = values[field];
    if (raw === '' || raw === undefined || raw === null) {
      if (required.includes(field)) errors[field] = 'Requerido';
      continue;
    }
    const n = Number(String(raw).replace(',', '.'));
    if (Number.isNaN(n)) errors[field] = 'Debe ser un número';
    else if (n < 0) errors[field] = 'No puede ser negativo';
    else if (positive.includes(field) && n === 0) errors[field] = 'Debe ser mayor a 0';
  }
  return errors;
}

export const toNumber = (v) => (v === '' || v === undefined || v === null ? undefined : Number(String(v).replace(',', '.')));
