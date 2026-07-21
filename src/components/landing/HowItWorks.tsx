import type { ReactNode } from 'react';
import { Inscription } from './Inscription';

const STEPS: { t: string; d: string; c: string; icon: ReactNode }[] = [
  { t: 'Tell us about them', d: 'Share a few details about your child and their world.', c: 'var(--brand)', icon: <><path d="M4 20l3-1L18 8a2 2 0 0 0-3-3L4 16l-1 4Z" /><path d="M14 6l3 3" /></> },
  { t: 'We create the magic', d: 'Our storytellers and artists craft a story just for them.', c: 'var(--coral)', icon: <><path d="M5 12h5M12 5v5" /><path d="M15 15l5 5M17 13l4-4-2-2-4 4Z" /></> },
  { t: 'Preview & approve', d: 'See the free preview and request changes if needed.', c: 'var(--gold)', icon: <><path d="M4 6h13a2 2 0 0 1 0 4H4Z" /><path d="M4 14h16" /><path d="M4 18h10" /></> },
  { t: 'Made with love', d: 'Your keepsake is prepared with care and quality.', c: 'var(--sky)', icon: <><path d="M4 8l8-4 8 4-8 4-8-4Z" /><path d="M4 8v8l8 4 8-4V8" /></> },
  { t: 'Delivered to you', d: 'A story they’ll treasure — today and always.', c: 'var(--brand)', icon: <path d="M12 20s-6.5-4-8.5-8.2C2 8.7 3.7 6 6.5 6 8.3 6 9.5 7 12 9.4 14.5 7 15.7 6 17.5 6c2.8 0 4.5 2.7 3 5.8C18.5 16 12 20 12 20Z" /> },
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
