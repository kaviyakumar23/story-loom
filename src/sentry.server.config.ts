// Sentry — Node.js server runtime. Loaded by src/instrumentation.ts when
// NEXT_RUNTIME === 'nodejs'. The DSN is public by design; prefer the env var,
// fall back to the literal so error capture works even before env is wired.
import * as Sentry from '@sentry/nextjs';

const DSN =
  process.env.SENTRY_DSN ||
  process.env.NEXT_PUBLIC_SENTRY_DSN ||
  'https://8fd77443f8807ba0062ea69133508b4b@o4510419051872257.ingest.de.sentry.io/4511806752948304';

Sentry.init({
  dsn: DSN,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  // 100% locally, 10% in prod — enough server request tracing without cost blowup.
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  // MoonBell is minimal-data by design. Keep Sentry off PII: no request bodies,
  // cookies, or IPs; and DON'T attach local variables to frames — a stack frame
  // in the pipeline could otherwise carry a child's nickname/attributes.
  sendDefaultPii: false,
  includeLocalVariables: false,
});
