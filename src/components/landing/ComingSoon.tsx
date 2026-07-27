import Image from 'next/image';
import Link from 'next/link';
import { Inscription } from './Inscription';
import { NewsletterForm } from './NewsletterForm';

/**
 * "More than books" product range — the printed storybook is live today; audio
 * stories and gift options are tagged "soon" with a notify-me. Kept honest: only
 * things actually on the roadmap (no video), and the live tile is the real
 * product (the personalised printed hardcover).
 */
const ITEMS: { t: string; d: string; img: string; live?: boolean }[] = [
  { t: 'Printed storybooks', d: 'Personalised hardcovers, shipped to your door.', img: '/landing/bookimage.webp', live: true },
  { t: 'Audio stories', d: 'Their story, narrated to listen to together.', img: '/landing/childwithheadphone.webp' },
  { t: 'Gifts & keepsakes', d: 'Thoughtful ways to give a MoonBell story.', img: '/landing/giftbox.webp' },
];

export function ComingSoon() {
  return (
    <section className="dband dband-soft" id="range">
      <div className="container">
        <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 40px' }}>
          <Inscription size="sm">more on the way</Inscription>
          <h2 className="display d-h2" style={{ marginTop: 6 }}>More than books</h2>
          <p style={{ color: 'var(--ink-soft)', marginTop: 12, fontSize: 16 }}>
            The personalised printed storybook is here today — the rest of the MoonBell world is on its way.
          </p>
        </div>

        <div className="range-grid">
          {ITEMS.map((i) => {
            const inner = (
              <>
                <div className="range-img">
                  <Image src={i.img} alt={i.t} width={512} height={512} sizes="(max-width: 560px) 90vw, (max-width: 900px) 45vw, 300px" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
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
            Want a nudge when audio and gifts arrive?
          </p>
          <NewsletterForm source="coming-soon" />
        </div>
      </div>
    </section>
  );
}
