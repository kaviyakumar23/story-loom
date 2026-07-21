import Image from 'next/image';
import Link from 'next/link';
import { BRAND } from '@/lib/brand';

/**
 * Hero (reference layout): an illustrated reading scene in an organic frame,
 * the "Stories that stay forever." promise, a single CTA, and an honest
 * micro-proof line. The name-typing interaction now lives in the create flow.
 * Swap the stand-in image for /landing/hero-rooftop.webp when it's generated.
 */
export function HeroCover() {
  return (
    <section className="rhero">
      <div className="container rhero-grid">
        <div className="rhero-copy">
          <p className="rhero-eyebrow">✦ Personalised · Magical · Made for them</p>
          <h1 className="display rhero-title">{BRAND.tagline}</h1>
          <p className="rhero-sub">
            We turn your child into the hero of a beautifully illustrated story — crafted with love,
            imagination and a little moonlight. No photos required.
          </p>
          <div className="rhero-cta-row">
            <Link href="/create" className="btn btn-brand rhero-cta">
              {BRAND.hero.primaryCta}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M5 12h13M13 6l6 6-6 6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Link>
            <Link href="#sample" className="btn btn-ghost">{BRAND.hero.secondaryCta}</Link>
          </div>
          <p className="rhero-proof">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" stroke="var(--brand)" strokeWidth="1.7" strokeLinejoin="round" /></svg>
            No photos · Privacy-first · Made by parents in India
          </p>
        </div>

        <div className="rhero-art">
          <div className="rhero-blob">
            <Image
              src="/landing/herosectionimage.webp"
              alt="A child reading a glowing storybook on a rooftop under a golden moon and bell"
              width={1536}
              height={1024}
              priority
              sizes="(max-width: 900px) 92vw, 560px"
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
            />
          </div>
          <span className="rhero-star" aria-hidden>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M12 1c.5 5.4 4.6 9.5 10 10-5.4.5-9.5 4.6-10 10-.5-5.4-4.6-9.5-10-10C7.4 10.5 11.5 6.4 12 1Z" fill="var(--gold)" /></svg>
          </span>
        </div>
      </div>
    </section>
  );
}
