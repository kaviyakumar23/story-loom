/**
 * Error tracking + alerts (§12). Sentry is initialized by the Next.js
 * instrumentation hooks (src/instrumentation.ts + sentry.*.config.ts); this
 * module forwards our internal captureError/alert calls into it while keeping
 * the redacted console output as a second sink (Vercel logs). The API is stable
 * so callers don't change.
 */
import * as Sentry from '@sentry/nextjs';

export function initObservability(): void {
  // no-op: Sentry.init runs in the instrumentation config files.
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
  // Forward to Sentry. Context is PII-free by design ({stage, bookId,
  // correlationId}); still run it through redact() as defense in depth. bookId
  // and stage become tags so issues are filterable. Safe to call before init
  // (no-ops); never let telemetry throw into the caller.
  try {
    const safeContext = (context ? redact(context) : {}) as Record<string, unknown>;
    Sentry.captureException(err, {
      tags: {
        ...(typeof safeContext.stage === 'string' ? { stage: safeContext.stage } : {}),
        ...(typeof safeContext.bookId === 'string' ? { bookId: safeContext.bookId } : {}),
      },
      extra: safeContext,
    });
  } catch {
    /* observability must never break the caller */
  }
}

/** A threshold alert — structured log + best-effort email to ALERT_EMAIL. */
export function alert(message: string, context?: Record<string, unknown>): void {
  // Console/telemetry is redacted; the admin email keeps full detail (internal,
  // actionable — e.g. an amount-mismatch alert the founder must reconcile).
  // eslint-disable-next-line no-console
  console.warn(`[alert] ${redactString(message)}`, context ? redact(context) : {});
  // Surface threshold alerts in Sentry too (redacted), as a warning-level event.
  try {
    Sentry.captureMessage(redactString(message), {
      level: 'warning',
      extra: (context ? redact(context) : {}) as Record<string, unknown>,
    });
  } catch {
    /* never break the caller */
  }
  // Fire-and-forget: alerts must never break the caller. Serverless may cut
  // this short after the response; critical paths should await sendAdminAlert.
  void import('./email').then(({ sendAdminAlert }) => sendAdminAlert(message, context)).catch(() => {});
}
