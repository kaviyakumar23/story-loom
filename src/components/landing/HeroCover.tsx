'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BRAND } from '@/lib/brand';
import { LogoMark } from '@/components/logo';
import { Inscription } from './Inscription';
import { StoryWindow } from './StoryWindow';

const STARS = [
  { top: '10%', left: '20%', s: 4 },
  { top: '22%', left: '44%', s: 3 },
  { top: '15%', left: '72%', s: 4 },
  { top: '34%', left: '14%', s: 3 },
  { top: '30%', left: '84%', s: 3 },
];

/**
 * Interactive hero. The parent writes their child's name on a fill-in-the-blank
 * line and it inks itself onto a real book cover — set inside a Story Window
 * that opens once to the night scene. Personalization is *shown*, no account.
 */
export function HeroCover() {
  const [name, setName] = useState<string>(BRAND.hero.sampleName);
  const shown = name.trim() || BRAND.hero.sampleName;

  return (
    <section className="dband" style={{ paddingTop: 64, paddingBottom: 60 }}>
      <div className="container grid-2 hero-grid">
        <div>
          <Inscription size="sm" className="hero-kicker">a bedtime story, made just for them</Inscription>
          <h1 className="display d-h1 hero-headline" style={{ marginTop: 8 }}>{BRAND.hero.headline}</h1>
          <p className="d-lead hero-sub">{BRAND.hero.sub}</p>

          <label className="hero-name-label" htmlFor="hero-name">Write their name</label>
          <div className="hero-name-line">
            <input
              id="hero-name"
              className="hero-name-field"
              value={name}
              maxLength={16}
              onChange={(e) => setName(e.target.value)}
              placeholder={BRAND.hero.sampleName}
              aria-label="Your child's name"
              autoComplete="off"
            />
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 20l4-1L20 7a2 2 0 0 0-3-3L5 16l-1 4Z" stroke="var(--brand)" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
          </div>

          <div className="hero-cta-row">
            <Link href="/create" className="btn btn-primary" style={{ padding: '17px 26px', fontSize: 16.5 }}>
              {BRAND.hero.primaryCta}
            </Link>
            <Link href="#sample" className="btn btn-ghost" style={{ padding: '17px 24px' }}>
              {BRAND.hero.secondaryCta}
            </Link>
          </div>
          <p className="hero-trust">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" stroke="var(--brand)" strokeWidth="1.7" strokeLinejoin="round" />
            </svg>
            {BRAND.hero.trustLine}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <StoryWindow frameStyle={{ width: 'min(380px, 84vw)', aspectRatio: '3 / 3.5' }}>
            <div className="hero-scene">
              <span className="book-moon" aria-hidden />
              {STARS.map((st, k) => (
                <span key={k} className="book-star" aria-hidden style={{ top: st.top, left: st.left, width: st.s, height: st.s, animationDelay: `${k * 90}ms` }} />
              ))}
              <div
                className="hero-book-inset"
                role="img"
                aria-label={`Storybook cover: ${shown} ${BRAND.hero.sampleTitleSuffix}`}
                style={{ aspectRatio: '3 / 4' }}
              >
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(158deg, #322e78, #5653C6 62%, #6E6AD6)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', padding: '0 10% 11%' }}>
                  <span style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 'clamp(20px, 5.4vw, 30px)', color: '#F5C85B', lineHeight: 1.03, textAlign: 'center', textShadow: '0 3px 12px rgba(0,0,0,.4)', wordBreak: 'break-word' }}>{shown}</span>
                  <span style={{ fontFamily: 'var(--display)', fontStyle: 'italic', fontWeight: 600, fontSize: 13.5, color: '#EAE8FB', marginTop: 6, textAlign: 'center' }}>{BRAND.hero.sampleTitleSuffix}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 14, color: '#C9C7EA', fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                    <LogoMark size={13} moon="#EFEEFF" /> {BRAND.name}
                  </span>
                </div>
              </div>
            </div>
          </StoryWindow>
          <Inscription underline style={{ marginTop: 4 }}>One brave little hero</Inscription>
        </div>
      </div>
    </section>
  );
}
