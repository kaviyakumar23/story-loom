/**
 * Error tracking + alerts (§12). Console-based for now; wire up Sentry via the
 * official `@sentry/nextjs` integration when you're ready (it hooks Next's
 * instrumentation properly). The captureError/alert API stays stable so callers
 * don't change.
 */
export function initObservability(): void {
  // no-op placeholder; add @sentry/nextjs init here later.
}

/**
 * Redact personal-data patterns before anything is written to a log / error
 * tracker. Our telemetry is PII-free by design (events carry only a bookId, and
 * capture contexts are {stage, bookId, correlationId}) — this is defense in
 * depth so a stray error message or future context can never leak a parent's
 * email, phone, or a long id into logs.
 */
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w][\w.-]*/g;
const PHONE_RE = /\d[\d\s\-+()]{8,}\d/g;

function redactString(s: string): string {
  return s
    .replace(EMAIL_RE, '[email]')
    .replace(PHONE_RE, (m) => (m.replace(/\D/g, '').length >= 10 ? '[phone/id]' : m));
}

export function redact(value: unknown): unknown {
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = redact(v);
    return out;
  }
  return value;
}

export function captureError(err: unknown, context?: Record<string, unknown>): void {
  const detail = err instanceof Error ? (err.stack ?? err.message) : String(err);
  // eslint-disable-next-line no-console
  console.error('[captureError]', redactString(detail), context ? redact(context) : {});
}

/** A threshold alert — structured log + best-effort email to ALERT_EMAIL. */
export function alert(message: string, context?: Record<string, unknown>): void {
  // Console/telemetry is redacted; the admin email keeps full detail (internal,
  // actionable — e.g. an amount-mismatch alert the founder must reconcile).
  // eslint-disable-next-line no-console
  console.warn(`[alert] ${redactString(message)}`, context ? redact(context) : {});
  // Fire-and-forget: alerts must never break the caller. Serverless may cut
  // this short after the response; critical paths should await sendAdminAlert.
  void import('./email').then(({ sendAdminAlert }) => sendAdminAlert(message, context)).catch(() => {});
}
