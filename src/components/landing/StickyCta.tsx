'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BRAND } from '@/lib/brand';

/**
 * Compact sticky CTA for mobile only — appears once the parent has scrolled past
 * the hero so a convinced reader never has to hunt for the button. Hidden on
 * desktop (the header CTA is always visible there) and until scroll, so it never
 * blocks the initial product explanation.
 */
export function StickyCta() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 640);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className={`sticky-cta${show ? ' on' : ''}`}>
      <div className="sticky-cta-inner">
        <span className="sticky-cta-txt">Free preview · pay {BRAND.product.priceLabel} only if you love it</span>
        <Link href="/create" className="btn btn-brand btn-sm sticky-cta-btn">{BRAND.hero.primaryCta}</Link>
      </div>
    </div>
  );
}
