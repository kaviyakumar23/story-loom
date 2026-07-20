'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BRAND } from '@/lib/brand';
import { LogoMark } from '@/components/logo';
import { Icon } from '@/components/ui';

const STARS = [
  { top: '8%', left: '18%', s: 5 },
  { top: '20%', left: '40%', s: 3 },
  { top: '14%', left: '68%', s: 4 },
  { top: '40%', left: '12%', s: 3 },
  { top: '52%', left: '82%', s: 4 },
  { top: '30%', left: '86%', s: 3 },
];

/**
 * Above-the-fold hero. The parent types their child's name and it appears on an
 * animated book cover instantly — the personalization is *shown*, not described,
 * with no account required. Book opens once on mount (reduced-motion safe).
 */
export function HeroCover() {
  const [name, setName] = useState<string>(BRAND.hero.sampleName);
  const shown = name.trim() || BRAND.hero.sampleName;

  return (
    <section className="dband" style={{ paddingTop: 68, paddingBottom: 60 }}>
      <div className="container grid-2 hero-grid">
        <div>
          <span className="eyebrow"><Icon name="star" size={14} stroke="var(--gold)" /> {BRAND.tagline}</span>
          <h1 className="display d-h1 hero-headline" style={{ marginTop: 16 }}>{BRAND.hero.headline}</h1>
          <p className="d-lead hero-sub">{BRAND.hero.sub}</p>

          <label className="hero-name-label" htmlFor="hero-name">
            Type your child&apos;s name — watch their book appear
          </label>
          <input
            id="hero-name"
            className="input hero-name-input"
            value={name}
            maxLength={16}
            onChange={(e) => setName(e.target.value)}
            placeholder={BRAND.hero.sampleName}
            aria-label="Your child's name"
            autoComplete="off"
          />

          <div className="hero-cta-row">
            <Link href="/create" className="btn btn-primary" style={{ padding: '17px 26px', fontSize: 16.5 }}>
              {BRAND.hero.primaryCta}
            </Link>
            <Link href="#sample" className="btn btn-ghost" style={{ padding: '17px 24px' }}>
              {BRAND.hero.secondaryCta}
            </Link>
          </div>
          <p className="hero-trust">
            <Icon name="shield" size={16} stroke="var(--brand)" /> {BRAND.hero.trustLine}
          </p>
        </div>

        <div className="book-stage">
          <div
            className="book-cover"
            role="img"
            aria-label={`Storybook cover: ${shown} ${BRAND.hero.sampleTitleSuffix}`}
          >
            <div className="book-moon" aria-hidden />
            {STARS.map((st, k) => (
              <span
                key={k}
                className="book-star"
                aria-hidden
                style={{ top: st.top, left: st.left, width: st.s, height: st.s, animationDelay: `${k * 90}ms` }}
              />
            ))}
            <div className="book-title">
              <span className="book-title-name">{shown}</span>
              <span className="book-title-rest">{BRAND.hero.sampleTitleSuffix}</span>
            </div>
            <div className="book-brandline">
              <LogoMark size={15} moon="#EFEEFF" /> {BRAND.name}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
