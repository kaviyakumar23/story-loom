import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BRAND } from '@/lib/brand';

/**
 * Hero — matched to the reference mockup, fitted to the viewport: full-bleed
 * illustration on the right (soft left edge into the cream), the concrete
 * promise + price + free-preview on the left, and the 5-reason feature strip
 * floating at the bottom above an indigo star-wave.
 *
 * HONESTY: no fabricated social proof. As a new brand we don't have customer
 * counts or ratings, so we show truthful trust chips instead of invented
 * "10,000+ families / 4.9/5" numbers. Copy is digital-first (a PDF, not a
 * physical book) and never claims human hand-painting or human review of every
 * page — the safety pass is an independent automated classifier.
 */
const FEATURES: { t: string; d: string; c: string; icon: ReactNode }[] = [
  { t: 'Your child, the hero', d: 'We personalise every detail so the story is truly theirs.', c: 'var(--brand)', icon: <><circle cx="12" cy="8" r="3.4" /><path d="M5.5 19c.6-3.3 3.2-5.2 6.5-5.2S17.9 15.7 18.5 19" /><path d="M18 4.5l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6L15 6.8l1.6-.7L18 4.5Z" /></> },
  { t: 'Made-for-them art', d: 'Original illustrations created just for your child.', c: 'var(--coral)', icon: <><path d="M4 20l3-1L18 8a2 2 0 0 0-3-3L4 16l-1 4Z" /><path d="M14 6l3 3" /></> },
  { t: 'Safe & private', d: 'No photos required. Your child’s data is never shared.', c: 'var(--gold)', icon: <><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" /><path d="M9 12l2 2 4-4" /></> },
  { t: 'Yours to keep', d: 'A printed hardcover to treasure — plus the instant digital PDF.', c: 'var(--sky)', icon: <><path d="M5 4h11a2 2 0 0 1 2 2v14l-6-2.5L6 20V6a2 2 0 0 1 2-2Z" /><path d="M9 8h6" /></> },
  { t: 'For every milestone', d: 'From first days to big feelings — a story for every chapter.', c: 'var(--brand)', icon: <path d="M12 20s-6.5-4-8.5-8.2C2 8.7 3.7 6 6.5 6 8.3 6 9.5 7 12 9.4 14.5 7 15.7 6 17.5 6c2.8 0 4.5 2.7 3 5.8C18.5 16 12 20 12 20Z" /> },
];

// Truthful trust chips — no counts or ratings we can't substantiate.
const TRUST = [
  'Free preview before you pay',
  'No child photos — ever',
  'Safety-checked for children',
  'Made by parents, in India',
];

export function HeroCover() {
  return (
    <section className="hero">
      <div className="hero-art">
        <Image
          src="/landing/herosectionimage.webp"
          alt="A child reading a glowing storybook on a rooftop under a golden moon and bell"
          fill
          priority
          sizes="(max-width: 900px) 100vw, 60vw"
          style={{ objectFit: 'cover', objectPosition: 'center' }}
        />
      </div>

      <div className="container hero-body">
        <div className="hero-copy">
          <p className="hero-eyebrow"><span className="hero-spark">✦</span> Personalised. Magical. Made for them.</p>
          <h1 className="display hero-title">{BRAND.tagline}</h1>
          <p className="hero-sub">
            We turn your child into the hero of a beautifully illustrated story — built from their
            nickname, how they look, what they love, and a gentle lesson you choose.
          </p>
          <p className="hero-spec">{BRAND.hero.specLine}</p>

          <div className="hero-ctas">
            <Link href="/create" className="btn btn-brand hero-cta">
              {BRAND.hero.primaryCta}
              <span className="hero-cta-spark">✦</span>
            </Link>
            <Link href="/#sample" className="btn btn-ghost hero-cta2">{BRAND.hero.secondaryCta}</Link>
          </div>

          <ul className="hero-trust">
            {TRUST.map((t) => (
              <li key={t}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M5 12.5l4.2 4.2L19 7" stroke="var(--brand)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="container hero-features">
        <div className="feat-strip">
          {FEATURES.map((f) => (
            <div key={f.t} className="feat">
              <span className="feat-ic" style={{ color: f.c, background: 'color-mix(in srgb, ' + f.c + ' 14%, #fff)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{f.icon}</svg>
              </span>
              <div className="feat-txt">
                <h3 className="feat-t">{f.t}</h3>
                <p className="feat-d">{f.d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="hero-wave" aria-hidden>
        <svg viewBox="0 0 1440 110" preserveAspectRatio="none">
          <path d="M0,54 C 240,96 480,20 720,44 C 960,68 1200,104 1440,58 L1440,110 L0,110 Z" fill="var(--brand-deep)" />
          <g fill="var(--gold)" opacity="0.8">
            <circle cx="180" cy="86" r="2.2" /><circle cx="520" cy="92" r="1.8" /><circle cx="900" cy="88" r="2.4" /><circle cx="1240" cy="94" r="2" /><circle cx="1360" cy="82" r="1.6" />
          </g>
        </svg>
      </div>
    </section>
  );
}
