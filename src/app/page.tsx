import Link from 'next/link';
import { Footer, Header } from '@/components/chrome';
import { Icon, Sparkle, Stars, Uline } from '@/components/ui';

const STEPS = [
  { n: '1', t: 'Tell us about them', d: 'Their nickname, age, how they look, and what they love — about a minute.', c: 'var(--teal)' },
  { n: '2', t: 'Pick a story goal', d: 'Sleeping alone, starting school, kindness — the story is shaped around it.', c: 'var(--sky)' },
  { n: '3', t: 'Watch the magic', d: 'See them appear as the hero — a free preview before you decide to buy.', c: 'var(--coral)' },
];

const FAQS = [
  { q: 'How much does a book cost?', a: 'You only pay after you’ve seen your free preview and love it. Pricing is shown at checkout; a digital PDF is the most affordable option.' },
  { q: 'Do you need a photo of my child?', a: 'No. We never collect photos. You describe how they look (skin tone, hair, glasses) and we illustrate an original character — safer and fully under your control.' },
  { q: 'Is my child’s data safe?', a: 'Yes. We collect the minimum (a nickname, not a legal name; an age band, not a birth date), their real name never leaves our system to an AI vendor, and you can delete everything anytime.' },
  { q: 'What if it isn’t quite right?', a: 'Tweak the details and we’ll regenerate. You see the preview free before paying.' },
];

export default function Landing() {
  return (
    <div className="web">
      <Header />

      {/* HERO */}
      <section className="dband" style={{ paddingTop: 84, paddingBottom: 56 }}>
        <div className="container grid-2">
          <div style={{ animation: 'fadeUp .6s ease both' }}>
            <span className="eyebrow"><Sparkle size={14} /> A keepsake made just for them</span>
            <h1 className="display d-h1" style={{ marginTop: 18 }}>
              Make your child the <Uline>hero</Uline> of their own storybook
            </h1>
            <p className="d-lead" style={{ color: 'var(--ink-soft)', marginTop: 22, maxWidth: 480 }}>
              Describe them, choose a gentle life lesson, and watch them step into a beautifully
              illustrated adventure — ready to read in minutes.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 32, flexWrap: 'wrap' }}>
              <Link href="/create" className="btn btn-primary" style={{ padding: '18px 28px', fontSize: 17 }}>
                <Sparkle size={18} color="var(--accent-ink)" /> Create your free preview
              </Link>
              <span style={{ fontSize: 14.5, color: 'var(--ink-soft)' }}>Free · a couple of minutes</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 28 }}>
              <Stars size={18} />
              <span style={{ fontWeight: 600, fontSize: 15 }}>Loved by families</span>
            </div>
          </div>
          <div style={{ position: 'relative', animation: 'fadeUp .6s ease .14s both' }}>
            <div className="card tilt-l" style={{ aspectRatio: '1', border: '9px solid var(--surface)', overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
              <div className="ph" style={{ position: 'absolute', inset: 0, borderRadius: 0, backgroundColor: '#FCD9A6' }} />
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

      {/* TRUST + CTA */}
      <section className="dband">
        <div className="container grid-2">
          <div>
            <h2 className="display d-h2">Their adventure is a minute away</h2>
            <p className="d-lead" style={{ color: 'var(--ink-soft)', margin: '16px 0 28px', maxWidth: 440 }}>
              See the preview free — fall in love before you spend a thing.
            </p>
            <Link href="/create" className="btn btn-primary" style={{ padding: '18px 28px', fontSize: 17 }}>
              <Sparkle size={18} color="var(--accent-ink)" /> Create your free preview
            </Link>
            <div style={{ display: 'flex', gap: 24, marginTop: 26, flexWrap: 'wrap' }}>
              <span className="trust"><Icon name="lock" size={16} stroke="var(--brand)" /> Never used to train AI</span>
              <span className="trust"><Icon name="shield" size={16} stroke="var(--success)" /> Delete anytime</span>
            </div>
          </div>
          <div className="card" style={{ padding: '22px 24px', background: 'var(--brand-tint)', border: '1px solid #E6CBD7' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <Icon name="shield" size={28} stroke="var(--brand)" />
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--brand)' }}>Built around your child’s privacy</h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--ink)', marginTop: 6 }}>
                  No photos. A nickname, not a legal name. Their real name never leaves our system to an AI
                  vendor, and you can erase everything in one tap.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="dband dband-soft" id="faq">
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

      <Footer />
    </div>
  );
}
