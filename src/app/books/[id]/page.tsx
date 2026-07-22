'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Header } from '@/components/chrome';
import { ReadingGuidePanel } from '@/components/reading-guide';
import { Icon, Sparkle } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { openCheckout } from '@/lib/razorpay';
import { supabase } from '@/lib/supabase';
import {
  EMPTY_SHIPPING,
  isShippingComplete,
  TIER_META,
  TIER_ORDER,
  type Book,
  type ShippingInput,
  type BookStatus,
  type BookEventName,
  type CreateBookEventRequest,
  type CreateBookFeedbackRequest,
  type CreateBookRevisionRequest,
  type CreateBookRevisionResponse,
  type CreateBookShareResponse,
  type CreateOrderResponse,
  type FeedbackIssueType,
  type FulfillmentStatus,
  type RevokeBookShareResponse,
  type Tier,
} from '@/lib/types';

const POLL_MS = 2500;
/** Ceiling for the back-off applied after a failed poll. */
const POLL_MAX_MS = 20_000;
/** Stop polling and say so, rather than spin forever on a dead job. */
const POLL_GIVE_UP_MS = 15 * 60 * 1000;
const PAYMENTS_ENABLED = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === 'true';
const FEEDBACK_ISSUES: { id: FeedbackIssueType; label: string }[] = [
  { id: 'none', label: 'No issue' },
  { id: 'story_quality', label: 'Story quality' },
  { id: 'image_quality', label: 'Image quality' },
  { id: 'safety', label: 'Safety concern' },
  { id: 'technical', label: 'Technical issue' },
  { id: 'other', label: 'Other' },
];

