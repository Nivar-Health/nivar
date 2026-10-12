import { badRequest } from '../lib/errors.js';

function formatIssues(error) {
  return error.issues
    .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
    .join('; ');
}

/** Validate req[source] against a zod schema, replacing it with the parsed value (stored on req.valid). */
export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) throw badRequest(formatIssues(result.error), 'validation_error');
    req.valid = { ...(req.valid || {}), [source]: result.data };
    next();
  };
}
