import Link from 'next/link';
import { Footer, Header } from '@/components/chrome';
import { BackedByTrust } from '@/components/landing/BackedByTrust';
import { FinalCta } from '@/components/landing/FinalCta';
import { HeroCover } from '@/components/landing/HeroCover';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Personalisation } from '@/components/landing/Personalisation';
import { PriceBlock } from '@/components/landing/PriceBlock';
import { ProductBlock } from '@/components/landing/ProductBlock';
import { SampleBook } from '@/components/landing/SampleBook';
import { ScrollRibbon } from '@/components/landing/ScrollRibbon';
import { StickyCta } from '@/components/landing/StickyCta';
import { TrustRow } from '@/components/landing/TrustRow';
import { Icon } from '@/components/ui';
import { BRAND } from '@/lib/brand';
import { PHOTO_LIKENESS_ENABLED } from '@/lib/photo-likeness';
import { SERVICEABLE_SUMMARY } from '@/server/config/beta-geo';
import { visitorPrice } from '@/server/lib/visitor-price';

// The price is per visitor, so the page cannot be statically cached.
export const dynamic = 'force-dynamic';

/**
 * The eight questions someone actually has before buying. Ordered by when the
 * doubt arrives — what do I get, is it really free to look, what about my
 * child's data, when does it come, what if it's wrong, what if it's damaged,
 * can I change my mind, can I even order.
 *
 * Every answer is checkable against the system. Nothing here describes a
 * capability we intend to have.
 */
function faqs(price: string) {
  return [
    {
      q: 'What do I actually get?',
      a: `One personalised hardcover: 8×8 inches, casebound, 20 pages of which 12 are illustrated, with your child as the hero and a dedication page in your words. ${price} including shipping and tax. The book is the whole product — there's no separate digital copy during the beta.`,
    },
    {
      q: 'Can I really see it before paying?',
      a: 'Yes. You’ll see the cover and the first three illustrated pages of your child’s own story, free, before you decide anything. The rest of the book is written but stays with us until you order.',
    },
    {
      q: PHOTO_LIKENESS_ENABLED ? 'Do you need a photo of my child?' : 'Do you use photos of my child?',
      a: PHOTO_LIKENESS_ENABLED
        ? 'A photo is optional. If you add one it’s used once to shape the illustrated character and then deleted — never printed, never shared.'
        : 'No. We don’t collect photos at all — uploads are refused. You describe how they look (skin tone, hair, glasses) and we illustrate an original character.',
    },
    {
      q: 'What do you keep about my child?',
      a: 'A nickname rather than a legal name, an age band rather than a birth date, and the appearance and interests you choose. Their name is never sent to an AI vendor, nothing is used to train AI, and you can delete everything at any time.',
    },
    {
      q: 'How long does it take to arrive?',
      a: `Your preview takes a few minutes. Once you order, we check the book by hand, print it, and dispatch within 7 working days — ${BRAND.product.deliveryWindow.toLowerCase()}.`,
    },
    {
      q: 'What if something in the story isn’t right?',
      a: 'Tell us and we’ll fix it. Every book gets one change before printing — you write what you’d like different, we read it ourselves, and rebuild the preview. Nothing goes to the printer without a person looking at it.',
    },
    {
      q: 'What if it arrives damaged or wrong?',
      a: (
        <>
          We reprint and reship it, at no cost to you — that covers damage in the post, printing
          faults, missing pages, and getting your child’s details wrong. You can also cancel for a
          full refund any time before we send it to print. See our{' '}
          <Link href="/legal/refunds" style={{ color: 'var(--brand)', fontWeight: 700 }}>refunds &amp; replacements</Link> policy.
        </>
      ),
      plain:
        'We reprint and reship it, at no cost to you — that covers damage in the post, printing faults, missing pages, and getting your child’s details wrong. You can also cancel for a full refund any time before we send it to print.',
    },
    {
      q: 'Can I order one?',
      a: `We’re a small beta: invite-only, and delivering to ${SERVICEABLE_SUMMARY} while we get printing and delivery right. If that’s not you yet, leave your email and we’ll come back to you first.`,
    },
  ];
}

/**
 * JSON-LD, truthful only. No aggregateRating — we have no reviews — and no
 * `offers` block: two prices are under test, and publishing either one as THE
 * price would be wrong for half of the people who see it.
 */
function jsonLd(faqList: ReturnType<typeof faqs>) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        name: BRAND.product.name,
        description: BRAND.hero.sub,
        brand: { '@type': 'Brand', name: BRAND.name },
        image: 'https://www.moonbell.in/landing/og-card.jpg',
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqList.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: 'plain' in f ? f.plain : (f.a as string) },
        })),
      },
    ],
  };
}

export default async function Landing() {
  const price = (await visitorPrice()).display;
  const faqList = faqs(price);

  return (
    <div className="web">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <ScrollRibbon />
      <Header />

      <main id="main-content">
        <HeroCover price={price} />
        <TrustRow />

        {/* PROOF THE STORY IS REAL — readable prose, in sequence. */}
        <section className="dband dband-soft" id="sample">
          <div className="container">
            <div style={{ textAlign: 'center', maxWidth: 620, margin: '0 auto 36px' }}>
              <span className="eyebrow"><Icon name="book" size={15} stroke="var(--brand)" /> Read a sample story</span>
              <h2 className="display d-h2" style={{ marginTop: 14 }}>The opening of a real story</h2>
              <p className="d-lead" style={{ color: 'var(--ink-soft)', marginTop: 14 }}>
                Turn the pages of a real MoonBell story — the same hero, the same outfit, the same art
                on every page.
              </p>
            </div>
            <SampleBook />
          </div>
        </section>

        {/* PROOF THE PERSONALISATION IS REAL — the same story, two children. */}
        <Personalisation />

        <ProductBlock price={price} />
        <HowItWorks />
        <PriceBlock price={price} />
        <BackedByTrust />

        {/* FAQ */}
        <section className="dband dband-soft" id="faq">
          <div className="container-narrow">
            <h2 className="display d-h2" style={{ textAlign: 'center', marginBottom: 24 }}>Good to know</h2>
            {faqList.map((f) => (
              <details key={f.q} style={{ borderBottom: '1px solid var(--hairline)', padding: '18px 4px' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 18 }}>{f.q}</summary>
                <p style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--ink-soft)', paddingTop: 12, maxWidth: 640 }}>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <FinalCta price={price} />
      </main>

      <Footer />
      <StickyCta price={price} />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(faqList)) }} />
    </div>
  );
}
