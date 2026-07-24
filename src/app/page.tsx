import Image from 'next/image';
import Link from 'next/link';
import { Footer, Header } from '@/components/chrome';
import { BackedByTrust } from '@/components/landing/BackedByTrust';
import { BeforeYouPay } from '@/components/landing/BeforeYouPay';
import { ComingSoon } from '@/components/landing/ComingSoon';
import { FinalCta } from '@/components/landing/FinalCta';
import { HeroCover } from '@/components/landing/HeroCover';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Inscription } from '@/components/landing/Inscription';
import { Occasions } from '@/components/landing/Occasions';
import { ParentReaction } from '@/components/landing/ParentReaction';
import { Personalisation } from '@/components/landing/Personalisation';
import { SampleBook } from '@/components/landing/SampleBook';
import { ScrollRibbon } from '@/components/landing/ScrollRibbon';
import { StickyCta } from '@/components/landing/StickyCta';
import { Icon } from '@/components/ui';
import { BRAND } from '@/lib/brand';
import { PHOTO_LIKENESS_ENABLED } from '@/lib/photo-likeness';

const PAYMENTS_ENABLED = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === 'true';

const FAQS = [
  { q: 'How much does it cost?', a: `${BRAND.product.priceLabel} for a personalised printed hardcover, shipped to you — and it includes the digital PDF. You only pay after you’ve seen your free preview and love it.` },
  {
    q: 'Do you need a photo of my child?',
    a: PHOTO_LIKENESS_ENABLED
      ? 'No — a photo is optional. You can just describe how they look (skin tone, hair, glasses), or add a photo, which we use once to shape the illustrated character and then delete — never printed, never shared. Fully under your control.'
      : 'No — never. You describe how they look (skin tone, hair, glasses) and we illustrate an original character. Safer, and fully under your control.',
  },
  { q: 'Can I really preview before paying?', a: 'Yes. You’ll see your child’s cover and opening pages free, before you decide. If it isn’t quite right, tweak the details and we’ll regenerate it — one free tweak is included.' },
  { q: 'Is my child’s data safe?', a: 'Yes. We collect the minimum — a nickname, not a legal name; an age band, not a birth date. Their real name never leaves our system to an AI vendor or is used to train AI, and you can delete everything anytime.' },
  { q: 'How is the book delivered?', a: 'Two ways. The digital PDF is ready within the hour — usually much sooner — to read on any phone or tablet. Your printed hardcover is then printed and dispatched within about 7 days; delivery takes a couple of days more depending on your city (across India).' },
  { q: 'Is shipping included in the price?', a: `Yes. ${BRAND.product.priceLabel} covers the personalised hardcover, printing, and shipping anywhere in India — no surprise charges at checkout.` },
  { q: 'What ages is it for?', a: 'Ages 3–10. You pick a reading level and we match the story length and language to it, so the words suit your child.' },
  { q: 'What language are the stories in?', a: 'English for now. We’re an India-first brand and more languages are on the way — join the list below and we’ll tell you when they land.' },
  { q: 'What if the book arrives damaged?', a: <>If your hardcover arrives damaged or the print has a fault, we’ll reprint and reship it. See our <Link href="/legal/refunds" style={{ color: 'var(--brand)', fontWeight: 700 }}>refunds &amp; replacements</Link> policy for the details.</>, plain: 'If your hardcover arrives damaged or the print has a fault, we’ll reprint and reship it. See our refunds and replacements policy for the details.' },
  { q: 'Is this a good gift?', a: 'It’s one of the most personal gifts you can give — wonderful for birthdays, Diwali, Rakhi, or welcoming a new sibling. The child sees themselves as the hero.' },
];

// JSON-LD — truthful only. No aggregateRating (we have no reviews yet); while
// invite-gated the offer is LimitedAvailability. Each FAQ carries a `plain`
// string when its display answer is JSX, so the structured data stays text.
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Product',
      name: BRAND.product.name,
      description: BRAND.hero.sub,
      brand: { '@type': 'Brand', name: BRAND.name },
      image: 'https://www.moonbell.in/landing/og-card.jpg',
      offers: {
        '@type': 'Offer',
        price: String(BRAND.product.price),
        priceCurrency: BRAND.product.currency,
        availability: PAYMENTS_ENABLED ? 'https://schema.org/InStock' : 'https://schema.org/LimitedAvailability',
        url: 'https://www.moonbell.in/create',
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: FAQS.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: 'plain' in f ? f.plain : (f.a as string) },
      })),
    },
  ],
};

