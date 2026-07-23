import { LogoMark } from '@/components/logo';
import { PHOTO_LIKENESS_ENABLED } from '@/lib/photo-likeness';

/**
 * Honest "Backed by trust" panel — real credibility (safety, privacy, made by
 * parents) instead of fabricated counts/testimonials, which we don't have yet.
 */
const POINTS = [
  'Every story is safety-checked before it’s delivered',
  PHOTO_LIKENESS_ENABLED
    ? 'Photos are optional — used once, then deleted; a nickname and age band, never a legal name'
    : 'No photos, ever — a nickname and age band, never a legal name',
  'Privacy-first by design, aligned with India’s DPDP Act',
  'Made by parents, in India',
];

export function BackedByTrust() {
  return (
    <section className="dband" id="trust">
      <div className="container backed">
        <div className="backed-emblem"><LogoMark size={44} /></div>
        <h2 className="display backed-h">Made with love.<br />Backed by trust.</h2>
        <ul className="backed-list">
          {POINTS.map((p) => (
            <li key={p}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M5 12.5l4.2 4.2L19 7" stroke="var(--brand)" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              {p}
            </li>
          ))}
        </ul>
        <p className="backed-ai">
          MoonBell uses carefully guided AI to write and illustrate each story — within story
          templates, values and safety rules we design. Every story then passes an independent
          safety check before it reaches your child.
        </p>
        <p className="backed-note">
          We’re a new brand, so you could be one of our first families. Real reactions will appear
          here as parents share them — we’ll never use stock quotes or invented ratings.
        </p>
      </div>
    </section>
  );
}
