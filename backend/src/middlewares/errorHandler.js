import { ZodError } from 'zod';
import { HttpError } from '../utils/httpError.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Ruta no encontrada: ${req.method} ${req.path}` } });
}

/** Convierte cualquier error en una respuesta JSON uniforme: { error: { code, message, details? } } */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Hay datos inválidos en la solicitud',
        details: err.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
      },
    });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'El cuerpo no es un JSON válido' } });
  }
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: { code: 'CONFLICT', message: 'Ya existe un registro con esos datos' } });
  }
  if (err.code === 'ECONNREFUSED' || err.code === 'ER_ACCESS_DENIED_ERROR' || err.code === 'ER_BAD_DB_ERROR') {
    console.error('[db]', err.message);
    return res.status(503).json({ error: { code: 'DB_UNAVAILABLE', message: 'La base de datos no está disponible' } });
  }
  console.error(err);
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } });
}
