'use client';

import { useState } from 'react';

/**
 * Newsletter / notify-me capture — persists to newsletter_subscribers via
 * /api/v1/newsletter (and mirrors to Resend when configured).
 */
export function NewsletterForm({ variant = 'light', source }: { variant?: 'light' | 'dark'; source?: string }) {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (done) {
    return <p className={`news-done news-${variant}`}>Thanks — we’ll let you know the moment it’s ready. ✦</p>;
  }
  return (
    <form
      className={`news news-${variant}`}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!email.trim() || busy) return;
        setBusy(true);
        try {
          await fetch('/api/v1/newsletter', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email: email.trim(), source }),
          });
          setDone(true); // treat as success even if offline — we don't block the parent
        } finally {
          setBusy(false);
        }
      }}
    >
      <input
        type="email"
        required
        className="news-input"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-label="Email address"
      />
      <button className="news-btn" type="submit" aria-label="Notify me" disabled={busy}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </form>
  );
}
