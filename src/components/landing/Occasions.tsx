import Link from 'next/link';
import type { ReactNode } from 'react';
import { Inscription } from './Inscription';

/**
 * Occasion entry-points — turns an abstract product into a recognisable reason
 * to buy. These are moments a parent can pick a lesson/theme around; they map
 * to the "gentle lesson" the story is built on.
 */
const OCCASIONS: { t: string; d: string; icon: ReactNode }[] = [
  { t: 'Birthdays', d: 'Make them the star of their big day.', icon: <><path d="M5 21h14M6 21v-6h12v6" /><path d="M8 15V9m4 6V9m4 6V9" /><path d="M12 3v3" /><circle cx="12" cy="6.5" r=".6" fill="currentColor" /></> },
  { t: 'A new sibling', d: 'Help them become a proud big brother or sister.', icon: <path d="M12 20s-6.5-4-8.5-8.2C2 8.7 3.7 6 6.5 6 8.3 6 9.5 7 12 9.4 14.5 7 15.7 6 17.5 6c2.8 0 4.5 2.7 3 5.8C18.5 16 12 20 12 20Z" /> },
  { t: 'First day of school', d: 'A little courage for a big new step.', icon: <><path d="M4 8l8-4 8 4-8 4-8-4Z" /><path d="M6 10v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" /></> },
  { t: 'Building confidence', d: 'A gentle story about believing in themselves.', icon: <path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7L12 2Z" /> },
  { t: 'Learning kindness', d: 'Values that stay, wrapped in an adventure.', icon: <><circle cx="12" cy="8" r="3.2" /><path d="M5.5 19c.6-3.3 3.2-5.2 6.5-5.2S17.9 15.7 18.5 19" /></> },
  { t: 'Festivals & gifting', d: 'Diwali, Rakhi, or “just because”.', icon: <><path d="M4 11h16v9H4z" /><path d="M12 7v13M4 11l8-4 8 4" /><path d="M9 7a2 2 0 1 1 3-2c1 1 0 2 0 2" /></> },
  { t: 'Bedtime courage', d: 'For brave nights and cosy endings.', icon: <path d="M20 13A8 8 0 1 1 11 4a6 6 0 0 0 9 9Z" /> },
  { t: 'Missing someone', d: 'Comfort when a loved one feels far away.', icon: <><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l1.6-3.2A8.5 8.5 0 1 1 21 11.5Z" /></> },
];

export function Occasions() {
  return (
    <section className="dband" id="occasions">
      <div className="container">
        <div style={{ textAlign: 'center', maxWidth: 620, margin: '0 auto 40px' }}>
          <Inscription size="sm">a story for the moment they’re in</Inscription>
          <h2 className="display d-h2" style={{ marginTop: 6 }}>What’s the story for?</h2>
          <p style={{ color: 'var(--ink-soft)', marginTop: 12, fontSize: 16 }}>
            Choose the moment — we’ll weave the lesson gently into their adventure.
          </p>
        </div>

        <div className="occ-grid">
          {OCCASIONS.map((o) => (
            <Link key={o.t} href="/create" className="occ-tile">
              <span className="occ-ic">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{o.icon}</svg>
              </span>
              <h3 className="occ-t">{o.t}</h3>
              <p className="occ-d">{o.d}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
