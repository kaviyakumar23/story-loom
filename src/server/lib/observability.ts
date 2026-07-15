/**
 * Error tracking + alerts (§12). Console-based for now; wire up Sentry via the
 * official `@sentry/nextjs` integration when you're ready (it hooks Next's
 * instrumentation properly). The captureError/alert API stays stable so callers
 * don't change.
 */
export function initObservability(): void {
  // no-op placeholder; add @sentry/nextjs init here later.
}

export function captureError(err: unknown, context?: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.error('[captureError]', err instanceof Error ? (err.stack ?? err.message) : err, context ?? {});
}

/** A threshold alert — structured log + best-effort email to ALERT_EMAIL. */
export function alert(message: string, context?: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.warn(`[alert] ${message}`, context ?? {});
  // Fire-and-forget: alerts must never break the caller. Serverless may cut
  // this short after the response; critical paths should await sendAdminAlert.
  void import('./email').then(({ sendAdminAlert }) => sendAdminAlert(message, context)).catch(() => {});
}
