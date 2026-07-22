import Link from 'next/link';
import { BRAND } from '@/lib/brand';
import { Inscription } from './Inscription';

/**
 * "What happens before you pay" — removes payment anxiety by spelling out
 * exactly what the free preview includes and what the ₹299 unlocks, so a parent
 * never wonders whether card details are needed up front (they aren't).
 */
const BEFORE = [
  'Your child illustrated as the hero, on the cover',
  'The opening pages of their personalised story',
  'No card or UPI details needed to preview',
  'Not quite right? Tweak the details and regenerate',
];
const AFTER = [
  `Pay ${BRAND.product.priceLabel} — only if you love it`,
  'The instant digital PDF, ready right away',
  'Your printed hardcover, shipped in ~7 days',
  'One free revision to a story or illustration',
];

function Check() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M5 12.5l4.2 4.2L19 7" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function BeforeYouPay() {
  return (
    <section className="dband" id="before-pay">
      <div className="container">
        <div style={{ textAlign: 'center', maxWidth: 620, margin: '0 auto 36px' }}>
          <Inscription size="sm">no surprises</Inscription>
          <h2 className="display d-h2" style={{ marginTop: 6 }}>See it first. Pay only if you love it.</h2>
          <p style={{ color: 'var(--ink-soft)', marginTop: 12, fontSize: 16 }}>
            Every book starts as a free preview. You decide after you’ve seen your child in it.
          </p>
        </div>

        <div className="prepay-grid">
          <div className="prepay-card">
            <span className="prepay-tag prepay-free">Free preview</span>
            <ul className="prepay-list prepay-list-free">
              {BEFORE.map((b) => (
                <li key={b}><Check /> {b}</li>
              ))}
            </ul>
          </div>
          <div className="prepay-card">
            <span className="prepay-tag prepay-paid">After you approve · {BRAND.product.priceLabel}</span>
            <ul className="prepay-list prepay-list-paid">
              {AFTER.map((a) => (
                <li key={a}><Check /> {a}</li>
              ))}
            </ul>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 30 }}>
          <Link href="/create" className="btn btn-primary" style={{ padding: '15px 30px', fontSize: 16 }}>
            {BRAND.hero.primaryCta}
          </Link>
        </div>
      </div>
    </section>
  );
}
