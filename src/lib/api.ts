'use client';

import { supabase } from './supabase';

/**
 * Backend API client. Attaches the parent's Supabase access token as a bearer
 * on every request (the backend authenticates with it and owner-scopes data).
 * Throws ApiError on non-2xx so callers can show the backend's message.
 */
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1';

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
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json', ...opts.headers };

  if (!opts.anon) {
    const { data } = await supabase().auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const err = json?.error ?? {};
    throw new ApiError(res.status, err.code ?? 'error', err.message ?? `Request failed (${res.status})`);
  }
  return json as T;
}
