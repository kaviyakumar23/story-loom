/**
 * Typed API errors. Thrown anywhere in a handler and translated to a JSON
 * `ApiError` body by the global error handler in src/index.ts.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  /** Client-safe context — e.g. zod issues, so a form can mark the field. */
  readonly details?: unknown;
  /** Diagnostics (DB messages, vendor errors). Logged, NEVER serialized. */
  readonly diagnostic?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown, diagnostic?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.diagnostic = diagnostic;
  }
}

export const badRequest = (msg: string, details?: unknown) =>
  new ApiError(400, 'bad_request', msg, details);

/**
 * Our fault, not the caller's — a failed write, a broken dependency. The cause
 * is attached for logs only: raw Postgres text names tables, columns and
 * constraints, and belongs nowhere near a client.
 */
export const internal = (msg: string, diagnostic?: unknown) =>
  new ApiError(500, 'internal', msg, undefined, diagnostic);
export const unauthorized = (msg = 'Authentication required') =>
  new ApiError(401, 'unauthorized', msg);
export const forbidden = (msg = 'Not permitted') => new ApiError(403, 'forbidden', msg);
export const notFound = (msg = 'Not found') => new ApiError(404, 'not_found', msg);
export const conflict = (msg: string) => new ApiError(409, 'conflict', msg);
