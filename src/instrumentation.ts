// Next.js server instrumentation hook. Registers the Sentry runtime config for
// whichever server runtime is booting, and forwards uncaught request errors
// (Server Components, route handlers, server actions) to Sentry.
import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
