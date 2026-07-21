import Image from 'next/image';
import { BRAND } from '@/lib/brand';
import { Inscription } from './Inscription';

/**
 * Parent Reaction — an editorial scrapbook, not a testimonial carousel. Honest:
 * we don't have real reactions yet, so this shows a few of the sample heroes
 * we've illustrated (clearly illustrations, no fabricated quotes/ratings) with
 * handwritten story-mood captions, plus a genuine founder note.
 */
const HEROES = [
  { src: '/landing/8A.webp', w: 1024, h: 1536, pos: 'center 22%', rot: '-3.5deg', cap: 'a lantern for a friend' },
  { src: '/landing/jasmine-character.webp', w: 1600, h: 2400, pos: 'left 12%', rot: '2.5deg', cap: 'one curious little dreamer' },
  { src: '/landing/8B.webp', w: 1600, h: 2400, pos: 'center 18%', rot: '-1.5deg', cap: 'her first brave night' },
];

export function ParentReaction() {
  return (
    <section className="dband dband-soft">
      <div className="container">
        <div style={{ maxWidth: 640, margin: '0 auto 40px', textAlign: 'center' }}>
          <Inscription size="sm">from our sketchbook</Inscription>
          <h2 className="display d-h2" style={{ marginTop: 8 }}>A few of the heroes we’ve dreamed up</h2>
        </div>

        <div className="scrapbook">
          {HEROES.map((h) => (
            <figure key={h.src} className="scrap" style={{ transform: `rotate(${h.rot})` }}>
              <span className="scrap-tape" aria-hidden />
              <div className="scrap-photo">
                <Image
                  src={h.src}
                  alt={`A MoonBell hero illustration — ${h.cap}`}
                  width={h.w}
                  height={h.h}
                  sizes="(max-width: 860px) 70vw, 260px"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: h.pos }}
                />
              </div>
              <figcaption className="scrap-cap"><Inscription size="sm" tilt={false}>{h.cap}</Inscription></figcaption>
            </figure>
          ))}

          <figure className="scrap scrap-note" style={{ transform: 'rotate(-2deg)' }}>
            <span className="scrap-pin" aria-hidden />
            <blockquote>
              We make every story like it’s for our own kids — gentle, safe, and genuinely theirs.
            </blockquote>
            <figcaption><Inscription size="sm">— the {BRAND.name} team</Inscription></figcaption>
          </figure>
        </div>

        <p style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 34 }}>
          Genuine family reactions will live here as our first families share them — we don’t use stock quotes.
        </p>
      </div>
    </section>
  );
}
