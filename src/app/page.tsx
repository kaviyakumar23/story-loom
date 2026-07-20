import Link from 'next/link';
import Image from 'next/image';
import { Footer, Header } from '@/components/chrome';
import { Icon, Sparkle, Uline } from '@/components/ui';

const TRUST = [
  { name: 'sparkles' as const, t: 'Free preview', c: 'var(--teal)' },
  { name: 'shield' as const, t: 'No photos', c: 'var(--brand)' },
  { name: 'lock' as const, t: 'Never used to train AI', c: 'var(--plum)' },
  { name: 'check' as const, t: 'Delete anytime', c: 'var(--success)' },
];

const STEPS = [
  { n: '1', t: 'Tell us about them', d: 'Their nickname, age band, how they look, and what they love — about a minute.', c: 'var(--teal)' },
  { n: '2', t: 'Pick a story goal', d: 'Sleeping alone, starting school, kindness — the story is shaped around it.', c: 'var(--sky)' },
  { n: '3', t: 'Watch the magic', d: 'See them appear as the hero — a free preview before you decide to buy.', c: 'var(--coral)' },
];

const FEATURES = [
  { icon: 'star' as const, c: 'var(--gold)', t: 'Made just for them', d: 'Your child is the hero — their nickname, their looks, the things they love, woven through every page.' },
  { icon: 'heart' as const, c: 'var(--coral)', t: 'A gentle life-lesson', d: 'Each story carries a goal you choose — bravery at bedtime, kindness, starting school — told softly, never preachy.' },
  { icon: 'shield' as const, c: 'var(--brand)', t: 'Privacy by design', d: 'No photos, ever. A nickname instead of a legal name, an age band instead of a birth date.' },
  { icon: 'download' as const, c: 'var(--teal)', t: 'Instant digital delivery', d: 'A beautifully illustrated PDF, ready in minutes — read it tonight on any phone, tablet, or print at home.' },
  { icon: 'sun' as const, c: 'var(--sky)', t: 'Audio narration option', d: 'Add a warm read-aloud track and a parent guide — perfect for car rides and sleepy bedtimes.' },
  { icon: 'sparkles' as const, c: 'var(--plum)', t: 'A gift they remember', d: 'A keepsake for birthdays, Diwali, Rakhi, or a new sibling — far more personal than another toy.' },
];

const SPREADS = [
  {
    t: 'Brave bedtime',
    d: 'A gentle story for sleeping alone',
    src: '/landing/sample-bedtime.webp',
    tilt: 'tilt-l',
  },
  {
    t: 'Starting school',
    d: 'A warm first-day confidence boost',
    src: '/landing/sample-school.webp',
    tilt: 'tilt-r',
  },
  {
    t: 'Kindness & patience',
    d: 'A values-led story that still feels playful',
    src: '/landing/sample-kindness.webp',
    tilt: 'tilt-l',
  },
];

const OCCASIONS = [
  { icon: 'sun' as const, c: 'var(--plum)', t: 'Bedtime', d: 'Turn “five more minutes” into a story about sleeping bravely on their own.' },
  { icon: 'book' as const, c: 'var(--teal)', t: 'Starting school', d: 'Soothe first-day nerves with a hero who walks in proud and makes a friend.' },
  { icon: 'heart' as const, c: 'var(--coral)', t: 'A new sibling', d: 'Help a big brother or sister feel special as the family grows.' },
  { icon: 'star' as const, c: 'var(--gold)', t: 'Birthdays', d: 'A keepsake that lasts long after the cake is gone.' },
  { icon: 'sparkles' as const, c: 'var(--brand)', t: 'Diwali & Rakhi', d: 'A thoughtful, personal gift for the festive season and far-away cousins.' },
];

