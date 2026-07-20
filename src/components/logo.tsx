'use client';

import { useId } from 'react';
import { BRAND } from '@/lib/brand';

/**
 * MoonBell mark — an indigo crescent cradling a gold bell, with a small star.
 * The crescent is carved with a masked circle (unique id per instance) so it
 * renders cleanly on any background. `moon` recolours the crescent for use on
 * dark surfaces (e.g. the footer).
 */
export function LogoMark({ size = 32, moon = 'var(--brand)' }: { size?: number; moon?: string }) {
  const uid = useId().replace(/:/g, '');
  const maskId = `moonbell-mask-${uid}`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" role="img" aria-label={`${BRAND.name} logo`}>
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
        <rect width="48" height="48" fill="#000" />
        <circle cx="22" cy="24" r="17" fill="#fff" />
        <circle cx="32" cy="22" r="15" fill="#000" />
      </mask>
      <circle cx="22" cy="24" r="17" fill={moon} mask={`url(#${maskId})`} />
      {/* bell */}
      <g fill="var(--gold)">
        <path d="M29.5 31.8C29.5 25.5 32.2 21 35.5 21C38.8 21 41.5 25.5 41.5 31.8L43 33.5H28L29.5 31.8Z" />
        <circle cx="35.5" cy="19.6" r="1.7" />
        <circle cx="35.5" cy="35.4" r="2" />
      </g>
      {/* star */}
      <path
        d="M16.5 8.5C16.7 10.7 18.1 12.1 20.3 12.3C18.1 12.5 16.7 13.9 16.5 16.1C16.3 13.9 14.9 12.5 12.7 12.3C14.9 12.1 16.3 10.7 16.5 8.5Z"
        fill="var(--gold)"
      />
    </svg>
  );
}

/** Mark + wordmark. `tone="light"` for dark backgrounds; `tagline` adds the strap-line. */
export function Logo({
  size = 30,
  tone = 'default',
  tagline = false,
}: {
  size?: number;
  tone?: 'default' | 'light';
  tagline?: boolean;
}) {
  const light = tone === 'light';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
      <LogoMark size={size} moon={light ? '#EFEEFF' : 'var(--brand)'} />
      <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1 }}>
        <span
          className="display"
          style={{ fontSize: size * 0.84, color: light ? '#fff' : 'var(--brand)', fontWeight: 800, letterSpacing: '-.01em' }}
        >
          {BRAND.name}
        </span>
        {tagline && (
          <span style={{ fontSize: Math.max(10, size * 0.3), color: light ? '#C9C7EA' : 'var(--ink-soft)', fontFamily: 'var(--sans)', fontWeight: 600, marginTop: 3 }}>
            {BRAND.tagline}
          </span>
        )}
      </span>
    </span>
  );
}
