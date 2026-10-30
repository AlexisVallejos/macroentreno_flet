/**
 * Validaciones de formularios del lado del cliente. Devuelven un objeto
 * { campo: 'mensaje' } que se muestra debajo de cada input. El backend vuelve a validar.
 */

// Mismas reglas que el backend (backend/src/utils/validation.js).
export const EMAIL_MAX = 190;
export const NAME_MAX = 100;
export const PASSWORD_MAX = 72;

// Misma expresión que usa zod (z.email) en el servidor: solo caracteres ASCII y dominio con extensión de 2+ letras.
const EMAIL_RE = /^(?:[A-Za-z0-9_'+\-]+\.)*[A-Za-z0-9_'+\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
const utf8Bytes = (v) => new TextEncoder().encode(v).length;

export const isEmail = (v) => {
  const email = typeof v === 'string' ? v.trim() : '';
  return email.length <= EMAIL_MAX && EMAIL_RE.test(email);
};

export function validateEmail(email) {
  if (typeof email === 'string' && email.trim().length > EMAIL_MAX) return `Máximo ${EMAIL_MAX} caracteres`;
  return isEmail(email) ? null : 'Ingresá un email válido';
}

export function validateName(name) {
  const value = typeof name === 'string' ? name.trim() : '';
  if (value.length < 2) return 'Ingresá tu nombre';
  if (value.length > NAME_MAX) return `Máximo ${NAME_MAX} caracteres`;
  if (/[\p{Cc}\p{Cf}]/u.test(value)) return 'El nombre tiene caracteres no permitidos';
  if (!/\p{L}/u.test(value)) return 'El nombre debe tener letras';
  return null;
}

export function validateLogin({ email, password }) {
  const errors = {};
  const mail = validateEmail(email);
  if (mail) errors.email = mail;
  if (typeof password !== 'string' || !password) errors.password = 'Ingresá tu contraseña';
  else if (utf8Bytes(password) > PASSWORD_MAX) errors.password = `Máximo ${PASSWORD_MAX} caracteres`;
  return errors;
}

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8) return 'Mínimo 8 caracteres';
  if (password.length > PASSWORD_MAX) return `Máximo ${PASSWORD_MAX} caracteres`;
  // bcrypt usa 72 bytes: tildes, ñ y emojis ocupan más de uno.
  if (utf8Bytes(password) > PASSWORD_MAX) return 'Es muy larga: las tildes, la ñ y los emojis ocupan más espacio';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Debe tener letras y números';
  return null;
}

export function validateRegister({ name, email, password, confirm }) {
  const errors = {};
  const nameError = validateName(name);
  if (nameError) errors.name = nameError;
  const mail = validateEmail(email);
  if (mail) errors.email = mail;
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