export default function BookPage() {
  const { ready } = useRequireAuth();
  const { session } = useAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const bookId = params.id;

  const [book, setBook] = useState<Book | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tier, setTier] = useState<Tier>('print');
  const [address, setAddress] = useState<ShippingInput>(EMPTY_SHIPPING);
  const [paying, setPaying] = useState(false);
  const [awaitingPayment, setAwaitingPayment] = useState(false);
  const [revisionRequested, setRevisionRequested] = useState(false);
  const [stalled, setStalled] = useState(false);
  /** Bumped to restart the polling effect (manual retry). */
  const [pollNonce, setPollNonce] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewViewedBook = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const b = await api<Book>(`/books/${bookId}`);
      setBook(b);
      setError(null); // a recovered blip shouldn't leave its error on screen
      if (b.status !== 'generating') setRevisionRequested(false);
      return b;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load this book.');
      return null;
    }
  }, [bookId]);

  const trackEvent = useCallback(
    async (event: BookEventName, metadata: Record<string, unknown> = {}) => {
      try {
        await api<{ ok: true }>(`/books/${bookId}/events`, {
          method: 'POST',
          body: { event, metadata } satisfies CreateBookEventRequest,
        });
      } catch {
        // Measurement should never block the parent journey.
      }
    },
    [bookId],
  );

  // Poll while the book is actively progressing (generating, or after payment).
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    let delay = POLL_MS;
    const startedAt = Date.now();
    setStalled(false);

    const tick = async () => {
      const b = await load();
      if (cancelled) return;

      if (b === null) {
        // A failed fetch is NOT a reason to stop: this used to end the loop, so
        // one blip on mobile data stranded the parent on a spinner forever.
        // Back off and keep trying.
        delay = Math.min(delay * 2, POLL_MAX_MS);
      } else {
        delay = POLL_MS;
        const active =
          b.status === 'generating' || b.status === 'paid' || (awaitingPayment && b.status === 'preview_ready');
        if (!active) return; // terminal state — nothing left to wait for
      }

      if (Date.now() - startedAt > POLL_GIVE_UP_MS) {
        // A worker can die without ever writing `failed`. Say so instead of
        // spinning until the parent gives up on us.
        setStalled(true);
        return;
      }
      timer.current = setTimeout(tick, delay);
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [ready, load, awaitingPayment, revisionRequested, pollNonce]);

  const retryNow = useCallback(() => setPollNonce((n) => n + 1), []);

  const previewPanel = () =>
    book && (
      <Preview
        book={book}
        tier={tier}
        setTier={setTier}
        address={address}
        setAddress={setAddress}
        onBuy={buy}
        onSave={savePreview}
        onEvent={trackEvent}
        onRevisionStarted={refreshAfterRevision}
        paying={paying || awaitingPayment}
        awaiting={awaitingPayment || book.status === 'paid'}
        paymentsEnabled={PAYMENTS_ENABLED}
        isAnon={!session?.user?.email}
      />
    );

  async function buy() {
    const physical = Boolean(TIER_META[tier].physical);
    if (physical && !isShippingComplete(address)) {
      setError('Please complete the shipping address (a valid 6-digit PIN is required).');
      return;
    }
    setPaying(true);
    setError(null);
    try {
      const shippingAddress = physical
        ? {
            recipientName: address.recipientName.trim(),
            phone: address.phone.trim(),
            line1: address.line1.trim(),
            line2: address.line2.trim() || undefined,
            city: address.city.trim(),
            state: address.state.trim(),
            postalCode: address.postalCode.trim(),
            notes: address.notes.trim() || undefined,
          }
        : undefined;
      const order = await api<CreateOrderResponse>('/payments/order', { method: 'POST', body: { bookId, tier, shippingAddress } });
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

  // Save the preview to the parent's account. If they're still anonymous, take
  // an email first and upgrade the anonymous account (same id → the book, its
  // consent and any purchase stay linked) so the preview isn't lost.
  async function savePreview(email?: string) {
    if (email && !session?.user?.email) {
      const { error: upErr } = await supabase().auth.updateUser({ email });
      if (upErr) {
        setError(upErr.message);
        return;
      }
    }
    await trackEvent('alpha_preview_saved', { tier });
    router.push('/books');
  }

  async function refreshAfterRevision() {
    setRevisionRequested(true);
    await load();
  }

  useEffect(() => {
    if (!book || book.status !== 'preview_ready' || previewViewedBook.current === book.id) return;
    previewViewedBook.current = book.id;
    void trackEvent('preview_viewed', { pageCount: book.preview?.pages.length ?? 0 });
  }, [book, trackEvent]);

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
      <div className="container page-pad">
        {error && <p style={{ color: 'var(--error)', marginBottom: 16 }}>{error}</p>}
        {book &&
          renderStatus(book.status, {
            generating: () => <Generating book={book} stalled={stalled} onRetry={retryNow} />,
            failed: () => <Failed />,
            // `paid` means we're building the full book: same preview, with the
            // panel in its "finishing up" state. It must render whether or not
            // the PDF asset happens to exist yet — the old condition matched
            // neither branch once it did, leaving a paying parent a blank page.
            preview_ready: () => previewPanel(),
            paid: () => previewPanel(),
            complete: () =>
              book.pdfUrl ? <Delivered book={book} onEvent={trackEvent} /> : <DeliveredPending onRetry={retryNow} />,
          })}
      </div>
    </div>
  );
}

/**
 * One branch per status, keyed by the status itself. A new BookStatus now fails
 * to compile instead of rendering nothing — which is how `paid` with a signed
 * PDF used to match no branch at all and leave a paying parent a blank page.
 */
function renderStatus(status: BookStatus, branches: Record<BookStatus, () => ReactNode>): ReactNode {
  return branches[status]();
}

