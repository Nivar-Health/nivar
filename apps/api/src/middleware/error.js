import mongoose from 'mongoose';
import { HttpError } from '../lib/errors.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { message: `No route for ${req.method} ${req.path}`, code: 'not_found' } });
}

export function errorHandler(err, req, res, _next) {
  let status = 500;
  let message = 'Something went wrong';
  let code = 'internal_error';

  if (err instanceof HttpError) {
    ({ status, message, code } = err);
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON body';
    code = 'bad_json';
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join('; ');
    code = 'validation_error';
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Invalid value for ${err.path}`;
    code = 'bad_request';
  } else if (err?.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || err.keyPattern || {})[0] || 'value';
    message = `That ${field} is already in use`;
    code = 'duplicate';
  } else if (typeof err?.status === 'number' && err.status >= 400 && err.status < 500) {
    status = err.status;
    message = err.message;
    code = 'bad_request';
  }

  if (status >= 500 && process.env.NODE_ENV !== 'test') console.error(err);
  res.status(status).json({ error: { message, code } });
}
