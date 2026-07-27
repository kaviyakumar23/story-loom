// Sentry — Edge runtime (middleware, edge route handlers). Loaded by
// src/instrumentation.ts when NEXT_RUNTIME === 'edge'.
import * as Sentry from '@sentry/nextjs';

const DSN =
  process.env.SENTRY_DSN ||
  process.env.NEXT_PUBLIC_SENTRY_DSN ||
  'https://8fd77443f8807ba0062ea69133508b4b@o4510419051872257.ingest.de.sentry.io/4511806752948304';

Sentry.init({
  dsn: DSN,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  sendDefaultPii: false,
});
