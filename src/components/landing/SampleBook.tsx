'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { LogoMark } from '@/components/logo';
import { BRAND } from '@/lib/brand';

/**
 * A real, readable sample book — cover, story-text pages, and a closing page —
 * so a parent can judge story + art quality and, crucially, character
 * consistency before committing. This is one coherent story ("Aarav and the
 * Star That Listens"): the same hero, same outfit, same paper-cut art on every
 * interior page. Advance by button, dot, arrow key, or swipe.
 *
 * The downloadable PDF (public/sample/, built by scripts/build-sample-pdf.mjs)
 * mirrors the real product format, so the sample matches what parents receive.
 */
const TITLE = `${BRAND.hero.sampleName} ${BRAND.hero.sampleTitleSuffix}`;

type Page =
  | { kind: 'cover'; src: string; alt: string; label: string }
  | { kind: 'spread'; src: string; alt: string; text: string; label: string }
  | { kind: 'end'; label: string };

const PAGES: Page[] = [
  { kind: 'cover', src: '/landing/herosectionimage.webp', alt: `Cover — ${BRAND.hero.sampleName} reading beneath the moon and bell`, label: 'Cover' },
  {
    kind: 'spread',
    src: '/landing/jasmine-spread.webp',
    alt: `${BRAND.hero.sampleName} reaching up to a smiling star in a jasmine garden`,
    text: `${BRAND.hero.sampleName} reached up on tiptoe. “Star,” he whispered, “can you really hear me?” The little star gave a wink — and leaned in close to listen.`,
    label: 'Page 1',
  },
  {
    kind: 'spread',
    src: '/landing/moon-watch-spread.webp',
    alt: `${BRAND.hero.sampleName} on a moonlit hill beneath the golden moon and bell`,
    text: `So ${BRAND.hero.sampleName} climbed the moonlit hill and asked his one small question. High above, the golden bell rang the softest ring — as if the whole sky had been waiting to answer.`,
    label: 'Page 2',
  },
  { kind: 'end', label: 'The End' },
];

const META = [
  { k: 'Length', v: BRAND.product.pages },
  { k: 'Reading level', v: BRAND.product.ageRange },
  { k: 'Format', v: BRAND.product.format },
  { k: 'Hero', v: 'One consistent character' },
];

export function SampleBook() {
  const [i, setI] = useState(0);
  const startX = useRef<number | null>(null);
  const last = PAGES.length - 1;
  const go = (n: number) => setI((v) => Math.max(0, Math.min(last, v + n)));
  const page = PAGES[i];

  return (
    <div className="sb">
      <div className="sb-meta" aria-hidden>
        {META.map((m) => (
          <span key={m.k} className="sb-meta-item"><strong>{m.k}</strong>{m.v}</span>
        ))}
      </div>

      <div className="sb-frame">
        <button className="sb-arrow sb-arrow-l" onClick={() => go(-1)} disabled={i === 0} aria-label="Previous page"><Chevron dir="left" /></button>

        <div
          className="sb-stage"
          tabIndex={0}
          role="group"
          aria-label={`Sample storybook: ${TITLE}, page-by-page`}
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
          <div key={i} className={`sb-page turn sb-page--${page.kind}`}>
            {page.kind === 'end' ? (
              <div className="sb-end">
                <LogoMark size={40} />
                <h3 className="display">The End</h3>
                <p>That was a MoonBell sample. Your child’s own story is next — with their name, their world, and their hero.</p>
                <Link href="/create" className="btn btn-primary">{BRAND.hero.primaryCta}</Link>
              </div>
            ) : (
              <>
                <Image src={page.src} alt={page.alt} fill sizes="(max-width: 860px) 94vw, 720px" style={{ objectFit: 'cover' }} priority={i === 0} />
                {page.kind === 'cover' ? (
                  <div className="sb-cover-plate">
                    <span className="sb-cover-kicker">A MoonBell sample story</span>
                    <h3 className="display">{TITLE}</h3>
                  </div>
                ) : (
                  <div className="sb-text"><p>{page.text}</p></div>
                )}
              </>
            )}
          </div>
        </div>

        <button className="sb-arrow sb-arrow-r" onClick={() => go(1)} disabled={i === last} aria-label="Next page"><Chevron dir="right" /></button>
      </div>

      <div className="sb-controls">
        <div className="sb-dots" role="tablist" aria-label="Jump to page">
          {PAGES.map((p, k) => (
            <button key={k} className={`sb-dot${k === i ? ' on' : ''}`} onClick={() => setI(k)} aria-label={`Go to ${p.label}`} aria-selected={k === i} role="tab" />
          ))}
        </div>
        <span className="sb-counter">{page.label} · {i + 1} / {PAGES.length}</span>
      </div>

      <div className="sb-foot">
        <p className="sb-consistency">
          <span className="sb-spark">✦</span> Same hero, same outfit, same art — every single page. That coherence is what makes it a real book, not a name swap.
        </p>
        <a className="btn btn-ghost sb-download" href="/sample/moonbell-sample-story.pdf" download>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 4v10M8 10l4 4 4-4" /><path d="M5 19h14" /></svg>
          Download this sample (PDF)
        </a>
      </div>
    </div>
  );
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d={dir === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
