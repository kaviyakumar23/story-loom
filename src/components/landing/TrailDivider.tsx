'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

/**
 * Story Trail — a meandering dashed ink path with a small story object, placed
 * between sections so the homepage reads as one continuous journey. The path
 * draws in and the object drops in when scrolled into view; both are fully
 * visible (no animation) under prefers-reduced-motion. Decorative (aria-hidden).
 */
const OBJECTS = {
  bell: { src: '/landing/object-bell.webp', w: 370, h: 398, size: 46 },
  paperboat: { src: '/landing/object-paperboat.webp', w: 913, h: 553, size: 88 },
  pencil: { src: '/landing/object-pencil.webp', w: 745, h: 816, size: 40 },
  leaf: { src: '/landing/object-leaf.webp', w: 741, h: 425, size: 62 },
  tornpage: { src: '/landing/object-tornpage.webp', w: 728, h: 763, size: 52 },
} as const;

export function TrailDivider({ object, flip = false }: { object: keyof typeof OBJECTS; flip?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.5, rootMargin: '-8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const o = OBJECTS[object];
  return (
    <div className={`trail${inView ? ' in' : ''}${flip ? ' trail-flip' : ''}`} ref={ref} aria-hidden="true">
      <svg className="trail-path" viewBox="0 0 80 132" width="80" height="132" fill="none" preserveAspectRatio="xMidYMid meet">
        <path d="M40 4 C 70 28, 12 56, 40 84 C 54 98, 40 116, 40 128" />
      </svg>
      <Image className="trail-object" src={o.src} alt="" width={o.w} height={o.h} style={{ width: o.size, height: 'auto' }} />
    </div>
  );
}
