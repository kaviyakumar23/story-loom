'use client';

import { useEffect } from 'react';
import { observePage, track } from '@/lib/analytics';

/**
 * Mounts the landing page's measurement.
 *
 * A client island rather than instrumentation sprinkled through the page, so
 * the page itself stays a server component and the tracking lives in one place
 * someone can read and delete.
 *
 * CTA clicks are captured by delegation: every link to /create reports which
 * section it was in, which means adding or moving a button never silently drops
 * it out of the funnel.
 */
export function PageAnalytics() {
  useEffect(() => {
    track('landing_view');
    track('price_seen');
    const stop = observePage();

    const onClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement | null)?.closest?.('a[href="/create"]');
      if (!link) return;
      track('cta_click', { target: sectionOf(link) });
    };
    const onToggle = (e: Event) => {
      const el = e.target as HTMLElement;
      if (el.tagName === 'DETAILS' && (el as HTMLDetailsElement).open) track('faq_open');
    };

    document.addEventListener('click', onClick, { capture: true });
    document.addEventListener('toggle', onToggle, { capture: true });
    return () => {
      document.removeEventListener('click', onClick, { capture: true });
      document.removeEventListener('toggle', onToggle, { capture: true });
      stop();
    };
  }, []);

  return null;
}

/** Which part of the page a control lives in — an enum, never free text. */
function sectionOf(el: Element): 'hero' | 'header' | 'sticky' | 'pricing' | 'sample' | 'final' | 'product' {
  if (el.closest('.sticky-cta')) return 'sticky';
  if (el.closest('.web-header')) return 'header';
  if (el.closest('.hero')) return 'hero';
  if (el.closest('#pricing')) return 'pricing';
  if (el.closest('#the-book')) return 'product';
  if (el.closest('#sample')) return 'sample';
  return 'final';
}
