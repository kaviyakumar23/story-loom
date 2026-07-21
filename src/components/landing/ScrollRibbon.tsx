'use client';

import { useEffect, useState } from 'react';

/**
 * A ribbon bookmark on the left margin whose tail descends with scroll progress
 * — the homepage feels like a book you're leafing through. It's a position
 * indicator (tracks scroll directly, no easing/autoplay), and it's hidden on
 * narrow viewports so it never crowds the content.
 */
export function ScrollRibbon() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
      });
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="scroll-ribbon" aria-hidden="true" style={{ '--p': progress } as React.CSSProperties}>
      <span className="scroll-ribbon-fill" />
    </div>
  );
}
