'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminShell, btn, btnPrimary, card, note, useAdminToken } from '../admin-shell';

/**
 * The correction queue. A parent gets one change per book and it waits here for
 * a human — for a printed run this is the last point where a mistake is still
 * cheap to fix. Approving is what starts the regeneration.
 */
interface Correction {
  id: string;
  bookId: string;
  bookTitle: string | null;
  goal: string | null;
  readingLevel: string | null;
  instruction: string;
  requestedAt: string;
}

export default function CorrectionQueue() {
  const { token, ready, save, clear, authed } = useAdminToken();
  const [items, setItems] = useState<Correction[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const data = await authed<{ corrections: Correction[] }>('/api/v1/admin/corrections');
      setItems(data.corrections);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, [token, authed]);

  useEffect(() => { if (ready && token) void load(); }, [ready, token, load]);

  const decide = async (id: string, decision: 'approve' | 'reject') => {
    setBusy(id);
    setError('');
    try {
      await authed(`/api/v1/admin/corrections/${id}`, {
        method: 'POST',
        body: JSON.stringify({ decision, note: notes[id]?.trim() || undefined }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(null);
    }
  };

  if (!ready) return null;

  return (
    <AdminShell
      title="Corrections"
      count={token ? items.length : undefined}
      token={token}
      onToken={save}
      onSignOut={clear}
      error={error}
      actions={<button style={btn} onClick={() => void load()}>Refresh</button>}
    >
      {items.length === 0 && <p style={{ color: '#666', marginTop: 24 }}>Nothing waiting for review. 🎉</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>
        {items.map((c) => (
          <div key={c.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 16 }}>{c.bookTitle ?? 'Untitled book'}</strong>
              <span style={{ fontSize: 13, color: '#666' }}>{new Date(c.requestedAt).toLocaleString()}</span>
            </div>
            <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
              {[c.goal, c.readingLevel].filter(Boolean).join(' · ') || '—'}
            </div>

            <div style={note}>“{c.instruction}”</div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
              <input
                placeholder="note to the parent (optional)"
                value={notes[c.id] ?? ''}
                onChange={(e) => setNotes({ ...notes, [c.id]: e.target.value })}
                style={{ border: '1px solid #d7d5ea', borderRadius: 8, padding: '7px 10px', fontSize: 13, flex: 1, minWidth: 200 }}
              />
              {busy === c.id ? (
                <span style={{ fontSize: 13, color: '#888' }}>saving…</span>
              ) : (
                <>
                  <button style={btnPrimary} onClick={() => void decide(c.id, 'approve')}>Approve &amp; rebuild</button>
                  <button style={{ ...btn, color: '#b23b3b' }} onClick={() => void decide(c.id, 'reject')}>Decline</button>
                </>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
              Approving regenerates the whole preview — cover and first three pages included.
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
