'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';

/**
 * Shared chrome for the founder-only admin pages.
 *
 * Auth is the ADMIN_API_SECRET bearer token, held in localStorage and sent on
 * every request — these pages never hand the secret to anything else. Internal
 * tooling: the styling is deliberately plain, and lives here so the queues stay
 * consistent as more of them appear.
 */
const TOKEN_KEY = 'moonbell_admin_token';

const PAGES = [
  { href: '/admin/fulfillments', label: 'Fulfilment' },
  { href: '/admin/corrections', label: 'Corrections' },
];

export function useAdminToken() {
  const [token, setToken] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setToken(localStorage.getItem(TOKEN_KEY) ?? '');
    setReady(true);
  }, []);

  const save = useCallback((t: string) => {
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
  }, []);
  const clear = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken('');
  }, []);

  /** fetch with the admin bearer attached, and errors already unwrapped. */
  const authed = useCallback(
    async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
      const res = await fetch(path, {
        ...init,
        headers: {
          ...(init.headers ?? {}),
          authorization: `Bearer ${token}`,
          ...(init.body ? { 'content-type': 'application/json' } : {}),
        },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? (res.status === 403 ? 'Invalid admin token' : `Error ${res.status}`));
      }
      return (await res.json()) as T;
    },
    [token],
  );

  return { token, ready, save, clear, authed };
}

export function AdminShell({
  title,
  count,
  actions,
  error,
  token,
  onToken,
  onSignOut,
  children,
}: {
  title: string;
  count?: number;
  actions?: ReactNode;
  error?: string;
  token: string;
  onToken: (t: string) => void;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const pathname = usePathname();

  if (!token) {
    return (
      <main style={wrap}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>{title}</h1>
        <p style={{ color: '#555', marginTop: 8 }}>Enter the admin token to continue.</p>
        <TokenForm onSet={onToken} />
      </main>
    );
  }

  return (
    <main style={wrap}>
      <nav style={{ display: 'flex', gap: 14, marginBottom: 18, fontSize: 13 }}>
        {PAGES.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            style={{ fontWeight: pathname === p.href ? 700 : 500, color: pathname === p.href ? '#5653C6' : '#666' }}
          >
            {p.label}
          </Link>
        ))}
      </nav>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>
          {title} {count !== undefined && <span style={{ color: '#888', fontWeight: 500 }}>({count})</span>}
        </h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {actions}
          <button style={{ ...btn, color: '#b23b3b' }} onClick={onSignOut}>Sign out</button>
        </div>
      </div>
      {error && <p style={{ color: '#b23b3b', marginTop: 12 }}>{error}</p>}
      {children}
    </main>
  );
}

function TokenForm({ onSet }: { onSet: (t: string) => void }) {
  const [v, setV] = useState('');
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (v.trim()) onSet(v.trim()); }} style={{ marginTop: 16, display: 'flex', gap: 8 }}>
      <input type="password" placeholder="ADMIN_API_SECRET" value={v} onChange={(e) => setV(e.target.value)} style={{ ...input, minWidth: 280 }} />
      <button type="submit" style={btnPrimary}>Enter</button>
    </form>
  );
}

export const wrap: CSSProperties = { maxWidth: 820, margin: '0 auto', padding: '40px 20px', fontFamily: 'system-ui, sans-serif' };
export const card: CSSProperties = { border: '1px solid #e4e2f5', borderRadius: 12, padding: 16, background: '#fff' };
export const note: CSSProperties = { marginTop: 10, fontSize: 14, lineHeight: 1.5, background: '#f7f6fd', borderRadius: 8, padding: '10px 12px' };
export const pill: CSSProperties = { color: '#fff', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, textTransform: 'capitalize', height: 'fit-content' };
export const btn: CSSProperties = { border: '1px solid #d7d5ea', background: '#fff', borderRadius: 8, padding: '7px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
export const btnPrimary: CSSProperties = { ...btn, background: '#5653C6', color: '#fff', border: 'none' };
export const input: CSSProperties = { border: '1px solid #d7d5ea', borderRadius: 8, padding: '7px 10px', fontSize: 13, width: 120 };
