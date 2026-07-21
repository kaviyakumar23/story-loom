import Image from 'next/image';
import Link from 'next/link';
import { Footer, Header } from '@/components/chrome';
import { HeroCover } from '@/components/landing/HeroCover';
import { Inscription } from '@/components/landing/Inscription';
import { SampleBook } from '@/components/landing/SampleBook';
import { Icon } from '@/components/ui';
import { BRAND } from '@/lib/brand';

const TRUST = [
  { name: 'sparkles' as const, t: 'Free preview', c: 'var(--gold)' },
  { name: 'shield' as const, t: 'No photos', c: 'var(--brand)' },
  { name: 'lock' as const, t: 'Never used to train AI', c: 'var(--sky)' },
  { name: 'check' as const, t: 'Delete anytime', c: 'var(--success)' },
];

const STEPS = [
  { n: '1', t: 'Tell us about them', d: 'Their nickname, age, how they look, and what they love — about a minute.', c: 'var(--brand)' },
  { n: '2', t: 'Pick a gentle lesson', d: 'Bedtime courage, kindness, starting school — the story is shaped around it.', c: 'var(--coral)' },
  { n: '3', t: 'See your free preview', d: 'Meet your child as the hero — cover and opening pages, free, before you pay.', c: 'var(--gold)' },
];

const BENEFITS = [
  { icon: 'star' as const, c: 'var(--gold)', t: 'Truly theirs', d: 'Their nickname, their looks, the things they love — woven through every page, with the same hero on every spread.' },
  { icon: 'heart' as const, c: 'var(--coral)', t: 'A gentle life-lesson', d: 'Each story carries a goal you choose — bravery at bedtime, kindness, a first day at school — told softly, never preachy.' },
  { icon: 'shield' as const, c: 'var(--brand)', t: 'Safe by design', d: 'No photos, ever. A nickname instead of a real name, an age band instead of a birthday. Delete everything anytime.' },
];

const PRIVACY = [
  { icon: 'shield' as const, t: 'No photos, ever', d: 'You describe how your child looks — we never ask for or store a single photo.' },
  { icon: 'lock' as const, t: 'Minimal details', d: 'A nickname, not a legal name. An age band, not a birth date. Their real name is never sent to an AI vendor or used to train AI.' },
  { icon: 'check' as const, t: 'Delete anytime', d: 'Erase everything in one tap. You stay in control of your family’s data, always.' },
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

      {/* HOW IT WORKS */}
      <section className="dband dband-soft" id="how">
        <div className="container">
          <h2 className="display d-h2" style={{ textAlign: 'center', marginBottom: 44 }}>Three steps to their book</h2>
          <div className="grid-3">
            {STEPS.map((s) => (
              <div key={s.n} className="card" style={{ padding: '34px 30px' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: s.c, color: '#fff', display: 'grid', placeItems: 'center', fontFamily: 'var(--display)', fontWeight: 800, fontSize: 24, marginBottom: 18 }}>{s.n}</div>
                <h3 className="display" style={{ fontSize: 23, marginBottom: 9 }}>{s.t}</h3>
                <p style={{ fontSize: 15.5, color: 'var(--ink-soft)', lineHeight: 1.6 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="dband" id="why">
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto 44px' }}>
            <span className="eyebrow"><Icon name="star" size={14} stroke="var(--gold)" /> Why parents love it</span>
            <h2 className="display d-h2" style={{ marginTop: 14 }}>Personal, gentle, and safe</h2>
          </div>
          <div className="grid-3">
            {BENEFITS.map((f) => (
              <div key={f.t} className="card lift" style={{ padding: '32px 28px' }}>
                <div style={{ width: 50, height: 50, borderRadius: 14, background: f.c, display: 'grid', placeItems: 'center', marginBottom: 16 }}>
                  <Icon name={f.icon} size={25} stroke="#fff" />
                </div>
                <h3 className="display" style={{ fontSize: 22, marginBottom: 8 }}>{f.t}</h3>
                <p style={{ fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.6 }}>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HONEST REACTIONS / FOUNDER NOTE */}
      <section className="dband dband-soft">
        <div className="container-narrow" style={{ textAlign: 'center' }}>
          <h2 className="display d-h2">Made by parents, for bedtimes like yours</h2>
          <div className="card" style={{ padding: '30px 32px', marginTop: 26, textAlign: 'left' }}>
            <p style={{ fontFamily: 'var(--display)', fontStyle: 'italic', fontSize: 21, lineHeight: 1.5, color: 'var(--ink)' }}>
              “We started {BRAND.name} for our own kids. Every story is one we’d happily read at our
              own bedtime — gentle, safe, and genuinely theirs.”
            </p>
            <p style={{ marginTop: 14, fontWeight: 800, color: 'var(--brand)' }}>— The {BRAND.name} team</p>
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 18 }}>
            Genuine reactions from our first families will appear here as they share them — we don’t use stock quotes.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 22, flexWrap: 'wrap' }}>
            <span className="pill"><Icon name="shield" size={15} stroke="var(--brand)" /> Every book safety-checked</span>
            <span className="pill"><Icon name="heart" size={15} stroke="var(--coral)" /> Made in India · ₹ &amp; UPI</span>
          </div>
        </div>
      </section>

      {/* PRIVACY */}
      <section className="dband" id="privacy">
        <div className="container grid-2">
          <div>
            <span className="eyebrow"><Icon name="shield" size={15} stroke="var(--brand)" /> Built around your child’s privacy</span>
            <h2 className="display d-h2" style={{ marginTop: 14 }}>Safe by design, not as an afterthought</h2>
            <p className="d-lead" style={{ color: 'var(--ink-soft)', margin: '16px 0 28px', maxWidth: 460 }}>
              We built {BRAND.name} to be DPDP-friendly and parent-controlled. We collect the least we
              can, and you’re always in charge of it.
            </p>
            <Link href="/create" className="btn btn-primary" style={{ padding: '16px 26px', fontSize: 16.5 }}>
              {BRAND.hero.primaryCta}
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {PRIVACY.map((p) => (
              <div key={p.t} className="card" style={{ padding: '20px 22px', background: 'var(--brand-tint)', border: '1px solid var(--hairline)', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <Icon name={p.icon} size={26} stroke="var(--brand)" style={{ flexShrink: 0 }} />
                <div>
                  <h3 style={{ fontSize: 16.5, fontWeight: 800, color: 'var(--brand)' }}>{p.t}</h3>
                  <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--ink)', marginTop: 5 }}>{p.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

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
