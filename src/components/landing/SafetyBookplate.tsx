import { LogoMark } from '@/components/logo';
import { Inscription } from './Inscription';

/**
 * Parent Safety Bookplate — privacy as a warm inside-cover "ex libris"
 * bookplate with a clean checklist, not a legalistic grid of cards.
 */
const POINTS = [
  { t: 'No photos, ever', d: 'You describe how they look — we never ask for or store a single photo.' },
  { t: 'A nickname, never a real name', d: 'An age band, not a birthday. The least we can collect to make the magic.' },
  { t: 'Never used to train AI', d: 'Their details are never sent to an AI vendor or used to train models.' },
  { t: 'Delete everything, anytime', d: 'One tap and it’s gone. You stay in control of your family’s data, always.' },
];

export function SafetyBookplate() {
  return (
    <section className="dband" id="privacy">
      <div className="container" style={{ maxWidth: 720, margin: '0 auto' }}>
        <div className="bookplate">
          <div className="bookplate-emblem"><LogoMark size={38} /></div>
          <p className="bookplate-eyebrow">Ex libris · the parent’s promise</p>
          <h2 className="display" style={{ fontSize: 'clamp(24px, 4vw, 32px)', marginTop: 6 }}>
            Kept as carefully as the story itself
          </h2>
          <ul className="bookplate-list">
            {POINTS.map((p) => (
              <li key={p.t}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M5 12.5l4.2 4.2L19 7" stroke="var(--brand)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div>
                  <h3>{p.t}</h3>
                  <p>{p.d}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="bookplate-sign">
            <Inscription underline>kept safe, always</Inscription>
          </div>
        </div>
      </div>
    </section>
  );
}
