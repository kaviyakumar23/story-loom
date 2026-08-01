import type { Metadata } from 'next';
import { BUSINESS } from '@/lib/business';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Cookie Policy — MoonBell' };

const h1: React.CSSProperties = { fontSize: 34, marginBottom: 6, lineHeight: 1.1 };
const meta: React.CSSProperties = { fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 28 };
const h2: React.CSSProperties = { fontSize: 22, margin: '34px 0 10px', lineHeight: 1.2 };
const p: React.CSSProperties = { margin: '0 0 14px' };
const ul: React.CSSProperties = { margin: '0 0 14px', paddingLeft: 22 };
const li: React.CSSProperties = { margin: '0 0 7px' };
const link: React.CSSProperties = { color: 'var(--brand)', fontWeight: 600 };

export default function Cookies() {
  return (
    <>
      <h1 className="display" style={h1}>Cookie Policy</h1>
      <p style={meta}>Effective date: {BUSINESS.effectiveDate} · {BUSINESS.legalName}.</p>

      <p style={p}>
        This Cookie Policy explains how MoonBell uses cookies and similar technologies. It works alongside our{' '}
        <Link href="/legal/privacy" style={link}>Privacy Policy</Link>.
      </p>

      <h2 className="display" style={h2}>The cookies we set</h2>
      <p style={p}>
        All of them are our own. We use no third-party analytics, no advertising cookies, and nothing that
        follows you to other websites.
      </p>
      <ul style={ul}>
        <li style={li}>
          <strong>Your sign-in session</strong> — managed by Supabase, our authentication provider. Without it
          you could not stay signed in or open your own books.
        </li>
        <li style={li}>
          <strong>Beta access</strong> — remembers that you entered a valid invite code, so you are not asked
          again on every visit.
        </li>
        <li style={li}>
          <strong>A visitor id (<code>mb_vid</code>)</strong> — a random number, kept for up to six months. We
          are testing two prices during the beta, and this is how we show you the same one every time rather
          than a different price on each visit. It is not linked to your name or your email.
        </li>
        <li style={li}>
          <strong>A visit id (<code>mb_sid</code>)</strong> — a random number that expires after two hours. It
          lets us count how many people reach each step of the site, so we can tell where it is confusing.
          It records which buttons were used and how far pages were scrolled — never anything you typed, and
          never anything about your child.
        </li>
      </ul>
      <p style={p}>
        The last two are how we measure whether the site works. We consider them necessary to run the service
        rather than tracking: they are first-party, short-lived, hold no personal data, and are never shared,
        sold, or used for advertising. We do not build a profile of you and we do not know who you are from
        them.
      </p>

      <h2 className="display" style={h2}>How to control cookies</h2>
      <ul style={ul}>
        <li style={li}>You can clear or block cookies through your browser settings. Blocking essential cookies may prevent you from signing in or using the service.</li>
        <li style={li}>Signing out ends your authentication session.</li>
        <li style={li}>Clearing the two random ids simply means you may be shown a different price on your next visit, and your visit is counted as a new one.</li>
        <li style={li}>If we ever introduce advertising or third-party cookies, we will update this policy and ask for your consent before setting them.</li>
      </ul>

      <h2 className="display" style={h2}>Changes</h2>
      <p style={p}>
        We may update this Cookie Policy as our use of cookies changes. Questions? See our{' '}
        <Link href="/legal/contact" style={link}>Contact</Link> page.
      </p>
    </>
  );
}
