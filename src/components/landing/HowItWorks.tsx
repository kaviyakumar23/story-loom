import type { ReactNode } from 'react';
import { Inscription } from './Inscription';

/**
 * Four steps, because that is how many decisions the parent actually makes:
 * describe, look, buy, receive. The old five split "we write it" and "you
 * review it" into separate beats, which made our work sound like a step the
 * parent has to wait through rather than part of seeing the preview.
 */
const STEPS: { t: string; d: string; c: string; icon: ReactNode }[] = [
  { t: 'Describe your child', d: 'A nickname, how they look, what they love, and the lesson you want the story to carry. About three minutes.', c: 'var(--brand)', icon: <><path d="M4 20l3-1L18 8a2 2 0 0 0-3-3L4 16l-1 4Z" /><path d="M14 6l3 3" /></> },
  { t: 'See the preview, free', d: 'The cover and first three illustrated pages of their own story — before you decide anything.', c: 'var(--coral)', icon: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" /><circle cx="12" cy="12" r="2.5" /></> },
  { t: 'Approve it and order', d: 'Happy with it? Order the hardcover. Something not right? Tell us and we’ll change it first.', c: 'var(--gold)', icon: <><path d="M4 12l5 5L20 6" /></> },
  { t: 'We check, print and post it', d: 'A person reads every page before it prints. Dispatched within 7 working days.', c: 'var(--sky)', icon: <><path d="M5 4h11a2 2 0 0 1 2 2v14l-6-2.5L6 20V6a2 2 0 0 1 2-2Z" /><path d="M9 8h6" /></> },
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
