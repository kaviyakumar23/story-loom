import { LogoMark } from '@/components/logo';

/**
 * Honest "Backed by trust" panel — real credibility (safety, privacy, made by
 * parents) instead of fabricated counts/testimonials, which we don't have yet.
 */
const POINTS = [
  '100% child-safe & human-reviewed',
  'Privacy-first by design (DPDP-aligned)',
  'No photos, ever — and no data shared with third parties',
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
        <p className="backed-note">Be one of our first families — genuine reviews will appear here as parents share them.</p>
      </div>
    </section>
  );
}
