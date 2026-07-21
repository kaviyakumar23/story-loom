import Image from 'next/image';
import Link from 'next/link';
import { Footer, Header } from '@/components/chrome';
import { HeroCover } from '@/components/landing/HeroCover';
import { Inscription } from '@/components/landing/Inscription';
import { ParentReaction } from '@/components/landing/ParentReaction';
import { Personalisation } from '@/components/landing/Personalisation';
import { SafetyBookplate } from '@/components/landing/SafetyBookplate';
import { SampleBook } from '@/components/landing/SampleBook';
import { ScrollRibbon } from '@/components/landing/ScrollRibbon';
import { TrailDivider } from '@/components/landing/TrailDivider';
import { Icon } from '@/components/ui';
import { BRAND } from '@/lib/brand';

const TRUST = [
  { name: 'sparkles' as const, t: 'Free preview', c: 'var(--gold)' },
  { name: 'shield' as const, t: 'No photos', c: 'var(--brand)' },
  { name: 'lock' as const, t: 'Never used to train AI', c: 'var(--sky)' },
  { name: 'check' as const, t: 'Delete anytime', c: 'var(--success)' },
];

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

      {/* TRUST STRIP */}
      <section style={{ borderTop: '2px solid var(--hairline)', borderBottom: '2px solid var(--hairline)', background: 'var(--surface)' }}>
        <div className="container trust-strip">
          {TRUST.map((b) => (
            <span key={b.t} className="trust-strip-item">
              <Icon name={b.name} size={18} stroke={b.c} />
              <span style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--ink)' }}>{b.t}</span>
            </span>
          ))}
        </div>
      </section>

      <TrailDivider object="bell" />

      {/* SAMPLE BOOK PROOF */}
      <section className="dband" id="sample">
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: 620, margin: '0 auto 36px' }}>
            <span className="eyebrow"><Icon name="book" size={15} stroke="var(--brand)" /> See a real one</span>
            <h2 className="display d-h2" style={{ marginTop: 14 }}>A whole book, not a mock-up</h2>
            <p className="d-lead" style={{ color: 'var(--ink-soft)', marginTop: 14 }}>
              Turn the pages of a finished story. The same hero, consistent art, gentle words —
              {' '}{BRAND.product.pages}, delivered as a {BRAND.product.format.toLowerCase()}.
            </p>
          </div>
          <SampleBook />
          <div style={{ textAlign: 'center', marginTop: 30 }}>
            <Link href="/create" className="btn btn-primary" style={{ padding: '16px 28px', fontSize: 16.5 }}>
              {BRAND.hero.primaryCta}
            </Link>
          </div>
        </div>
      </section>

      <TrailDivider object="paperboat" flip />

      <Personalisation />

      <ParentReaction />

      <TrailDivider object="leaf" />

      <SafetyBookplate />

      <TrailDivider object="pencil" flip />

      {/* PURCHASE — a product page, not a pricing card */}
      <section className="dband dband-soft" id="pricing">
        <div className="container grid-2" style={{ alignItems: 'center', gap: 56 }}>
          <div style={{ position: 'relative' }}>
            <div className="product-shot">
              <Image
                src="/landing/gift-keepsake-close-up.webp"
                alt="A personalised MoonBell storybook in its navy gift box, with a ribbon and a handwritten note"
                width={1122}
                height={1402}
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
              A complete illustrated story starring your child — delivered as a keepsake you’ll
              read again and again. You only pay after your free preview.
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

      <TrailDivider object="tornpage" />

      {/* FAQ */}
      <section className="dband" id="faq">
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

      {/* FINAL CTA */}
      <section className="dband dband-soft">
        <div className="container-narrow" style={{ textAlign: 'center' }}>
          <h2 className="display d-h2">Their adventure is a minute away</h2>
          <p className="d-lead" style={{ color: 'var(--ink-soft)', margin: '16px auto 30px', maxWidth: 480 }}>
            See the preview free — fall in love before you spend a thing.
          </p>
          <Link href="/create" className="btn btn-primary" style={{ padding: '18px 30px', fontSize: 17.5 }}>
            {BRAND.hero.primaryCta}
          </Link>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 22, marginTop: 28, flexWrap: 'wrap' }}>
            {TRUST.map((b) => (
              <span key={b.t} className="trust"><Icon name={b.name} size={16} stroke={b.c} /> {b.t}</span>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
