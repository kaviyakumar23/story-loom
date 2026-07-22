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

const FAQS = [
  { q: 'How much does it cost?', a: `${BRAND.product.priceLabel} for the complete personalised book — and you only pay after you’ve seen your free preview and love it. UPI and cards supported, in rupees.` },
  { q: 'Do you need a photo of my child?', a: 'No — never. You describe how they look (skin tone, hair, glasses) and we illustrate an original character. Safer, and fully under your control.' },
  { q: 'Can I really preview before paying?', a: 'Yes. You’ll see your child’s cover and opening pages free, before you decide. If it isn’t quite right, tweak the details and we’ll regenerate it.' },
  { q: 'Is my child’s data safe?', a: 'Yes. We collect the minimum — a nickname, not a legal name; an age band, not a birth date. Their real name never leaves our system to an AI vendor or is used to train AI, and you can delete everything anytime.' },
  { q: 'How is the book delivered?', a: `A beautifully illustrated PDF, ${BRAND.product.delivery.toLowerCase()}, in your account. Read it on any phone or tablet, or print it at home.` },
  { q: 'Is this a good gift?', a: 'It’s one of the most personal gifts you can give — wonderful for birthdays, Diwali, Rakhi, or welcoming a new sibling. The child sees themselves as the hero.' },
];

export default function Landing() {
  return (
    <div className="web">
      <ScrollRibbon />
      <Header />

      <HeroCover />
      <BeforeYouPay />
      <Personalisation />

      {/* SEE A REAL ONE */}
      <section className="dband dband-soft" id="sample">
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: 620, margin: '0 auto 36px' }}>
            <span className="eyebrow"><Icon name="book" size={15} stroke="var(--brand)" /> Read a sample story</span>
            <h2 className="display d-h2" style={{ marginTop: 14 }}>A whole book, not a mock-up</h2>
            <p className="d-lead" style={{ color: 'var(--ink-soft)', marginTop: 14 }}>
              Turn the pages of a real MoonBell story, cover to closing — the same hero, the same
              outfit, the same art on every page. Prefer to read it your way? Download it as the very
              same {BRAND.product.format} you’d receive.
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
              A complete illustrated story starring your child — delivered as a downloadable PDF you
              can reread on any phone or tablet, or print at home. You only pay after your free preview.
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
              Free preview first · pay by UPI &amp; cards · no photos ever
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

      <Footer />
      <StickyCta />
    </div>
  );
}
