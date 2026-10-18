/** Error con código HTTP y código de negocio, lo traduce el errorHandler. */
export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) => new HttpError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'No autenticado', code = 'UNAUTHORIZED') =>
  new HttpError(401, code, message);
export const forbidden = (message = 'No tenés permisos para esta acción') =>
  new HttpError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Recurso no encontrado') => new HttpError(404, 'NOT_FOUND', message);
export const conflict = (message) => new HttpError(409, 'CONFLICT', message);
