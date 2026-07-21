import type { ReactNode } from 'react';
import { Inscription } from './Inscription';
import { NewsletterForm } from './NewsletterForm';

const ITEMS: { t: string; d: string; icon: ReactNode }[] = [
  { t: 'Audio stories', d: 'Narrated stories your child will love.', icon: <><path d="M4 14v-3a8 8 0 0 1 16 0v3" /><rect x="3" y="13" width="4" height="6" rx="1.4" /><rect x="17" y="13" width="4" height="6" rx="1.4" /></> },
  { t: 'Video stories', d: 'Their story brought to life with animation.', icon: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M10 9l5 3-5 3V9Z" /></> },
  { t: 'Keepsakes', d: 'Thoughtful keepsakes to hold on to.', icon: <><path d="M4 9h16v10a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19V9Z" /><path d="M3 5.5h18V9H3zM12 5.5V21" /></> },
  { t: 'Gifts & more', d: 'Meaningful gifts for every special moment.', icon: <><path d="M4 11h16v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8Z" /><path d="M3 7.5h18V11H3zM12 7.5V21M12 7.5C9 7.5 8 3.5 12 3.5S15 7.5 12 7.5Z" /></> },
];

/** "The MoonBell world is growing" — coming-soon range + notify-me (bottom, restrained). */
export function ComingSoon() {
  return (
    <section className="dband dband-soft">
      <div className="container">
        <div style={{ textAlign: 'center', maxWidth: 620, margin: '0 auto 32px' }}>
          <Inscription size="sm">on the way</Inscription>
          <h2 className="display d-h2" style={{ marginTop: 6 }}>The MoonBell world is growing</h2>
          <p style={{ color: 'var(--ink-soft)', marginTop: 12, fontSize: 16 }}>
            Storybooks are here today. These are coming next — want a nudge when they land?
          </p>
        </div>
        <div className="soon-grid">
          {ITEMS.map((i) => (
            <div key={i.t} className="soon-tile">
              <span className="soon-ic">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{i.icon}</svg>
              </span>
              <h3 className="soon-t">{i.t} <span className="soon-tag">soon</span></h3>
              <p className="soon-d">{i.d}</p>
            </div>
          ))}
        </div>
        <div className="soon-notify"><NewsletterForm /></div>
      </div>
    </section>
  );
}
