import type { ReactNode } from 'react';

/**
 * Personal Inscription — a handwritten decorative annotation ("Made especially
 * for Aarav", "Chapter one begins here"). Signature device. Handwriting is
 * decorative only; the text stays real (readable/selectable) but is never used
 * for body copy, forms, or accessibility-critical content.
 */
export function Inscription({
  children,
  size = 'md',
  tilt = true,
  underline = false,
  className = '',
  style,
}: {
  children: ReactNode;
  size?: 'sm' | 'md';
  tilt?: boolean;
  underline?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={`inscription${size === 'sm' ? ' inscription-sm' : ''}${tilt ? ' inscription-tilt' : ''} ${className}`}
      style={style}
    >
      {children}
      {underline && (
        <span className="inscription-line" aria-hidden>
          <svg viewBox="0 0 200 10" preserveAspectRatio="none">
            <path d="M2 6 C 45 2, 90 9, 135 4 S 190 3, 198 6" />
          </svg>
        </span>
      )}
    </span>
  );
}