function Generating({ book, stalled, onRetry }: { book: Book; stalled: boolean; onRetry: () => void }) {
  return (
    <div style={{ maxWidth: 560, margin: '40px auto', textAlign: 'center' }}>
      <div style={{ animation: stalled ? undefined : 'floaty 3s ease-in-out infinite', marginBottom: 20 }}>
        <Sparkle size={48} color="var(--brand)" />
      </div>
      {stalled ? (
        <>
          <h1 className="display" style={{ fontSize: 34, marginBottom: 10 }}>This is taking longer than usual</h1>
          <p className="d-lead" style={{ color: 'var(--ink-soft)', marginBottom: 20 }}>
            Your story is still queued on our side. Nothing is lost — check again in a moment.
          </p>
          <button className="btn btn-brand" onClick={onRetry}>Check again</button>
          <p style={{ marginTop: 14, fontSize: 12.5, color: 'var(--ink-soft)' }}>
            Still stuck? <Link href="/legal/contact" style={{ color: 'var(--brand)', fontWeight: 600 }}>Tell us</Link> and we&apos;ll sort it out.
          </p>
        </>
      ) : (
        <>
          <h1 className="display" style={{ fontSize: 34, marginBottom: 10 }}>Weaving the story…</h1>
          <p className="d-lead" style={{ color: 'var(--ink-soft)' }}>Crafting characters and painting the first pages. This takes a minute or two.</p>
          <div style={{ height: 12, borderRadius: 999, background: 'var(--bg-2)', marginTop: 28, overflow: 'hidden' }}>
            <div style={{ width: `${Math.max(5, book.progress)}%`, height: '100%', background: 'var(--coral)', transition: 'width .6s ease' }} />
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 10 }}>{book.progress}%</p>
        </>
      )}
    </div>
  );
}

/**
 * Finished, but no download link came back (signing failed, or the asset is
 * missing). This used to fall through to <Delivered/>, which told the parent
 * their book was ready and then offered no way to get it.
 */
function DeliveredPending({ onRetry }: { onRetry: () => void }) {
  return (
    <div style={{ maxWidth: 560, margin: '40px auto', textAlign: 'center' }}>
      <h1 className="display" style={{ fontSize: 34, marginBottom: 10 }}>Your book is finished</h1>
      <p className="d-lead" style={{ color: 'var(--ink-soft)', marginBottom: 20 }}>
        We&apos;re still fetching your download link. Give it a moment and try again.
      </p>
      <button className="btn btn-brand" onClick={onRetry}>Try again</button>
      <p style={{ marginTop: 14, fontSize: 12.5, color: 'var(--ink-soft)' }}>
        If this keeps happening, <Link href="/legal/contact" style={{ color: 'var(--brand)', fontWeight: 600 }}>contact us</Link> — we&apos;ll send your book over directly.
      </p>
    </div>
  );
}

