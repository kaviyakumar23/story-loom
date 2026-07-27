// Sentry — browser/client runtime. Next.js loads this automatically.
import * as Sentry from '@sentry/nextjs';

const DSN =
  process.env.NEXT_PUBLIC_SENTRY_DSN ||
  'https://8fd77443f8807ba0062ea69133508b4b@o4510419051872257.ingest.de.sentry.io/4511806752948304';

Sentry.init({
  dsn: DSN,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  // Session Replay is deliberately NOT enabled: the /create flow collects a
  // child's nickname and appearance, and recording sessions (even masked)
  // conflicts with our minimal-data / child-safety posture. Revisit only with
  // an explicit privacy review.
  sendDefaultPii: false,
});

// Instruments App Router client-side navigations for tracing.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
