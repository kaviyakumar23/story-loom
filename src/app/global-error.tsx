'use client';

// Root error boundary — catches render errors in the root layout itself, which
// the per-route error.tsx cannot. It replaces the whole document, so it renders
// its own <html>/<body> and inlines styles (globals.css may not have loaded).
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#FFF9F0',
          color: '#242340',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ fontSize: 26, margin: '0 0 10px' }}>Something needs a human</h1>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: '#4B4A5A', margin: '0 0 22px' }}>
            This page hit a snag and our team has been notified. Please try again in a moment.
          </p>
          <a
            href="/"
            style={{
              display: 'inline-block',
              background: '#C9432F',
              color: '#fff',
              fontWeight: 700,
              textDecoration: 'none',
              padding: '13px 24px',
              borderRadius: 999,
            }}
          >
            Back to MoonBell
          </a>
        </div>
      </body>
    </html>
  );
}
