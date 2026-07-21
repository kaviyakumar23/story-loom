import Image from 'next/image';
import { Inscription } from './Inscription';

/**
 * Personalisation Transformation — a connected assembly (NOT three cards):
 * a few real details on the left flow, via an ink arrow, into the illustrated
 * hero on the right, with a consistency strip beneath. Replaces the old
 * "how it works" + "benefits" three-column card grids.
 */
const DETAILS = [
  { label: 'their nickname', value: <span className="pt-name">Aarav</span>, out: 'names the character' },
  { label: 'how they look', value: (
    <span className="pt-swatches">
      <i style={{ background: '#C68A63' }} /><i style={{ background: '#2b2769' }} /> curly hair · glasses
    </span>
  ), out: 'draws the hero' },
  { label: 'what they love', value: (
    <span className="pt-tags"><em>dinosaurs</em><em>the moon</em><em>cricket</em></span>
  ), out: 'fills the world' },
  { label: 'a gentle lesson', value: <span className="pt-lesson">bedtime courage</span>, out: 'shapes the story' },
];

export function Personalisation() {
  return (
    <section className="dband" id="how">
      <div className="container">
        <div style={{ maxWidth: 660, margin: '0 auto 44px', textAlign: 'center' }}>
          <Inscription size="sm">the little things that make it theirs</Inscription>
          <h2 className="display d-h2" style={{ marginTop: 8 }}>A few details become their very own hero</h2>
        </div>

        <div className="pt-grid">
          <ol className="pt-details">
            {DETAILS.map((d, i) => (
              <li key={d.label} className="pt-detail">
                <span className="pt-step">{i + 1}</span>
                <div className="pt-detail-body">
                  <span className="pt-detail-label">{d.label}</span>
                  <div className="pt-value">{d.value}</div>
                  <span className="pt-out">→ {d.out}</span>
                </div>
              </li>
            ))}
          </ol>

          <div className="pt-arrow" aria-hidden>
            <svg viewBox="0 0 140 60" fill="none" preserveAspectRatio="none">
              <path d="M4 30 C 46 8, 92 52, 130 30" stroke="var(--brand)" strokeWidth="2.4" strokeDasharray="3 8" strokeLinecap="round" />
              <path d="M119 20 L133 30 L119 40" stroke="var(--brand)" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div className="pt-hero">
            <Image
              src="/landing/hero-neutral.webp"
              alt="Aarav, illustrated as the hero of his own story"
              width={1448}
              height={1086}
              sizes="(max-width: 860px) 74vw, 400px"
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
            <Inscription underline className="pt-hero-note">…and Aarav steps into the story</Inscription>
          </div>
        </div>

        <div className="pt-consistency">
          <Image
            src="/landing/hero-character.webp"
            alt="The same illustrated child shown in three consistent poses across the book"
            width={2171}
            height={724}
            sizes="(max-width: 860px) 92vw, 720px"
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
          <p className="pt-consistency-label">
            <Inscription size="sm">the same child — on every single page</Inscription>
          </p>
        </div>
      </div>
    </section>
  );
}
