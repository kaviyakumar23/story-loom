'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';

/**
 * Founder-only fulfilment queue. Auth is the ADMIN_API_SECRET bearer token,
 * kept in localStorage and sent on every request — this page never ships the
 * secret to any third party. Internal tool: styling is deliberately minimal.
 */
interface Fulfillment {
  id: string;
  status: string;
  carrier: string | null;
  tracking_number: string | null;
  created_at: string;
  notes: string | null;
  printMasterUrl: string | null;
  book: { title: string | null } | null;
  order: { tier: string; amount: number; currency: string } | null;
  address: {
    recipient_name: string; phone: string; line1: string; line2: string | null;
    city: string; state: string; postal_code: string; country: string; notes: string | null;
  } | null;
}

const TOKEN_KEY = 'moonbell_admin_token';
const badge: Record<string, string> = {
  print_ready: '#5653C6', printing: '#DDA23A', shipped: '#2f8f5b', delivered: '#6b7280', cancelled: '#b23b3b',
};

export default function FulfillmentQueue() {
  const [token, setToken] = useState('');
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<Fulfillment[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY) ?? '';
    setToken(t);
    setReady(true);
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const res = await fetch(`/api/v1/admin/fulfillments${showAll ? '?all=1' : ''}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(res.status === 403 ? 'Invalid admin token' : `Error ${res.status}`);
      const data = (await res.json()) as { fulfillments: Fulfillment[] };
      setItems(data.fulfillments);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [token, showAll]);

  useEffect(() => { if (ready && token) void load(); }, [ready, token, showAll, load]);

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusy(id);
    setError('');
    try {
      const res = await fetch(`/api/v1/admin/fulfillments/${id}`, {
        method: 'PATCH',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        throw new Error((msg as { error?: { message?: string } }).error?.message ?? `Error ${res.status}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(null);
    }
  };

  if (!ready) return null;

  if (!token) {
    return (
      <main style={wrap}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Fulfilment queue</h1>
        <p style={{ color: '#555', marginTop: 8 }}>Enter the admin token to continue.</p>
        <TokenForm onSet={(t) => { localStorage.setItem(TOKEN_KEY, t); setToken(t); }} />
      </main>
    );
  }

  return (
    <main style={wrap}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Fulfilment queue <span style={{ color: '#888', fontWeight: 500 }}>({items.length})</span></h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <label style={{ fontSize: 13 }}><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> show delivered/cancelled</label>
          <button style={btn} onClick={() => void load()}>Refresh</button>
          <button style={{ ...btn, color: '#b23b3b' }} onClick={() => { localStorage.removeItem(TOKEN_KEY); setToken(''); }}>Sign out</button>
        </div>
      </div>
      {error && <p style={{ color: '#b23b3b', marginTop: 12 }}>{error}</p>}
      {items.length === 0 && <p style={{ color: '#666', marginTop: 24 }}>No open orders. 🎉</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>
        {items.map((f) => (
          <div key={f.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 16 }}>{f.book?.title ?? 'Untitled book'}</strong>
              <span style={{ ...pill, background: badge[f.status] ?? '#888' }}>{f.status.replace('_', ' ')}</span>
            </div>
            <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
              {f.order ? `${f.order.tier} · ₹${(f.order.amount / 100).toFixed(0)}` : '—'} · ordered {new Date(f.created_at).toLocaleDateString()}
            </div>

            {f.address ? (
              <div style={addr}>
                <div style={{ fontWeight: 700 }}>{f.address.recipient_name} · {f.address.phone}</div>
                <div>{f.address.line1}{f.address.line2 ? `, ${f.address.line2}` : ''}</div>
                <div>{f.address.city}, {f.address.state} {f.address.postal_code}, {f.address.country}</div>
                {f.address.notes && <div style={{ color: '#666', fontStyle: 'italic' }}>Note: {f.address.notes}</div>}
              </div>
            ) : <div style={{ ...addr, color: '#b23b3b' }}>No shipping address on file</div>}

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
              {f.printMasterUrl
                ? <a href={f.printMasterUrl} target="_blank" rel="noreferrer" style={{ ...btn, textDecoration: 'none', color: '#5653C6' }}>⬇ Print master (PDF)</a>
                : <span style={{ fontSize: 13, color: '#b23b3b' }}>PDF not ready</span>}
              <Actions f={f} busy={busy === f.id} onPatch={(b) => patch(f.id, b)} />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

function Actions({ f, busy, onPatch }: { f: Fulfillment; busy: boolean; onPatch: (b: Record<string, unknown>) => void }) {
  const [carrier, setCarrier] = useState(f.carrier ?? '');
  const [tracking, setTracking] = useState(f.tracking_number ?? '');
  if (busy) return <span style={{ fontSize: 13, color: '#888' }}>saving…</span>;

  if (f.status === 'print_ready') {
    return (
      <>
        <button style={btnPrimary} onClick={() => onPatch({ status: 'printing' })}>Mark printing</button>
        <button style={{ ...btn, color: '#b23b3b' }} onClick={() => onPatch({ status: 'cancelled' })}>Cancel</button>
      </>
    );
  }
  if (f.status === 'printing') {
    return (
      <>
        <input placeholder="carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} style={input} />
        <input placeholder="tracking #" value={tracking} onChange={(e) => setTracking(e.target.value)} style={input} />
        <button style={btnPrimary} disabled={!tracking.trim()} onClick={() => onPatch({ status: 'shipped', carrier, trackingNumber: tracking })}>Mark shipped</button>
        <button style={{ ...btn, color: '#b23b3b' }} onClick={() => onPatch({ status: 'cancelled' })}>Cancel</button>
      </>
    );
  }
  if (f.status === 'shipped') {
    return <button style={btnPrimary} onClick={() => onPatch({ status: 'delivered' })}>Mark delivered</button>;
  }
  return null;
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

const wrap: CSSProperties = { maxWidth: 820, margin: '0 auto', padding: '40px 20px', fontFamily: 'system-ui, sans-serif' };
const card: CSSProperties = { border: '1px solid #e4e2f5', borderRadius: 12, padding: 16, background: '#fff' };
const addr: CSSProperties = { marginTop: 10, fontSize: 14, lineHeight: 1.5, background: '#f7f6fd', borderRadius: 8, padding: '10px 12px' };
const pill: CSSProperties = { color: '#fff', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, textTransform: 'capitalize', height: 'fit-content' };
const btn: CSSProperties = { border: '1px solid #d7d5ea', background: '#fff', borderRadius: 8, padding: '7px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const btnPrimary: CSSProperties = { ...btn, background: '#5653C6', color: '#fff', border: 'none' };
const input: CSSProperties = { border: '1px solid #d7d5ea', borderRadius: 8, padding: '7px 10px', fontSize: 13, width: 120 };
