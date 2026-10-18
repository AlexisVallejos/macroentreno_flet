/**
 * Valida y normaliza req.body / req.query / req.params con esquemas zod.
 * Los valores ya parseados quedan en req.valid.{body,query,params}.
 */
export function validate(schemas) {
  return (req, _res, next) => {
    req.valid = {};
    for (const part of ['params', 'query', 'body']) {
      if (schemas[part]) req.valid[part] = schemas[part].parse(req[part] ?? {});
    }
    next();
  };
}
