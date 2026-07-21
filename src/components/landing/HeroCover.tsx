import Image from 'next/image';
import Link from 'next/link';
import { BRAND } from '@/lib/brand';

/**
 * Hero (reference Image #9): the illustration bleeds edge-to-edge on the right
 * with a soft left edge fading into the cream; the promise + CTA sit on the
 * left. Honest proof line (no fabricated ratings/counts). Name-typing lives in
 * the create flow.
 */
export function HeroCover() {
  return (
    <section className="rhero2">
      <div className="rhero2-art">
        <Image
          src="/landing/herosectionimage.webp"
          alt="A child reading a glowing storybook on a rooftop under a golden moon and bell"
          fill
          priority
          sizes="(max-width: 900px) 100vw, 58vw"
          style={{ objectFit: 'cover', objectPosition: 'center' }}
        />
      </div>
      <div className="container rhero2-inner">
        <div className="rhero2-copy">
          <p className="rhero-eyebrow">✦ Personalised · Magical · Made for them</p>
          <h1 className="display rhero-title">{BRAND.tagline}</h1>
          <p className="rhero-sub">
            We turn your child into the hero of a beautifully illustrated story — crafted with love,
            imagination and a little moonlight.
          </p>
          <div className="rhero-cta-row">
            <Link href="/create" className="btn btn-brand rhero-cta">
              {BRAND.hero.primaryCta}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M5 12h13M13 6l6 6-6 6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Link>
          </div>
          <p className="rhero-proof">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" stroke="var(--brand)" strokeWidth="1.7" strokeLinejoin="round" /></svg>
            No photos · Privacy-first · Made by parents in India
          </p>
        </div>
      </div>
    </section>
  );
}
