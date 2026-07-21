import type { CSSProperties, ReactNode } from 'react';

/**
 * Story Window — an arched "page-opening" frame with an inked double rule, a
 * hanging ribbon bookmark, and a small gold star. Signature device for hero
 * imagery, book previews, and emotional moments. Deliberately NOT a rounded
 * rectangle. Pure CSS/SVG — no external art required.
 */
export function StoryWindow({
  children,
  ribbon = true,
  star = true,
  className = '',
  frameStyle,
}: {
  children: ReactNode;
  ribbon?: boolean;
  star?: boolean;
  className?: string;
  frameStyle?: CSSProperties;
}) {
  return (
    <div className={`story-window ${className}`}>
      {ribbon && <span className="ribbon" aria-hidden />}
      <div className="story-window-frame" style={frameStyle}>
        {children}
      </div>
      {star && (
        <span className="story-window-star" aria-hidden>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 1c.5 5.4 4.6 9.5 10 10-5.4.5-9.5 4.6-10 10-.5-5.4-4.6-9.5-10-10C7.4 10.5 11.5 6.4 12 1Z"
              fill="var(--gold)"
            />
          </svg>
        </span>
      )}
    </div>
  );
}
