import type { ReactNode } from 'react';

/** Five-reason feature strip (reference layout), in MoonBell's own line icons. */
const FEATURES: { t: string; d: string; c: string; icon: ReactNode }[] = [
  {
    t: 'Your child, the hero', d: 'We personalise every detail to make the story truly theirs.', c: 'var(--brand)',
    icon: <><circle cx="12" cy="8" r="3.4" /><path d="M5.5 19c.6-3.3 3.2-5.2 6.5-5.2S17.9 15.7 18.5 19" /><path d="M18 4.5l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6L15 6.8l1.6-.7L18 4.5Z" /></>,
  },
  {
    t: 'Magical illustrations', d: 'Handcrafted art that sparks wonder and imagination.', c: 'var(--coral)',
    icon: <><path d="M4 20l3-1L18 8a2 2 0 0 0-3-3L4 16l-1 4Z" /><path d="M14 6l3 3" /></>,
  },
  {
    t: 'Safe & private', d: 'No photos required. Your data is always protected.', c: 'var(--gold)',
    icon: <><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" /><path d="M9 12l2 2 4-4" /></>,
  },
  {
    t: 'Made to be kept', d: 'Premium keepsakes to treasure forever.', c: 'var(--sky)',
    icon: <><path d="M5 4h11a2 2 0 0 1 2 2v14l-6-2.5L6 20V6a2 2 0 0 1 2-2Z" /><path d="M9 8h6" /></>,
  },
  {
    t: 'For every milestone', d: 'From childhood to forever — a story for every chapter.', c: 'var(--brand)',
    icon: <path d="M12 20s-6.5-4-8.5-8.2C2 8.7 3.7 6 6.5 6 8.3 6 9.5 7 12 9.4 14.5 7 15.7 6 17.5 6c2.8 0 4.5 2.7 3 5.8C18.5 16 12 20 12 20Z" />,
  },
];

export function FeatureStrip() {
  return (
    <section className="dband" style={{ paddingTop: 8, paddingBottom: 8 }}>
      <div className="container">
        <div className="feat-strip">
          {FEATURES.map((f) => (
            <div key={f.t} className="feat">
              <span className="feat-ic" style={{ color: f.c, background: 'color-mix(in srgb, ' + f.c + ' 14%, #fff)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{f.icon}</svg>
              </span>
              <h3 className="feat-t">{f.t}</h3>
              <p className="feat-d">{f.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
