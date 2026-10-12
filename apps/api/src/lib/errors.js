export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code || defaultCode(status);
  }
}

function defaultCode(status) {
  return (
    {
      400: 'bad_request',
      401: 'unauthorized',
      403: 'forbidden',
      404: 'not_found',
      409: 'conflict',
    }[status] || 'error'
  );
}

export const badRequest = (msg, code) => new HttpError(400, msg, code);
export const unauthorized = (msg = 'Please sign in to continue', code) => new HttpError(401, msg, code);
export const forbidden = (msg = 'You do not have access to this resource', code) => new HttpError(403, msg, code);
export const notFound = (msg = 'Not found', code) => new HttpError(404, msg, code);
export const conflict = (msg, code) => new HttpError(409, msg, code);