export default function Landing() {
  return (
    <div className="web">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <ScrollRibbon />
      <Header />

      <main id="main-content">
        <HeroCover />
        <BeforeYouPay />
        <Personalisation />

        {/* SEE A REAL ONE */}
        <section className="dband dband-soft" id="sample">
          <div className="container">
            <div style={{ textAlign: 'center', maxWidth: 620, margin: '0 auto 36px' }}>
              <span className="eyebrow"><Icon name="book" size={15} stroke="var(--brand)" /> Read a sample story</span>
              <h2 className="display d-h2" style={{ marginTop: 14 }}>The opening of a real story</h2>
              <p className="d-lead" style={{ color: 'var(--ink-soft)', marginTop: 14 }}>
                Turn the pages of a real MoonBell story — the same hero, the same outfit, the same art
                on every page. Prefer to read it your way? Download the sample as a PDF.
              </p>
            </div>
            <SampleBook />
          </div>
        </section>

        <HowItWorks />

        {/* PURCHASE — product page */}
        <section className="dband" id="pricing">
          <div className="container grid-2" style={{ alignItems: 'center', gap: 56 }}>
            <div style={{ position: 'relative' }}>
              <div className="product-shot">
                <Image
                  src="/landing/bedtime-spread.webp"
                  alt="Two illustrated pages from a personalised MoonBell storybook, shown as the digital PDF"
                  width={1200}
                  height={800}
                  sizes="(max-width: 860px) 90vw, 520px"
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              </div>
              <span className="price-tag">{BRAND.product.priceLabel}</span>
            </div>
            <div>
              <Inscription size="sm">one book · one simple price</Inscription>
              <h2 className="display d-h2" style={{ marginTop: 8 }}>{BRAND.product.name}</h2>
              <p style={{ fontSize: 15.5, color: 'var(--ink-soft)', margin: '12px 0 20px', lineHeight: 1.6, maxWidth: 440 }}>
                A complete illustrated story starring your child — a printed hardcover shipped to your
                door, with the digital PDF ready within the hour. You only pay after your free preview.
              </p>
              <ul style={{ listStyle: 'none', margin: '0 0 22px', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {BRAND.product.includes.map((it) => (
                  <li key={it} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', fontSize: 15.5, color: 'var(--ink)', lineHeight: 1.5 }}>
                    <Icon name="check" size={18} stroke="var(--success)" style={{ flexShrink: 0, marginTop: 2 }} /> {it}
                  </li>
                ))}
              </ul>
              <div className="spec-row">
                <span><strong>Format</strong>{BRAND.product.format}</span>
                <span><strong>Delivery</strong>{BRAND.product.delivery}</span>
                <span><strong>Revision</strong>{BRAND.product.revision}</span>
              </div>
              <Link href="/create" className="btn btn-primary" style={{ marginTop: 24, padding: '17px 30px', fontSize: 17 }}>
                {BRAND.hero.primaryCta}
              </Link>
              <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 14 }}>
                {PAYMENTS_ENABLED
                  ? <>Free preview first · pay by UPI &amp; cards · {PHOTO_LIKENESS_ENABLED ? 'photo optional' : 'no photos ever'}</>
                  : <>Free preview now · ordering opens soon · {PHOTO_LIKENESS_ENABLED ? 'photo optional' : 'no photos ever'}</>}
              </p>
            </div>
          </div>
        </section>

        <BackedByTrust />
        <ParentReaction />
        <Occasions />

        {/* FAQ */}
        <section className="dband dband-soft" id="faq">
          <div className="container-narrow">
            <h2 className="display d-h2" style={{ textAlign: 'center', marginBottom: 24 }}>Good to know</h2>
            {FAQS.map((f) => (
              <details key={f.q} style={{ borderBottom: '1px solid var(--hairline)', padding: '18px 4px' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 18 }}>{f.q}</summary>
                <p style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--ink-soft)', paddingTop: 12, maxWidth: 640 }}>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <ComingSoon />
        <FinalCta />
      </main>

      <Footer />
      <StickyCta />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
