'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Header } from '@/components/chrome';
import { Icon, Sparkle } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { openCheckout } from '@/lib/razorpay';
import {
  TIER_META,
  TIER_ORDER,
  type Book,
  type CreateOrderResponse,
  type Tier,
} from '@/lib/types';

const POLL_MS = 2500;

export default function BookPage() {
  const { ready } = useRequireAuth();
  const { session } = useAuth();
  const params = useParams<{ id: string }>();
  const bookId = params.id;

  const [book, setBook] = useState<Book | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tier, setTier] = useState<Tier>('pdf');
  const [paying, setPaying] = useState(false);
  const [awaitingPayment, setAwaitingPayment] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const b = await api<Book>(`/books/${bookId}`);
      setBook(b);
      return b;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load this book.');
      return null;
    }
  }, [bookId]);

  // Poll while the book is actively progressing (generating, or after payment).
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const tick = async () => {
      const b = await load();
      const polling = b && (b.status === 'generating' || b.status === 'paid' || (awaitingPayment && b.status === 'preview_ready'));
      if (!cancelled && polling) timer.current = setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [ready, load, awaitingPayment]);

  async function buy() {
    setPaying(true);
    setError(null);
    try {
      const order = await api<CreateOrderResponse>('/payments/order', { method: 'POST', body: { bookId, tier } });
      await openCheckout(order, {
        email: session?.user?.email ?? undefined,
        onPaid: () => setAwaitingPayment(true),
        onDismiss: () => setPaying(false),
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not start checkout.');
      setPaying(false);
    }
  }

  if (!ready || (!book && !error)) {
    return (
      <div className="web" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <span className="spinner spinner-brand" style={{ width: 28, height: 28 }} />
      </div>
    );
  }

  return (
    <div className="web" style={{ minHeight: '100vh' }}>
      <Header minimal />
      <div className="container" style={{ padding: '40px 40px 80px' }}>
        {error && <p style={{ color: 'var(--error)', marginBottom: 16 }}>{error}</p>}
        {book && book.status === 'generating' && <Generating book={book} />}
        {book && book.status === 'failed' && <Failed />}
        {book && (book.status === 'preview_ready' || ((book.status === 'paid' || book.status === 'complete') && !book.pdfUrl)) && book.status !== 'complete' && (
          <Preview book={book} tier={tier} setTier={setTier} onBuy={buy} paying={paying || awaitingPayment} awaiting={awaitingPayment || book.status === 'paid'} />
        )}
        {book && book.status === 'complete' && <Delivered book={book} />}
      </div>
    </div>
  );
}

function Generating({ book }: { book: Book }) {
  return (
    <div style={{ maxWidth: 560, margin: '40px auto', textAlign: 'center' }}>
      <div style={{ animation: 'floaty 3s ease-in-out infinite', marginBottom: 20 }}>
        <Sparkle size={48} color="var(--brand)" />
      </div>
      <h1 className="display" style={{ fontSize: 34, marginBottom: 10 }}>Weaving the story…</h1>
      <p className="d-lead" style={{ color: 'var(--ink-soft)' }}>Crafting characters and painting the first pages. This takes a minute or two.</p>
      <div style={{ height: 12, borderRadius: 999, background: 'var(--bg-2)', marginTop: 28, overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(5, book.progress)}%`, height: '100%', background: 'var(--coral)', transition: 'width .6s ease' }} />
      </div>
      <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 10 }}>{book.progress}%</p>
    </div>
  );
}

function Preview({ book, tier, setTier, onBuy, paying, awaiting }: {
  book: Book; tier: Tier; setTier: (t: Tier) => void; onBuy: () => void; paying: boolean; awaiting: boolean;
}) {
  const pages = book.preview?.pages ?? [];
  const [page, setPage] = useState(0);
  const current = pages[Math.min(page, pages.length - 1)];

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <span className="eyebrow" style={{ justifyContent: 'center' }}><Sparkle size={13} /> Your free preview is ready</span>
        <h1 className="display" style={{ fontSize: 40, margin: '12px 0 6px', lineHeight: 1.05 }}>
          {book.title ?? 'Their Big Adventure'}
        </h1>
        {book.theme && <p className="d-lead" style={{ color: 'var(--ink-soft)' }}>{book.theme}</p>}
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '1.5fr 1fr', alignItems: 'start', gap: 48 }}>
        {/* viewer */}
        <div>
          <div className="card" style={{ overflow: 'hidden', aspectRatio: '1', position: 'relative', border: '8px solid var(--surface)' }}>
            {current?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.imageUrl} alt={`Page ${current.pageIndex + 1}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '70%', objectFit: 'cover' }} />
            ) : (
              <div className="ph" style={{ position: 'absolute', inset: 0, height: '70%', borderRadius: 0 }} />
            )}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '18px 22px', background: 'var(--surface)', minHeight: '30%' }}>
              <p style={{ fontSize: 17, lineHeight: 1.5 }}>{current?.text}</p>
            </div>
          </div>
          {pages.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 16 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}><Icon name="arrowL" size={16} stroke="var(--brand)" /></button>
              <span style={{ fontSize: 14, color: 'var(--ink-soft)' }}>{Math.min(page, pages.length - 1) + 1} / {pages.length}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setPage((p) => Math.min(pages.length - 1, p + 1))} disabled={page >= pages.length - 1}><Icon name="arrow" size={16} stroke="var(--brand)" /></button>
            </div>
          )}
        </div>

        {/* order panel */}
        <div style={{ position: 'sticky', top: 96 }}>
          <div className="card" style={{ padding: '28px 26px' }}>
            <h2 className="display" style={{ fontSize: 26, marginBottom: 4 }}>Make it real</h2>
            <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', marginBottom: 20 }}>Unlock the full book — yours instantly.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {TIER_ORDER.map((t) => {
                const m = TIER_META[t];
                const active = tier === t;
                return (
                  <button key={t} onClick={() => setTier(t)} style={{ cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 'var(--r-lg)', border: active ? '2px solid var(--brand)' : '1.5px solid var(--hairline)', background: active ? 'var(--brand-tint)' : 'var(--surface)' }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', flex: 'none', border: active ? '7px solid var(--brand)' : '2px solid var(--hairline)', background: '#fff' }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 700, fontSize: 15.5, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {m.label}
                        {m.badge && <span className="pill" style={{ background: 'var(--accent)', color: '#fff', border: 'none', fontSize: 11, padding: '3px 8px' }}>{m.badge}</span>}
                      </span>
                      <span style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{m.note}</span>
                    </span>
                    <span className="display" style={{ fontSize: 19, color: 'var(--brand)' }}>{m.price}</span>
                  </button>
                );
              })}
            </div>
            <button className="btn btn-primary btn-block" style={{ marginTop: 20 }} onClick={onBuy} disabled={paying}>
              {awaiting ? <><span className="spinner" /> Confirming payment…</> : paying ? <span className="spinner" /> : <><Icon name="heart" size={18} stroke="var(--accent-ink)" /> Unlock the full book</>}
            </button>
            <p className="trust" style={{ marginTop: 14, justifyContent: 'center' }}>
              <Icon name="lock" size={15} stroke="var(--brand)" /> Secure payment · {awaiting ? 'finishing your book…' : 'pay only when you love it'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Delivered({ book }: { book: Book }) {
  return (
    <div style={{ maxWidth: 560, margin: '20px auto', textAlign: 'center' }}>
      <div style={{ width: 84, height: 84, borderRadius: '50%', background: 'var(--soft-2)', margin: '0 auto 22px', display: 'grid', placeItems: 'center', animation: 'floaty 3s ease-in-out infinite' }}>
        <Icon name="check" size={42} stroke="var(--success)" sw={2.4} />
      </div>
      <h1 className="display" style={{ fontSize: 38, marginBottom: 10 }}>{book.title ?? 'Your book'} is ready!</h1>
      <p className="d-lead" style={{ color: 'var(--ink-soft)', maxWidth: 440, margin: '0 auto 28px' }}>Download it below — we’ve also emailed you the link.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 360, margin: '0 auto' }}>
        {book.pdfUrl && (
          <a className="btn btn-primary btn-block" href={book.pdfUrl} target="_blank" rel="noopener noreferrer">
            <Icon name="download" size={18} stroke="var(--accent-ink)" /> Download the PDF
          </a>
        )}
        {book.audioUrl && (
          <a className="btn btn-brand btn-block" href={book.audioUrl} target="_blank" rel="noopener noreferrer">
            <Icon name="book" size={18} stroke="#fff" /> Listen to the narration
          </a>
        )}
        <Link className="btn btn-ghost btn-block" href="/books">My books</Link>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 16 }}>Download links refresh each time you open this page.</p>
    </div>
  );
}

function Failed() {
  return (
    <div style={{ maxWidth: 480, margin: '40px auto', textAlign: 'center' }}>
      <h1 className="display" style={{ fontSize: 32, marginBottom: 10 }}>Something needs a human</h1>
      <p className="d-lead" style={{ color: 'var(--ink-soft)', marginBottom: 24 }}>
        This story hit a snag and our team has been notified. We’ll sort it out — no charge for anything that didn’t complete.
      </p>
      <Link className="btn btn-primary" href="/create"><Sparkle size={17} color="var(--accent-ink)" /> Start a new story</Link>
    </div>
  );
}
