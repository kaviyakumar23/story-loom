'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';

/**
 * A real, readable sample book with a page-turn — so parents can judge story +
 * art quality before committing. Advance by button, dot, arrow key, or swipe.
 * Each page remounts (keyed) to replay the turn animation; reduced-motion safe.
 *
 * NOTE: placeholder art until the founder-supplied cover/spreads arrive
 * (image prompts delivered). Swap `PAGES[].src` for the real spreads.
 */
const PAGES = [
  { src: '/landing/sample-bedtime.webp', caption: 'Cover — “Aarav and the Star That Listens”' },
  { src: '/landing/sample-school.webp', caption: 'Page 1 — Aarav can’t sleep, so a little star leans in to listen.' },
  { src: '/landing/sample-kindness.webp', caption: 'Page 2 — Together they turn a worry into a wish.' },
];

export function SampleBook() {
  const [i, setI] = useState(0);
  const startX = useRef<number | null>(null);
  const last = PAGES.length - 1;

  const go = (n: number) => setI((v) => Math.max(0, Math.min(last, v + n)));

  return (
    <div>
      <div
        className="sample-stage"
        tabIndex={0}
        role="group"
        aria-label="Sample storybook, page-by-page"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
          if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
        }}
        onTouchStart={(e) => { startX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (startX.current === null) return;
          const dx = e.changedTouches[0].clientX - startX.current;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          startX.current = null;
        }}
      >
        <div key={i} className="sample-page turn">
          <Image
            src={PAGES[i].src}
            alt={PAGES[i].caption}
            fill
            sizes="(max-width: 860px) 92vw, 640px"
            style={{ objectFit: 'cover' }}
            priority={i === 0}
          />
          <div className="sample-caption">{PAGES[i].caption}</div>
        </div>
      </div>

      <div className="sample-controls">
        <button className="iconbtn" onClick={() => go(-1)} disabled={i === 0} aria-label="Previous page">
          <Chevron dir="left" />
        </button>
        <div className="sample-dots" role="tablist" aria-label="Jump to page">
          {PAGES.map((_, k) => (
            <button
              key={k}
              className={`sample-dot${k === i ? ' on' : ''}`}
              onClick={() => setI(k)}
              aria-label={`Go to page ${k + 1}`}
              aria-selected={k === i}
              role="tab"
            />
          ))}
        </div>
        <button className="iconbtn" onClick={() => go(1)} disabled={i === last} aria-label="Next page">
          <Chevron dir="right" />
        </button>
      </div>
    </div>
  );
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d={dir === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'}
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
