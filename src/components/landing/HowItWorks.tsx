import type { ReactNode } from 'react';
import { Inscription } from './Inscription';

const STEPS: { t: string; d: string; c: string; icon: ReactNode }[] = [
  { t: 'Tell us about them', d: 'A nickname, how they look, what they love, and a gentle lesson.', c: 'var(--brand)', icon: <><path d="M4 20l3-1L18 8a2 2 0 0 0-3-3L4 16l-1 4Z" /><path d="M14 6l3 3" /></> },
  { t: 'Meet their character', d: 'See your child illustrated as the hero — free, before you pay.', c: 'var(--coral)', icon: <><circle cx="12" cy="8" r="3.4" /><path d="M5.5 19c.6-3.3 3.2-5.2 6.5-5.2S17.9 15.7 18.5 19" /></> },
  { t: 'We create the story', d: 'Guided AI writes and illustrates a story made just for them.', c: 'var(--gold)', icon: <><path d="M5 12h5M12 5v5" /><path d="M15 15l5 5M17 13l4-4-2-2-4 4Z" /></> },
  { t: 'Review & revise', d: 'Read the preview and ask for a change if it isn’t quite right.', c: 'var(--sky)', icon: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" /><circle cx="12" cy="12" r="2.5" /></> },
  { t: 'Download the PDF', d: 'Get the full 16–20 page book — reread it, or print at home.', c: 'var(--brand)', icon: <><path d="M12 4v10M8 10l4 4 4-4" /><path d="M5 19h14" /></> },
];

export function HowItWorks() {
  return (
    <section className="dband dband-soft" id="how-timeline">
      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <Inscription size="sm">how it works</Inscription>
          <h2 className="display d-h2" style={{ marginTop: 6 }}>From your details to their bedtime</h2>
        </div>
        <ol className="hiw">
          {STEPS.map((s, i) => (
            <li key={s.t} className="hiw-step">
              <span className="hiw-ic" style={{ color: s.c, background: 'color-mix(in srgb, ' + s.c + ' 14%, #fff)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{s.icon}</svg>
              </span>
              <h3 className="hiw-t"><span className="hiw-n">{i + 1}.</span> {s.t}</h3>
              <p className="hiw-d">{s.d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
