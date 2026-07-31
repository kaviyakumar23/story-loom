import { existsSync } from 'node:fs';
import path from 'node:path';
import Image from 'next/image';

/**
 * A photograph of the real printed book — or an honest stand-in until one
 * exists.
 *
 * The landing page needs to show the physical object, because that is what is
 * being sold and illustrations alone prove nothing about paper, binding or
 * size. Those photographs cannot be taken until proofs come back from a
 * printer, and the page has to ship before then.
 *
 * So each slot checks whether its file has appeared and renders it if so. When
 * the founder drops `public/landing/product/cover.jpg` into place, the page
 * starts showing it — no code change, no deploy coordination. Until then the
 * slot says plainly that it is a mock-up rather than dressing an illustration up
 * as a photograph of something nobody has held.
 */
export type ProductShot = 'cover' | 'open' | 'spine' | 'stack' | 'packaging';

const CAPTIONS: Record<ProductShot, string> = {
  cover: 'The printed cover',
  open: 'A spread, open flat',
  spine: 'Casebound spine',
  stack: 'The finished book',
  packaging: 'How it arrives',
};

/** Illustration used while the real photo does not exist yet. */
const PLACEHOLDER_ART: Record<ProductShot, string> = {
  cover: '/landing/bookimage.webp',
  open: '/landing/bedtime-spread.webp',
  spine: '/landing/bookimage.webp',
  stack: '/landing/jasmine-spread.webp',
  packaging: '/landing/giftbox.webp',
};

export function ProductPhoto({
  shot,
  alt,
  sizes = '(max-width: 860px) 90vw, 520px',
  priority = false,
}: {
  shot: ProductShot;
  alt: string;
  sizes?: string;
  priority?: boolean;
}) {
  const rel = `/landing/product/${shot}.jpg`;
  const hasPhoto = existsSync(path.join(process.cwd(), 'public', rel));

  return (
    <figure style={{ margin: 0, position: 'relative' }}>
      <Image
        src={hasPhoto ? rel : PLACEHOLDER_ART[shot]}
        alt={hasPhoto ? alt : `${alt} (illustration — photography of the printed book is coming)`}
        width={1200}
        height={900}
        sizes={sizes}
        priority={priority}
        style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 'var(--r-lg)' }}
      />
      {!hasPhoto && (
        // Saying so is the point. A rendering presented as a photograph of a
        // product nobody has held yet is exactly the kind of claim this beta is
        // meant to avoid making.
        <figcaption
          style={{
            position: 'absolute',
            left: 12,
            bottom: 12,
            background: 'var(--surface)',
            border: '1px solid var(--hairline)',
            borderRadius: 999,
            padding: '4px 11px',
            fontSize: 11.5,
            fontWeight: 600,
            color: 'var(--ink-soft)',
          }}
        >
          Illustration · {CAPTIONS[shot]}
        </figcaption>
      )}
    </figure>
  );
}
