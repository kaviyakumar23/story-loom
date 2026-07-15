import { ApiError } from './errors';
import { captureError } from './observability';

/** Turn a thrown error into the standard JSON ApiError response. */
export function jsonError(err: unknown): Response {
  if (err instanceof ApiError) {
    // `diagnostic` stays server-side by construction — only `details` ships.
    if (err.diagnostic !== undefined) {
      captureError(err, { code: err.code, diagnostic: err.diagnostic });
    }
    return Response.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status: err.statusCode },
    );
  }
  captureError(err);
  // eslint-disable-next-line no-console
  console.error('unhandled route error', err);
  return Response.json({ error: { code: 'internal', message: 'Internal server error' } }, { status: 500 });
}

/** Parse a JSON request body, tolerating empty bodies. */
export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  return text ? JSON.parse(text) : {};
}