function Preview({ book, tier, setTier, address, setAddress, onBuy, onSave, onEvent, onRevisionStarted, paying, awaiting, paymentsEnabled, isAnon }: {
  book: Book;
  tier: Tier;
  setTier: (t: Tier) => void;
  address: ShippingInput;
  setAddress: (a: ShippingInput) => void;
  onBuy: () => void;
  onSave: (email?: string) => Promise<void>;
  onEvent: (event: BookEventName, metadata?: Record<string, unknown>) => Promise<void>;
  onRevisionStarted: () => Promise<void>;
  paying: boolean;
  awaiting: boolean;
  paymentsEnabled: boolean;
  isAnon: boolean;
}) {
  const pages = book.preview?.pages ?? [];
  const [page, setPage] = useState(0);
  const [saveEmail, setSaveEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const current = pages[Math.min(page, pages.length - 1)];
  const changePage = (next: number) => {
    const bounded = Math.max(0, Math.min(pages.length - 1, next));
    setPage(bounded);
    void onEvent('preview_page_changed', { pageIndex: pages[bounded]?.pageIndex ?? bounded });
  };

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <span className="eyebrow" style={{ justifyContent: 'center' }}><Sparkle size={13} /> Your free preview is ready</span>
        <h1 className="display" style={{ fontSize: 40, margin: '12px 0 6px', lineHeight: 1.05 }}>
          {book.title ?? 'Their Big Adventure'}
        </h1>
        {book.theme && <p className="d-lead" style={{ color: 'var(--ink-soft)' }}>{book.theme}</p>}
      </div>

      <div className="book-layout">
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
              <button className="btn btn-ghost btn-sm" onClick={() => changePage(page - 1)} disabled={page === 0}><Icon name="arrowL" size={16} stroke="var(--brand)" /></button>
              <span style={{ fontSize: 14, color: 'var(--ink-soft)' }}>{Math.min(page, pages.length - 1) + 1} / {pages.length}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => changePage(page + 1)} disabled={page >= pages.length - 1}><Icon name="arrow" size={16} stroke="var(--brand)" /></button>
            </div>
          )}
        </div>

        {/* order panel */}
        <div style={{ position: 'sticky', top: 96 }}>
          <div className="card" style={{ padding: '28px 26px' }}>
            <h2 className="display" style={{ fontSize: 26, marginBottom: 4 }}>{paymentsEnabled ? 'Make it real' : 'Love it? Save it'}</h2>
            <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', marginBottom: 20 }}>
              {paymentsEnabled ? 'Unlock the full book — yours instantly.' : 'Save your preview to your account — we’ll email you the moment the full book is ready to order.'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {TIER_ORDER.filter((t) => TIER_META[t].enabled).map((t) => {
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

            {paymentsEnabled && TIER_META[tier].physical && (
              <ShippingForm address={address} setAddress={setAddress} />
            )}

            {paymentsEnabled ? (
              <button className="btn btn-primary btn-block" style={{ marginTop: 20 }} onClick={onBuy} disabled={paying || (Boolean(TIER_META[tier].physical) && !isShippingComplete(address))}>
                {awaiting ? <><span className="spinner" /> Confirming payment…</> : paying ? <span className="spinner" /> : <><Icon name="heart" size={18} stroke="var(--accent-ink)" /> {TIER_META[tier].physical ? 'Order the printed book' : 'Unlock the full book'}</>}
              </button>
            ) : (
              <div style={{ marginTop: 20 }}>
                {isAnon && (
                  <input
                    className="input"
                    type="email"
                    placeholder="Your email — to save it"
                    value={saveEmail}
                    onChange={(e) => setSaveEmail(e.target.value)}
                    style={{ marginBottom: 10 }}
                    aria-label="Email to save your preview"
                  />
                )}
                <button
                  className="btn btn-brand btn-block"
                  disabled={saving || (isAnon && !saveEmail.trim())}
                  onClick={async () => {
                    setSaving(true);
                    try {
                      await onSave(isAnon ? saveEmail.trim() : undefined);
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {saving ? <span className="spinner" /> : <><Icon name="book" size={18} stroke="#fff" /> Save my storybook</>}
                </button>
              </div>
            )}
            <p className="trust" style={{ marginTop: 14, justifyContent: 'center' }}>
              <Icon name="lock" size={15} stroke="var(--brand)" /> {paymentsEnabled ? <>Secure payment · {awaiting ? 'finishing your book…' : 'pay only when you love it'}</> : 'Free preview · saved to your account'}
            </p>
            <p style={{ marginTop: 12, fontSize: 12, lineHeight: 1.5, color: 'var(--ink-soft)', textAlign: 'center' }}>
              Illustrations are AI-generated and may have small imperfections — please review your preview {paymentsEnabled ? 'before buying' : 'before you order'}. See our{' '}
              <Link href="/legal/ai-disclosure" style={{ color: 'var(--brand)', fontWeight: 600 }}>AI Disclosure</Link>.
            </p>
            <PreviewTrustList />
            <ReadingGuidePanel guide={book.readingGuide} />
            <PreviewShare bookId={book.id} onEvent={onEvent} />
            <PreviewTweak book={book} onEvent={onEvent} onRevisionStarted={onRevisionStarted} />
            {!paymentsEnabled && <AlphaFeedback bookId={book.id} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function ShippingForm({ address, setAddress }: { address: ShippingInput; setAddress: (a: ShippingInput) => void }) {
  const set = (k: keyof ShippingInput) => (e: ChangeEvent<HTMLInputElement>) => setAddress({ ...address, [k]: e.target.value });
  const mb = { marginBottom: 8 };
  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--hairline)' }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>Where should we ship it?</p>
      <input className="input" placeholder="Recipient name" value={address.recipientName} onChange={set('recipientName')} style={mb} aria-label="Recipient name" />
      <input className="input" placeholder="Phone" value={address.phone} onChange={set('phone')} inputMode="tel" style={mb} aria-label="Phone" />
      <input className="input" placeholder="Address line 1" value={address.line1} onChange={set('line1')} style={mb} aria-label="Address line 1" />
      <input className="input" placeholder="Address line 2 (optional)" value={address.line2} onChange={set('line2')} style={mb} aria-label="Address line 2" />
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="input" placeholder="City" value={address.city} onChange={set('city')} style={{ ...mb, flex: 1, minWidth: 0 }} aria-label="City" />
        <input className="input" placeholder="State" value={address.state} onChange={set('state')} style={{ ...mb, flex: 1, minWidth: 0 }} aria-label="State" />
      </div>
      <input className="input" placeholder="PIN code (6 digits)" value={address.postalCode} onChange={set('postalCode')} inputMode="numeric" maxLength={6} style={mb} aria-label="PIN code" />
      <input className="input" placeholder="Delivery notes (optional)" value={address.notes} onChange={set('notes')} aria-label="Delivery notes" />
      <p style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 8 }}>Printed &amp; shipped within ~7 days · ships in India · includes the instant digital PDF.</p>
    </div>
  );
}

function PreviewTrustList() {
  return (
    <div style={{ marginTop: 18, paddingTop: 18, borderTop: '2px solid var(--hairline)', display: 'grid', gap: 10 }}>
      {[
        ['No photos', 'The character is built from attributes, not uploads.'],
        ['Adult review', 'Please check the story and images before sharing.'],
        ['Private assets', 'Images use short-lived signed links.'],
      ].map(([title, text]) => (
        <p key={title} className="trust" style={{ alignItems: 'flex-start' }}>
          <Icon name="shield" size={15} stroke="var(--teal)" style={{ flex: 'none', marginTop: 1 }} />
          <span><strong style={{ color: 'var(--ink)' }}>{title}.</strong> {text}</span>
        </p>
      ))}
    </div>
  );
}

function PreviewShare({ bookId, onEvent }: { bookId: string; onEvent: (event: BookEventName, metadata?: Record<string, unknown>) => Promise<void> }) {
  const [shareUrl, setShareUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copyLink(url: string) {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      await onEvent('preview_share_copied');
    } catch {
      setCopied(false);
    }
  }

  async function createShare() {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const result = await api<CreateBookShareResponse>(`/books/${bookId}/share`, { method: 'POST' });
      setShareUrl(result.shareUrl);
      setExpiresAt(result.expiresAt);
      await onEvent('preview_share_created');
      await copyLink(result.shareUrl);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not create a preview link.');
    } finally {
      setBusy(false);
    }
  }

  async function revokeShares() {
    setRevoking(true);
    setError(null);
    try {
      await api<RevokeBookShareResponse>(`/books/${bookId}/share`, { method: 'DELETE' });
      setShareUrl('');
      setExpiresAt('');
      setCopied(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not revoke preview links.');
    } finally {
      setRevoking(false);
    }
  }

  return (
    <section style={{ marginTop: 22, paddingTop: 20, borderTop: '2px solid var(--hairline)' }}>
      <h3 className="display" style={{ fontSize: 21, marginBottom: 8 }}>Private preview link</h3>
      <p style={{ fontSize: 13.5, lineHeight: 1.45, color: 'var(--ink-soft)', marginBottom: 14 }}>
        Share this preview with one family member or tester. Links expire in 7 days.
      </p>
      {shareUrl ? (
        <div style={{ display: 'grid', gap: 10 }}>
          <input className="input" value={shareUrl} readOnly onFocus={(e) => e.currentTarget.select()} style={{ fontSize: 13 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost btn-block" onClick={() => void copyLink(shareUrl)}>
              <Icon name="mail" size={17} stroke="var(--brand)" /> {copied ? 'Copied' : 'Copy'}
            </button>
            <button className="btn btn-ghost btn-block" onClick={revokeShares} disabled={revoking}>
              {revoking ? <span className="spinner spinner-brand" /> : <><Icon name="x" size={17} stroke="var(--brand)" /> Revoke</>}
            </button>
          </div>
          {expiresAt && <p className="trust"><Icon name="lock" size={14} stroke="var(--brand)" /> Expires {new Date(expiresAt).toLocaleDateString()}</p>}
        </div>
      ) : (
        <button className="btn btn-ghost btn-block" onClick={createShare} disabled={busy}>
          {busy ? <span className="spinner spinner-brand" /> : <><Icon name="mail" size={18} stroke="var(--brand)" /> Create private link</>}
        </button>
      )}
      {error && <p style={{ color: 'var(--error)', fontSize: 13, marginTop: 10 }}>{error}</p>}
    </section>
  );
}

function PreviewTweak({ book, onEvent, onRevisionStarted }: {
  book: Book;
  onEvent: (event: BookEventName, metadata?: Record<string, unknown>) => Promise<void>;
  onRevisionStarted: () => Promise<void>;
}) {
  const [instruction, setInstruction] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestRevision() {
    const trimmed = instruction.trim();
    if (trimmed.length < 8) {
      setError('Add a little more detail for the tweak.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api<CreateBookRevisionResponse>(`/books/${book.id}/revisions`, {
        method: 'POST',
        body: { instruction: trimmed } satisfies CreateBookRevisionRequest,
      });
      await onEvent('preview_tweak_requested', { length: trimmed.length });
      await onRevisionStarted();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not request a preview tweak.');
      setSaving(false);
    }
  }

  return (
    <section style={{ marginTop: 22, paddingTop: 20, borderTop: '2px solid var(--hairline)' }}>
      <h3 className="display" style={{ fontSize: 21, marginBottom: 8 }}>One free tweak</h3>
      {book.canRequestRevision ? (
        <>
          <textarea
            className="input"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            maxLength={400}
            rows={3}
            placeholder="Make it calmer, more playful, or closer to our bedtime routine..."
            style={{ resize: 'vertical', minHeight: 92 }}
          />
          <button className="btn btn-brand btn-block" style={{ marginTop: 12 }} onClick={requestRevision} disabled={saving || instruction.trim().length < 8}>
            {saving ? <span className="spinner" /> : <><Sparkle size={17} color="#fff" /> Regenerate preview</>}
          </button>
        </>
      ) : (
        <p className="trust">
          <Icon name="check" size={15} stroke="var(--success)" /> Free tweak used for this preview.
        </p>
      )}
      {error && <p style={{ color: 'var(--error)', fontSize: 13, marginTop: 10 }}>{error}</p>}
    </section>
  );
}

function AlphaFeedback({ bookId }: { bookId: string }) {
  const [rating, setRating] = useState<number | null>(null);
  const [issueType, setIssueType] = useState<FeedbackIssueType>('none');
  const [comments, setComments] = useState('');
  const [wantsFullBook, setWantsFullBook] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitFeedback() {
    if (!rating) {
      setError('Choose a rating first.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api<{ ok: true }>(`/books/${bookId}/feedback`, {
        method: 'POST',
        body: { rating, issueType, comments, wantsFullBook } satisfies CreateBookFeedbackRequest,
      });
      setSent(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save feedback.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: 22, paddingTop: 20, borderTop: '2px solid var(--hairline)' }}>
      <h3 className="display" style={{ fontSize: 21, marginBottom: 10 }}>Alpha feedback</h3>
      <label className="label">Preview rating</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={`chip ${rating === n ? 'sel' : ''}`}
            onClick={() => setRating(n)}
            disabled={sent}
          >
            {n}
          </button>
        ))}
      </div>

      <label className="label" htmlFor="feedback-issue">Issue type</label>
      <select
        id="feedback-issue"
        className="input"
        value={issueType}
        onChange={(e) => setIssueType(e.target.value as FeedbackIssueType)}
        disabled={sent}
        style={{ marginBottom: 12 }}
      >
        {FEEDBACK_ISSUES.map((issue) => (
          <option key={issue.id} value={issue.id}>{issue.label}</option>
        ))}
      </select>

      <label className="label" htmlFor="feedback-comments">Notes</label>
      <textarea
        id="feedback-comments"
        className="input"
        value={comments}
        onChange={(e) => setComments(e.target.value)}
        disabled={sent}
        maxLength={1000}
        rows={3}
        style={{ resize: 'vertical', minHeight: 92 }}
      />

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, fontSize: 14, color: 'var(--ink-soft)' }}>
        <input
          type="checkbox"
          checked={wantsFullBook}
          onChange={(e) => setWantsFullBook(e.target.checked)}
          disabled={sent}
          style={{ width: 18, height: 18, accentColor: 'var(--brand)' }}
        />
        I would like the full book when alpha opens.
      </label>

      {error && <p style={{ color: 'var(--error)', fontSize: 13, marginTop: 10 }}>{error}</p>}
      {sent ? (
        <p className="trust" style={{ marginTop: 14, color: 'var(--success)' }}>
          <Icon name="check" size={15} stroke="var(--success)" /> Feedback saved
        </p>
      ) : (
        <button className="btn btn-ghost btn-block" style={{ marginTop: 16 }} onClick={submitFeedback} disabled={saving}>
          {saving ? <span className="spinner spinner-brand" /> : <><Icon name="heart" size={18} stroke="var(--brand)" /> Send feedback</>}
        </button>
      )}
    </div>
  );
}