const TIERS = [
  { name: 'Digital PDF', price: '₹299', tag: 'Most popular', highlight: true, items: ['Full personalized storybook', 'AI illustrations, your child as hero', 'Instant PDF download', 'Read on any device or print at home'] },
  { name: 'PDF + Audio & Guide', price: '₹499', tag: 'Coming soon', highlight: false, items: ['Everything in Digital PDF', 'Warm read-aloud narration', 'Parent discussion guide', 'Great for car rides & bedtime'] },
  { name: '7-Day Story Pack', price: '₹999', tag: 'Coming soon', highlight: false, items: ['A week of personalized stories', 'A different gentle goal each day', 'All as downloadable PDFs', 'Perfect as a gift'] },
];

const FAQS = [
  { q: 'How much does a book cost?', a: 'Plans start from ₹299 — and you only pay after you’ve seen your free preview and love it. Final pricing is shown at checkout, in rupees, with UPI and cards supported.' },
  { q: 'Do you need a photo of my child?', a: 'No. We never collect photos. You describe how they look (skin tone, hair, glasses) and we illustrate an original character — safer and fully under your control.' },
  { q: 'Is my child’s data safe?', a: 'Yes. We collect the minimum (a nickname, not a legal name; an age band, not a birth date), their real name never leaves our system to an AI vendor or is used to train AI, and you can delete everything anytime.' },
  { q: 'Can I really preview before paying?', a: 'Absolutely. You’ll see a free preview of the story before you decide. If it isn’t quite right, tweak the details and we’ll regenerate it.' },
  { q: 'How is the book delivered?', a: 'As a beautifully illustrated digital PDF, ready in minutes. You can read it on any phone or tablet, or print it at home. Audio narration is available on higher tiers.' },
  { q: 'Is this a good gift?', a: 'It’s one of the most personal gifts you can give — wonderful for birthdays, Diwali, Rakhi, or welcoming a new sibling. The child sees themselves as the hero.' },
];

