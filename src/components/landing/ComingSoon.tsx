import Image from 'next/image';
import Link from 'next/link';
import { BRAND } from '@/lib/brand';
import { Inscription } from './Inscription';
import { NewsletterForm } from './NewsletterForm';

/**
 * "More than books" product range — Storybooks are live today; audio, video,
 * keepsakes and gifts are tagged "soon" with a notify-me, per the single-product
 * launch focus. Uses the founder's illustrated product tiles.
 */
const ITEMS = [
  { t: 'Storybooks', d: 'Beautifully illustrated personalised books.', img: '/landing/bookimage.webp', live: true },
  { t: 'Audio stories', d: 'Narrated stories your child will love.', img: '/landing/childwithheadphone.webp' },
  { t: 'Video stories', d: 'Their story brought to life with animation.', img: '/landing/tablet.webp' },
  { t: 'Keepsakes', d: 'Thoughtful keepsakes to hold on to.', img: '/landing/giftbox.webp' },
  { t: 'Gifts & more', d: 'Meaningful gifts for every special moment.', img: '/landing/mug.webp' },
];

export function ComingSoon() {
  return (
    <section className="dband dband-soft" id="range">
      <div className="container">
        <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 40px' }}>
          <Inscription size="sm">memories that last</Inscription>
          <h2 className="display d-h2" style={{ marginTop: 6 }}>More than books</h2>
          <p style={{ color: 'var(--ink-soft)', marginTop: 12, fontSize: 16 }}>
            Storybooks are here today — the rest of the MoonBell world is on its way.
          </p>
        </div>

        <div className="range-grid">
          {ITEMS.map((i) => {
            const inner = (
              <>
                <div className="range-img">
                  <Image src={i.img} alt={i.t} width={1024} height={1536} sizes="(max-width: 900px) 40vw, 190px" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
                <h3 className="range-t">
                  {i.t} {i.live ? <span className="range-live">now</span> : <span className="soon-tag">soon</span>}
                </h3>
                <p className="range-d">{i.d}</p>
              </>
            );
            return i.live ? (
              <Link key={i.t} href="/create" className="range-tile range-tile-live">{inner}</Link>
            ) : (
              <div key={i.t} className="range-tile">{inner}</div>
            );
          })}
        </div>

        <div className="soon-notify">
          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--ink-soft)', marginBottom: 12 }}>
            Want a nudge when the rest arrive?
          </p>
          <NewsletterForm />
        </div>
      </div>
    </section>
  );
}