function Delivered({ book, onEvent }: { book: Book; onEvent: (event: BookEventName, metadata?: Record<string, unknown>) => Promise<void> }) {
  return (
    <div style={{ maxWidth: 560, margin: '20px auto', textAlign: 'center' }}>
      <div style={{ width: 84, height: 84, borderRadius: '50%', background: 'var(--soft-2)', margin: '0 auto 22px', display: 'grid', placeItems: 'center', animation: 'floaty 3s ease-in-out infinite' }}>
        <Icon name="check" size={42} stroke="var(--success)" sw={2.4} />
      </div>
      <h1 className="display" style={{ fontSize: 38, marginBottom: 10 }}>{book.title ?? 'Your book'} is ready!</h1>
      <p className="d-lead" style={{ color: 'var(--ink-soft)', maxWidth: 440, margin: '0 auto 22px' }}>Download it below — we’ve also emailed you the link.</p>
      {book.fulfillment && <PrintStatus f={book.fulfillment} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 360, margin: '0 auto' }}>
        {book.pdfUrl && (
          <a className="btn btn-primary btn-block" href={book.pdfUrl} target="_blank" rel="noopener noreferrer" onClick={() => void onEvent('download_pdf_clicked')}>
            <Icon name="download" size={18} stroke="var(--accent-ink)" /> Download the PDF
          </a>
        )}
        {book.audioUrl && (
          <a className="btn btn-brand btn-block" href={book.audioUrl} target="_blank" rel="noopener noreferrer" onClick={() => void onEvent('download_audio_clicked')}>
            <Icon name="book" size={18} stroke="#fff" /> Listen to the narration
          </a>
        )}
        <Link className="btn btn-ghost btn-block" href="/books">My books</Link>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 16 }}>Download links refresh each time you open this page.</p>
    </div>
  );
}

