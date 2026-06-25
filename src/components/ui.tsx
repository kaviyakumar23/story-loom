import type { CSSProperties, ReactNode } from 'react';

/** Four-point sparkle — the brand motif. */
export function Sparkle({ size = 16, color = 'var(--accent)', style }: { size?: number; color?: string; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style} aria-hidden>
      <path d="M12 1c.5 5.4 4.6 9.5 10 10-5.4.5-9.5 4.6-10 10-.5-5.4-4.6-9.5-10-10C7.4 10.5 11.5 6.4 12 1Z" fill={color} />
    </svg>
  );
}

type IconName =
  | 'lock' | 'shield' | 'check' | 'star' | 'arrow' | 'arrowL' | 'chevron'
  | 'x' | 'heart' | 'sun' | 'mail' | 'book' | 'download' | 'sparkles';

export function Icon({ name, size = 20, stroke = 'currentColor', sw = 1.7, style }: { name: IconName; size?: number; stroke?: string; sw?: number; style?: CSSProperties }) {
  const p = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke, strokeWidth: sw,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, style, 'aria-hidden': true,
  };
  switch (name) {
    case 'lock': return <svg {...p}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;
    case 'shield': return <svg {...p}><path d="M12 3l7 3v5c0 4.6-3 8-7 10-4-2-7-5.4-7-10V6z" /><path d="M9 12l2 2 4-4" /></svg>;
    case 'check': return <svg {...p}><path d="M4 12l5 5L20 6" /></svg>;
    case 'star': return <svg {...p} fill={stroke} stroke="none"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7z" /></svg>;
    case 'arrow': return <svg {...p}><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>;
    case 'arrowL': return <svg {...p}><path d="M19 12H5" /><path d="M11 6l-6 6 6 6" /></svg>;
    case 'chevron': return <svg {...p}><path d="M6 9l6 6 6-6" /></svg>;
    case 'x': return <svg {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>;
    case 'heart': return <svg {...p}><path d="M12 20s-7-4.3-7-9.2A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7-2.8C19 10.7 12 20 12 20z" /></svg>;
    case 'sun': return <svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" /></svg>;
    case 'mail': return <svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M4 7l8 6 8-6" /></svg>;
    case 'book': return <svg {...p}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M19 3v18" /></svg>;
    case 'download': return <svg {...p}><path d="M12 3v12" /><path d="M7 11l5 5 5-5" /><path d="M5 21h14" /></svg>;
    case 'sparkles': return <svg {...p} fill={stroke} stroke="none"><path d="M12 1c.5 5.4 4.6 9.5 10 10-5.4.5-9.5 4.6-10 10-.5-5.4-4.6-9.5-10-10C7.4 10.5 11.5 6.4 12 1Z" /></svg>;
  }
}

/** Hand-drawn underline wrapper. */
export function Uline({ children }: { children: ReactNode }) {
  return (
    <span className="uline">
      {children}
      <svg viewBox="0 0 200 12" preserveAspectRatio="none">
        <path d="M3 8 C 45 3, 90 3, 130 6 S 185 9, 197 5" />
      </svg>
    </span>
  );
}

export function Stars({ size = 16 }: { size?: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }} aria-label="5 out of 5 stars">
      {[0, 1, 2, 3, 4].map((i) => <Icon key={i} name="star" size={size} stroke="var(--accent)" />)}
    </span>
  );
}
