import type { Metadata } from 'next';
import { BUSINESS } from '@/lib/business';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Cookie Policy — Plumtale' };

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
        This Cookie Policy explains how Plumtale uses cookies and similar technologies. It works alongside our{' '}
        <Link href="/legal/privacy" style={link}>Privacy Policy</Link>.
      </p>

      <h2 className="display" style={h2}>Essential cookies</h2>
      <p style={p}>
        We use essential cookies and similar storage to keep you signed in and to keep the service secure. These
        include the authentication session managed by Supabase, our authentication provider. Without these,
        sign-in and core features would not work, so they cannot be switched off from within the app.
      </p>

      <h2 className="display" style={h2}>Analytics cookies</h2>
      <p style={p}>
        We do not currently use analytics cookies, third-party advertising cookies, or cross-site tracking
        cookies. If we add analytics in the future to understand how the service is used, we will update this
        policy and, where required, ask for your consent before non-essential cookies are set.
      </p>

      <h2 className="display" style={h2}>How to control cookies</h2>
      <ul style={ul}>
        <li style={li}>You can clear or block cookies through your browser settings. Blocking essential cookies may prevent you from signing in or using the service.</li>
        <li style={li}>Signing out ends your authentication session.</li>
        <li style={li}>If we introduce non-essential cookies, you will be able to manage your choices when they are added.</li>
      </ul>

      <h2 className="display" style={h2}>Changes</h2>
      <p style={p}>
        We may update this Cookie Policy as our use of cookies changes. Questions? See our{' '}
        <Link href="/legal/contact" style={link}>Contact</Link> page.
      </p>
    </>
  );
}
