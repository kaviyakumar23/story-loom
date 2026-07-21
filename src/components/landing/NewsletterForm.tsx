'use client';

import { useState } from 'react';

/**
 * Newsletter / notify-me capture. Client-side only for now — shows a thank-you.
 * TODO: wire to a real list (Resend/Supabase) before launch; today it does not
 * persist the email, so don't imply it's subscribed beyond the session.
 */
export function NewsletterForm({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);

  if (done) {
    return <p className={`news-done news-${variant}`}>Thanks — we’ll let you know the moment it’s ready. ✦</p>;
  }
  return (
    <form
      className={`news news-${variant}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (email.trim()) setDone(true);
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
      <button className="news-btn" type="submit" aria-label="Notify me">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </form>
  );
}