function PrintStatus({ f }: { f: FulfillmentStatus }) {
  const MAP: Record<FulfillmentStatus['status'], { icon: string; text: string }> = {
    print_ready: { icon: '🖨️', text: 'Your printed hardcover is queued for printing — it ships within about 7 days.' },
    printing: { icon: '🖨️', text: 'Your printed hardcover is being printed now — it ships within about 7 days.' },
    shipped: { icon: '🚚', text: 'Your printed book has shipped!' },
    delivered: { icon: '📦', text: 'Your printed book was delivered — enjoy!' },
    cancelled: { icon: 'ⓘ', text: 'This print order was cancelled. Contact us if that’s a surprise.' },
  };
  const m = MAP[f.status];
  return (
    <div style={{ background: 'var(--brand-tint)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-lg)', padding: '13px 18px', margin: '0 auto 24px', maxWidth: 440, fontSize: 14, lineHeight: 1.5, textAlign: 'left' }}>
      <strong style={{ color: 'var(--ink)' }}>{m.icon} {m.text}</strong>
      {f.status === 'shipped' && f.trackingNumber && (
        <div style={{ marginTop: 5, fontSize: 13, color: 'var(--ink-soft)' }}>
          {f.carrier ? `${f.carrier} · ` : ''}Tracking: <strong style={{ color: 'var(--ink)' }}>{f.trackingNumber}</strong>
        </div>
      )}
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
