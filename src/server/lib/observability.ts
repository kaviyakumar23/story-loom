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

/** A threshold alert — structured log for now (route to Sentry/Slack later). */
export function alert(message: string, context?: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.warn(`[alert] ${message}`, context ?? {});
}
