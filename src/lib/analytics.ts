'use client';

/**
 * First-party funnel tracking.
 *
 * No third-party script, no fingerprint, no personal data — the server rejects
 * any property that is not a number or a known enum, so this can only ever
 * report behaviour. Batched and best-effort: telemetry must never be the reason
 * a page feels slow or a form fails.
 */
export type FunnelEventName =
  | 'landing_view'
  | 'price_seen'
  | 'cta_click'
  | 'scroll_depth'
  | 'engaged_time'
  | 'sample_view'
  | 'sample_page'
  | 'faq_open'
  | 'preview_start'
  | 'intake_step'
  | 'intake_error'
  | 'email_captured'
  | 'consent_given'
  | 'preview_complete'
  | 'preview_failed'
  | 'pincode_check'
  | 'checkout_open'
  | 'payment_initiated'
  | 'payment_failed'
  | 'payment_dismissed';

export interface FunnelProps {
  depth?: number;
  seconds?: number;
  step?: number;
  page?: number;
  target?: 'hero' | 'header' | 'sticky' | 'pricing' | 'sample' | 'final' | 'product';
  ok?: boolean;
  reason?: string;
}

interface Queued {
  event: FunnelEventName;
  path: string;
  props?: FunnelProps;
}

const queue: Queued[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function track(event: FunnelEventName, props?: FunnelProps): void {
  if (typeof window === 'undefined') return;
  queue.push({ event, path: window.location.pathname, props });
  // Batch a beat, so a burst of scroll milestones is one request.
  if (!flushTimer) flushTimer = setTimeout(flush, 1200);
  if (queue.length >= 15) flush();
}

function flush(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!queue.length) return;
  const events = queue.splice(0, queue.length);
  const body = JSON.stringify({ events });

  // sendBeacon survives the page being closed, which is exactly when the most
  // interesting event (they left) happens. Falls back to fetch where it is
  // unavailable or refuses the payload.
  try {
    if (navigator.sendBeacon?.(
      '/api/v1/events',
      new Blob([body], { type: 'application/json' }),
    )) return;
  } catch {
    /* fall through */
  }
  void fetch('/api/v1/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

/**
 * Scroll depth and engaged time for one page.
 *
 * "Engaged" means the tab is visible and the person has done something in the
 * last half minute — time with a page open in a background tab tells us nothing
 * about whether the page worked.
 */
export function observePage(): () => void {
  if (typeof window === 'undefined') return () => {};

  const milestones = [25, 50, 75, 100];
  const seen = new Set<number>();
  const onScroll = () => {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    if (max <= 0) return;
    const pct = Math.min(100, Math.round((window.scrollY / max) * 100));
    for (const m of milestones) {
      if (pct >= m && !seen.has(m)) {
        seen.add(m);
        track('scroll_depth', { depth: m });
      }
    }
  };

  let engaged = 0;
  let lastActive = Date.now();
  const markActive = () => { lastActive = Date.now(); };
  const tick = setInterval(() => {
    if (document.visibilityState === 'visible' && Date.now() - lastActive < 30_000) engaged += 5;
  }, 5000);

  const report = () => {
    if (engaged > 0) {
      track('engaged_time', { seconds: engaged });
      engaged = 0;
    }
    flush();
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('pointerdown', markActive, { passive: true });
  window.addEventListener('keydown', markActive);
  window.addEventListener('pagehide', report);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') report();
  });
  onScroll();

  return () => {
    clearInterval(tick);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('pointerdown', markActive);
    window.removeEventListener('keydown', markActive);
    window.removeEventListener('pagehide', report);
    report();
  };
}
