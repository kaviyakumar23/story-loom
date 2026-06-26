import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'AI Disclosure — Plumtale' };

const h1: React.CSSProperties = { fontSize: 34, marginBottom: 6, lineHeight: 1.1 };
const meta: React.CSSProperties = { fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 28 };
const h2: React.CSSProperties = { fontSize: 22, margin: '34px 0 10px', lineHeight: 1.2 };
const p: React.CSSProperties = { margin: '0 0 14px' };
const ul: React.CSSProperties = { margin: '0 0 14px', paddingLeft: 22 };
const li: React.CSSProperties = { margin: '0 0 7px' };
const link: React.CSSProperties = { color: 'var(--brand)', fontWeight: 600 };

export default function AiDisclosure() {
  return (
    <>
      <h1 className="display" style={h1}>AI Disclosure</h1>
      <p style={meta}>Effective date: [PLACEHOLDER: effective date] · [PLACEHOLDER: legal/business name].</p>

      <p style={p}>
        We believe in being open about how Plumtale works. Your child&apos;s book is created with the help of
        artificial intelligence, using the details you share — a nickname, an age band, a few appearance
        attributes, interests, and the goal you choose. Here is what that means in plain language.
      </p>

      <h2 className="display" style={h2}>The stories and pictures are AI-generated</h2>
      <p style={p}>
        Our system writes the story and paints the illustrations for you. Every book is a fresh, creative work
        built around your child as the hero. Because it is generated, two books made from similar details may
        still come out differently.
      </p>

      <h2 className="display" style={h2}>Outputs may have small imperfections</h2>
      <p style={p}>
        AI illustrations can have small visual inconsistencies — a detail that shifts slightly from page to
        page, or an element that isn&apos;t quite perfect. That is normal for AI-generated art. The
        illustrations are artistic and fictional; they are not photographs, and they are not a likeness check
        or any form of identity verification.
      </p>

      <h2 className="display" style={h2}>Please review your free preview first</h2>
      <p style={p}>
        Every book begins with a free preview. We encourage you to read it and look at the pictures before you
        decide to buy, so you know exactly what you are getting.
      </p>

      <h2 className="display" style={h2}>We keep it safe</h2>
      <p style={p}>
        Requests pass through safety moderation, and we reject prompts that are harmful or disallowed under our{' '}
        <Link href="/legal/content-policy" style={link}>Content &amp; Acceptable Use Policy</Link>. Your
        child&apos;s real name is protected and is never used to train AI models — see our{' '}
        <Link href="/legal/privacy" style={link}>Privacy Policy</Link>.
      </p>

      <h2 className="display" style={h2}>Transparency and emerging norms</h2>
      <p style={p}>
        We aim to be clear that this content is AI-generated, in the spirit of emerging AI-transparency
        expectations (such as those reflected in the EU AI Act and similar developing standards). We do not
        claim to be certified under any particular framework; we simply want you to know how your book is made.
      </p>

      <ul style={ul}>
        <li style={li}><Link href="/legal/terms" style={link}>Terms of Service</Link></li>
        <li style={li}><Link href="/legal/privacy" style={link}>Privacy Policy</Link></li>
      </ul>
    </>
  );
}
