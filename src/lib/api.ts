'use client';

import { supabase } from './supabase';

/**
 * Backend API client. Attaches the parent's Supabase access token as a bearer
 * on every request (the backend authenticates with it and owner-scopes data).
 * Throws ApiError on non-2xx so callers can show the backend's message.
 */
// Same-origin now that the API lives in this Next app (no CORS). An override is
// kept for flexibility (e.g. pointing at a separate backend), defaulting to the
// app's own /api/v1.
const BASE = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface Options {
  method?: string;
  body?: unknown;
  /** Extra headers (e.g. Idempotency-Key). */
  headers?: Record<string, string>;
  /** Skip auth (none of our endpoints need this, but kept for flexibility). */
  anon?: boolean;
  /** Abort in-flight work, e.g. on unmount. */
  signal?: AbortSignal;
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json', ...opts.headers };

  if (!opts.anon) {
    const { data } = await supabase().auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (e) {
    // Offline, DNS, aborted… Callers branch on ApiError, so a bare TypeError
    // here would slip past every one of those checks.
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiError(0, 'network', 'Network problem. Please check your connection and try again.');
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  // A proxy 502 or an auth redirect returns HTML, not JSON. Parsing that used to
  // throw SyntaxError — which is not an ApiError, so every `instanceof ApiError`
  // branch silently degraded to a generic message.
  let json: unknown = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      if (!res.ok) {
        throw new ApiError(res.status, 'error', `Request failed (${res.status}). Please try again.`);
      }
      throw new ApiError(res.status, 'bad_response', 'Unexpected response from the server.');
    }
  }

  if (!res.ok) {
    const err = (json as { error?: { code?: string; message?: string } })?.error ?? {};
    throw new ApiError(res.status, err.code ?? 'error', err.message ?? `Request failed (${res.status})`);
  }
  return json as T;
}
