import Image from 'next/image';
import Link from 'next/link';
import { BRAND } from '@/lib/brand';

/** Indigo final-CTA banner with an illustrated child (reference layout). */
export function FinalCta() {
  return (
    <section className="dband">
      <div className="container">
        <div className="finalcta">
          <div className="finalcta-copy">
            <h2 className="display">Ready to start their story?</h2>
            <p>Create a personalised storybook that becomes a part of their world.</p>
            <Link href="/create" className="btn finalcta-btn">
              {BRAND.hero.primaryCta}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M5 12h13M13 6l6 6-6 6" stroke="var(--ink-line)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Link>
          </div>
          <div className="finalcta-art">
            <Image
              src="/landing/8A.webp"
              alt="A child holding a glowing lantern under the moon"
              width={1024}
              height={1536}
              sizes="(max-width: 860px) 60vw, 320px"
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