export default function Landing() {
  return (
    <div className="web">
      <Header />

      {/* HERO */}
      <section className="dband" style={{ paddingTop: 84, paddingBottom: 56 }}>
        <div className="container grid-2">
          <div style={{ animation: 'fadeUp .6s ease both' }}>
          <span className="eyebrow"><Sparkle size={14} /> Private alpha for first families</span>
            <h1 className="display d-h1" style={{ marginTop: 18 }}>
              Make your child the <Uline>hero</Uline> of their own storybook
            </h1>
            <p className="d-lead" style={{ color: 'var(--ink-soft)', marginTop: 22, maxWidth: 480 }}>
              Describe them with simple attributes, choose a gentle life lesson, and get a
              personalized illustrated preview before the full book is made.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 32, flexWrap: 'wrap' }}>
              <Link href="/create" className="btn btn-primary" style={{ padding: '18px 28px', fontSize: 17 }}>
                <Sparkle size={18} color="var(--accent-ink)" /> Create your free preview
              </Link>
              <span style={{ fontSize: 14.5, color: 'var(--ink-soft)' }}>Free preview · no photos · India-first</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
              <Sparkle size={18} color="var(--gold)" />
              <span style={{ fontWeight: 600, fontSize: 15 }}>Built for known-family testing</span>
              <span className="trust" style={{ marginLeft: 4 }}>
                <Icon name="shield" size={15} stroke="var(--brand)" /> No photos · India-first · ₹ &amp; UPI
              </span>
            </div>
          </div>
          <div style={{ position: 'relative', animation: 'fadeUp .6s ease .14s both' }}>
            <div className="card tilt-l hero-media" style={{ aspectRatio: '1', border: '9px solid var(--surface)', overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
              <Image
                src="/landing/hero-reading.webp"
                alt="A parent and child reading a personalized picture book together at bedtime"
                fill
                priority
                sizes="(max-width: 860px) 90vw, 520px"
                style={{ objectFit: 'cover' }}
              />
              <div style={{ position: 'absolute', left: '50%', top: '46%', transform: 'translate(-50%,-50%)' }}>
                <span className="pill" style={{ background: 'var(--teal)', color: '#fff', border: 'none', boxShadow: 'var(--shadow)', fontSize: 14, padding: '8px 16px' }}>
                  <Sparkle size={15} color="#fff" /> their adventure
                </span>
              </div>
            </div>
            <div style={{ position: 'absolute', top: -22, right: 36, animation: 'twinkle 2.4s ease-in-out infinite' }}><Sparkle size={34} color="var(--gold)" /></div>
            <div style={{ position: 'absolute', bottom: -16, left: 18 }}>
              <span className="pill tilt-r" style={{ boxShadow: 'var(--shadow)', color: 'var(--brand)' }}>
                <Icon name="star" size={16} stroke="var(--gold)" /> A Brave Bedtime
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section style={{ borderTop: '2px solid var(--hairline)', borderBottom: '2px solid var(--hairline)', background: 'var(--surface)' }}>
        <div className="container trust-strip">
          {TRUST.map((b) => (
            <span key={b.t} className="trust-strip-item">
              <Icon name={b.name} size={18} stroke={b.c} />
              <span style={{ fontWeight: 700, fontFamily: 'var(--display)', fontSize: 14.5, color: 'var(--ink)' }}>{b.t}</span>
            </span>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="dband dband-soft" id="how">
        <div className="container">
          <h2 className="display d-h2" style={{ textAlign: 'center', marginBottom: 44 }}>How the magic happens</h2>
          <div className="grid-3">
            {STEPS.map((s, i) => (
              <div key={s.n} className={`card ${i % 2 ? 'tilt-r' : 'tilt-l'}`} style={{ padding: '34px 30px' }}>
                <div style={{ width: 54, height: 54, borderRadius: '50%', background: s.c, color: '#fff', display: 'grid', placeItems: 'center', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 26, marginBottom: 18, boxShadow: '0 5px 0 rgba(58,42,34,.16)' }}>{s.n}</div>
                <h3 className="display" style={{ fontSize: 24, marginBottom: 9 }}>{s.t}</h3>
                <p style={{ fontSize: 15.5, color: 'var(--ink-soft)', lineHeight: 1.6 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY PARENTS LOVE IT */}
      <section className="dband" id="features">
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto 44px' }}>
            <span className="eyebrow"><Sparkle size={14} /> Why parents love it</span>
            <h2 className="display d-h2" style={{ marginTop: 14 }}>Personal, gentle, and safe by design</h2>
          </div>
          <div className="grid-3">
            {FEATURES.map((f) => (
              <div key={f.t} className="card lift" style={{ padding: '30px 26px' }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: f.c, display: 'grid', placeItems: 'center', marginBottom: 16, boxShadow: '0 4px 0 rgba(58,42,34,.14)' }}>
                  <Icon name={f.icon} size={24} stroke="#fff" />
                </div>
                <h3 className="display" style={{ fontSize: 21, marginBottom: 8 }}>{f.t}</h3>
                <p style={{ fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.6 }}>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SAMPLE SPREADS / GALLERY */}
      <section className="dband dband-soft" id="samples">
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto 40px' }}>
            <span className="eyebrow"><Icon name="book" size={15} stroke="var(--teal)" /> Sample spreads</span>
            <h2 className="display d-h2" style={{ marginTop: 14 }}>A peek inside the pages</h2>
            <p className="d-lead" style={{ color: 'var(--ink-soft)', marginTop: 14 }}>
              Each preview is generated around a nickname, age band, interests, and the goal you choose.
            </p>
          </div>
          <div className="grid-3">
            {SPREADS.map((s) => (
              <div key={s.t} className={`card ${s.tilt} lift`} style={{ padding: 14 }}>
                <div className="sample-media">
                  <Image
                    src={s.src}
                    alt={`${s.t} sample storybook illustration`}
                    fill
                    sizes="(max-width: 860px) 90vw, 330px"
                    style={{ objectFit: 'cover' }}
                  />
                </div>
                <p style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 17, marginTop: 12, paddingLeft: 4 }}>{s.t}</p>
                <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', paddingLeft: 4, marginTop: 3 }}>{s.d}</p>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 26 }}>
            Sample illustrations shown. Your beta preview is made from the details you provide.
          </p>
        </div>
      </section>

      {/* USE CASES / OCCASIONS */}
      <section className="dband" id="occasions">
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto 44px' }}>
            <span className="eyebrow"><Icon name="heart" size={15} stroke="var(--coral)" /> A story for every moment</span>
            <h2 className="display d-h2" style={{ marginTop: 14 }}>Perfect for milestones &amp; gifting</h2>
          </div>
          <div className="grid-3">
            {OCCASIONS.map((o) => (
              <div key={o.t} className="card lift" style={{ padding: '26px 24px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ flexShrink: 0, width: 44, height: 44, borderRadius: '50%', background: o.c, display: 'grid', placeItems: 'center' }}>
                  <Icon name={o.icon} size={22} stroke="#fff" />
                </div>
                <div>
                  <h3 className="display" style={{ fontSize: 19, marginBottom: 6 }}>{o.t}</h3>
                  <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', lineHeight: 1.55 }}>{o.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="dband dband-soft">
        <div className="container-narrow" style={{ textAlign: 'center' }}>
          <Sparkle size={34} color="var(--gold)" />
          <h2 className="display d-h2" style={{ marginTop: 18 }}>Ready for a small circle of first families</h2>
          <p className="d-lead" style={{ color: 'var(--ink-soft)', marginTop: 16 }}>
            The alpha is designed for known parents who can try the flow, share honest feedback,
            and help us polish the story quality before a wider beta.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 28, flexWrap: 'wrap' }}>
            <span className="pill"><Icon name="heart" size={15} stroke="var(--coral)" /> A keepsake to revisit</span>
            <span className="pill"><Icon name="sun" size={15} stroke="var(--gold)" /> Made for bedtime</span>
            <span className="pill"><Icon name="shield" size={15} stroke="var(--brand)" /> Parents stay in control</span>
          </div>
        </div>
      </section>

      {/* PRICING TEASER */}
      <section className="dband" id="pricing">
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: 620, margin: '0 auto 44px' }}>
            <span className="eyebrow"><Sparkle size={14} /> Simple pricing</span>
            <h2 className="display d-h2" style={{ marginTop: 14 }}>From ₹299 — pay only after your free preview</h2>
            <p className="d-lead" style={{ color: 'var(--ink-soft)', marginTop: 14 }}>
              Target launch pricing in rupees. Checkout is paused during the internal alpha.
            </p>
          </div>
          <div className="grid-3">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className="card lift"
                style={{
                  padding: '30px 28px',
                  position: 'relative',
                  border: tier.highlight ? '2px solid var(--brand)' : '2px solid var(--hairline)',
                  background: tier.highlight ? 'var(--brand-tint)' : 'var(--surface)',
                }}
              >
                <span
                  className="pill"
                  style={{
                    position: 'absolute', top: -14, left: 24,
                    background: tier.highlight ? 'var(--brand)' : 'var(--surface)',
                    color: tier.highlight ? '#fff' : 'var(--brand)',
                    border: tier.highlight ? 'none' : '2px solid var(--hairline)',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  {tier.tag}
                </span>
                <h3 className="display" style={{ fontSize: 22, marginTop: 6 }}>{tier.name}</h3>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '10px 0 4px' }}>
                  <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>from</span>
                  <span className="display" style={{ fontSize: 38, color: 'var(--brand)' }}>{tier.price}</span>
                </div>
                <div style={{ height: 1, background: 'var(--hairline)', margin: '16px 0 18px' }} />
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {tier.items.map((it) => (
                    <li key={it} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.5 }}>
                      <Icon name="check" size={17} stroke="var(--success)" style={{ flexShrink: 0, marginTop: 2 }} /> {it}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <Link href="/create" className="btn btn-brand" style={{ padding: '17px 30px', fontSize: 17 }}>
              <Sparkle size={18} color="#fff" /> Start with a free preview
            </Link>
            <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 14 }}>Alpha testers can create previews first; payment checkout comes after quality validation.</p>
          </div>
        </div>
      </section>

      {/* PRIVACY / TRUST */}
      <section className="dband dband-soft" id="privacy">
        <div className="container grid-2">
          <div>
            <span className="eyebrow"><Icon name="shield" size={15} stroke="var(--brand)" /> Built around your child’s privacy</span>
            <h2 className="display d-h2" style={{ marginTop: 14 }}>Safe by design, not as an afterthought</h2>
            <p className="d-lead" style={{ color: 'var(--ink-soft)', margin: '16px 0 28px', maxWidth: 460 }}>
              We built MoonBell to be DPDP-friendly and parent-controlled. We collect the least we
              can, and you’re always in charge of it.
            </p>
            <Link href="/create" className="btn btn-primary" style={{ padding: '17px 28px', fontSize: 17 }}>
              <Sparkle size={18} color="var(--accent-ink)" /> Create your free preview
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { icon: 'shield' as const, t: 'No photos, ever', d: 'You describe how your child looks — we never ask for or store a single photo.' },
              { icon: 'lock' as const, t: 'Minimal details', d: 'A nickname, not a legal name. An age band, not a birth date. Their real name is never sent to an AI vendor or used to train AI.' },
              { icon: 'check' as const, t: 'Delete anytime', d: 'Erase everything in one tap. You stay in control of your family’s data, always.' },
            ].map((p) => (
              <div key={p.t} className="card" style={{ padding: '20px 22px', background: 'var(--brand-tint)', border: '1px solid #E6CBD7', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <Icon name={p.icon} size={26} stroke="var(--brand)" style={{ flexShrink: 0 }} />
                <div>
                  <h3 style={{ fontSize: 16.5, fontWeight: 700, color: 'var(--brand)' }}>{p.t}</h3>
                  <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--ink)', marginTop: 5 }}>{p.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="dband" id="faq">
        <div className="container-narrow">
          <h2 className="display d-h2" style={{ textAlign: 'center', marginBottom: 24 }}>Good to know</h2>
          {FAQS.map((f) => (
            <details key={f.q} style={{ borderBottom: '1px solid var(--hairline)', padding: '18px 4px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 18 }}>{f.q}</summary>
              <p style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--ink-soft)', paddingTop: 12, maxWidth: 640 }}>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="dband dband-soft">
        <div className="container-narrow" style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', marginBottom: 18, animation: 'twinkle 2.4s ease-in-out infinite' }}>
            <Sparkle size={40} color="var(--gold)" />
          </div>
          <h2 className="display d-h2">Their adventure is a minute away</h2>
          <p className="d-lead" style={{ color: 'var(--ink-soft)', margin: '16px auto 30px', maxWidth: 480 }}>
            See the preview free — fall in love before you spend a thing.
          </p>
          <Link href="/create" className="btn btn-primary" style={{ padding: '18px 30px', fontSize: 17.5 }}>
            <Sparkle size={19} color="var(--accent-ink)" /> Create your free preview
          </Link>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 22, marginTop: 28, flexWrap: 'wrap' }}>
            <span className="trust"><Icon name="sparkles" size={16} stroke="var(--teal)" /> Free preview</span>
            <span className="trust"><Icon name="shield" size={16} stroke="var(--brand)" /> No photos</span>
            <span className="trust"><Icon name="lock" size={16} stroke="var(--plum)" /> Never used to train AI</span>
            <span className="trust"><Icon name="check" size={16} stroke="var(--success)" /> Delete anytime</span>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
