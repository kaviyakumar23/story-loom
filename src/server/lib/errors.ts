/**
 * Typed API errors. Thrown anywhere in a handler and translated to a JSON
 * `ApiError` body by the global error handler in src/index.ts.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (msg: string, details?: unknown) =>
  new ApiError(400, 'bad_request', msg, details);
export const unauthorized = (msg = 'Authentication required') =>
  new ApiError(401, 'unauthorized', msg);
export const forbidden = (msg = 'Not permitted') => new ApiError(403, 'forbidden', msg);
export const notFound = (msg = 'Not found') => new ApiError(404, 'not_found', msg);
export const conflict = (msg: string) => new ApiError(409, 'conflict', msg);
