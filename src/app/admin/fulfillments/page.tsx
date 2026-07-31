'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminShell, btn, btnPrimary, card, input, note, pill, useAdminToken } from '../admin-shell';

/** Founder-only fulfilment queue. Chrome and auth live in ../admin-shell. */
interface Fulfillment {
  id: string;
  status: string;
  carrier: string | null;
  tracking_number: string | null;
  created_at: string;
  notes: string | null;
  printMasterUrl: string | null;
  /** Hash of the master on record — the release has to name the exact file. */
  print_master_sha256?: string | null;
  open_exception?: string | null;
  preflight?: { ok: boolean; lowestPpi: number | null } | null;
  book: { title: string | null } | null;
  order: { tier: string; amount: number; currency: string } | null;
  address: {
    recipient_name: string; phone: string; line1: string; line2: string | null;
    city: string; state: string; postal_code: string; country: string; notes: string | null;
  } | null;
}

const badge: Record<string, string> = {
  qc_pending: '#8A66C6', qc_hold: '#b23b3b', print_ready: '#5653C6',
  printing: '#DDA23A', shipped: '#2f8f5b', delivered: '#6b7280', cancelled: '#b23b3b',
};

export default function FulfillmentQueue() {
  const { token, ready, save, clear, authed } = useAdminToken();
  const [items, setItems] = useState<Fulfillment[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const data = await authed<{ fulfillments: Fulfillment[] }>(`/api/v1/admin/fulfillments${showAll ? '?all=1' : ''}`);
      setItems(data.fulfillments);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [token, showAll, authed]);

  useEffect(() => { if (ready && token) void load(); }, [ready, token, showAll, load]);

  const call = async (id: string, path: string, init: RequestInit) => {
    setBusy(id);
    setError('');
    try {
      await authed(path, init);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(null);
    }
  };
  const patch = (id: string, body: Record<string, unknown>) =>
    call(id, `/api/v1/admin/fulfillments/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  /** Releasing names the exact file, so approving one version cannot send another. */
  const release = (id: string, sha256: string) =>
    call(id, `/api/v1/admin/fulfillments/${id}`, {
      method: 'POST',
      body: JSON.stringify({ sha256, reviewer: 'founder' }),
    });
  const exception = (id: string, body: Record<string, unknown>) =>
    call(id, `/api/v1/admin/fulfillments/${id}/exception`, { method: 'POST', body: JSON.stringify(body) });

  if (!ready) return null;

  return (
    <AdminShell
      title="Fulfilment queue"
      count={token ? items.length : undefined}
      token={token}
      onToken={save}
      onSignOut={clear}
      error={error}
      actions={
        <>
          <label style={{ fontSize: 13 }}><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> show delivered/cancelled</label>
          <button style={btn} onClick={() => void load()}>Refresh</button>
        </>
      }
    >
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
              {f.preflight && (
                <> · preflight {f.preflight.ok ? 'passed' : 'FAILED'}
                  {f.preflight.lowestPpi != null && ` (lowest ${f.preflight.lowestPpi} PPI)`}
                </>
              )}
            </div>

            {f.address ? (
              <div style={note}>
                <div style={{ fontWeight: 700 }}>{f.address.recipient_name} · {f.address.phone}</div>
                <div>{f.address.line1}{f.address.line2 ? `, ${f.address.line2}` : ''}</div>
                <div>{f.address.city}, {f.address.state} {f.address.postal_code}, {f.address.country}</div>
                {f.address.notes && <div style={{ color: '#666', fontStyle: 'italic' }}>Note: {f.address.notes}</div>}
              </div>
            ) : <div style={{ ...note, color: '#b23b3b' }}>No shipping address on file</div>}

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
              {f.printMasterUrl
                ? <a href={f.printMasterUrl} target="_blank" rel="noreferrer" style={{ ...btn, textDecoration: 'none', color: '#5653C6' }}>⬇ Print master (PDF)</a>
                : <span style={{ fontSize: 13, color: '#b23b3b' }}>PDF not ready</span>}
              <Actions
                f={f}
                busy={busy === f.id}
                onPatch={(b) => void patch(f.id, b)}
                onRelease={() => f.print_master_sha256 && void release(f.id, f.print_master_sha256)}
                onException={(b) => void exception(f.id, b)}
              />
            </div>
            {f.open_exception && (
              <div style={{ marginTop: 8, fontSize: 13, color: '#b23b3b' }}>
                Open exception: <strong>{f.open_exception}</strong>
              </div>
            )}
          </div>
        ))}
      </div>
    </AdminShell>
  );
}

function Actions({ f, busy, onPatch, onRelease, onException }: {
  f: Fulfillment;
  busy: boolean;
  onPatch: (b: Record<string, unknown>) => void;
  onRelease: () => void;
  onException: (b: Record<string, unknown>) => void;
}) {
  const [carrier, setCarrier] = useState(f.carrier ?? '');
  const [tracking, setTracking] = useState(f.tracking_number ?? '');
  const [qcNotes, setQcNotes] = useState('');
  if (busy) return <span style={{ fontSize: 13, color: '#888' }}>saving…</span>;

  // QC: somebody reads the book before it becomes a physical object.
  if (f.status === 'qc_pending' || f.status === 'qc_hold') {
    return (
      <>
        <input placeholder="QC notes" value={qcNotes} onChange={(e) => setQcNotes(e.target.value)} style={{ ...input, width: 220 }} />
        <button style={btnPrimary} onClick={() => onPatch({ status: 'print_ready', qcNotes })}>QC pass</button>
        {f.status === 'qc_pending' && (
          <button style={btn} onClick={() => onPatch({ status: 'qc_hold', qcNotes })}>Hold</button>
        )}
        <button style={{ ...btn, color: '#b23b3b' }} onClick={() => onPatch({ status: 'cancelled' })}>Cancel</button>
      </>
    );
  }
  if (f.status === 'print_ready') {
    return (
      <>
        <button style={btnPrimary} disabled={!f.print_master_sha256} onClick={onRelease}>
          Release to print
        </button>
        <span style={{ fontSize: 12, color: '#888' }}>
          {f.print_master_sha256 ? `file ${f.print_master_sha256.slice(0, 12)}…` : 'no master on record'}
        </span>
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
        <button style={btn} onClick={() => onException({ type: 'reprint', fault: 'printer' })}>Reprint</button>
        <button style={{ ...btn, color: '#b23b3b' }} onClick={() => onPatch({ status: 'cancelled' })}>Cancel</button>
      </>
    );
  }
  // Shipped is where reality gets untidy: returned, lost, sent again. Those are
  // recorded alongside the status rather than overwriting it.
  if (f.status === 'shipped') {
    return (
      <>
        <button style={btnPrimary} onClick={() => onPatch({ status: 'delivered' })}>Mark delivered</button>
        <button style={btn} onClick={() => onException({ type: 'rto', fault: 'carrier' })}>RTO</button>
        <button style={btn} onClick={() => onException({ type: 'lost', fault: 'carrier' })}>Lost</button>
        <input placeholder="new tracking #" value={tracking} onChange={(e) => setTracking(e.target.value)} style={input} />
        <button style={btn} disabled={!tracking.trim()} onClick={() => onException({ type: 'reship', trackingNumber: tracking, fault: 'carrier' })}>Reship</button>
      </>
    );
  }
  return null;
}

