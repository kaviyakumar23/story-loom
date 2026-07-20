'use client';

import Link from 'next/link';
import { BRAND } from '@/lib/brand';
import { useAuth } from '@/lib/auth';
import { Logo } from './logo';
import { Icon, Sparkle } from './ui';

export function Header({ minimal }: { minimal?: boolean }) {
  const { session, signOut } = useAuth();
  return (
    <header className="web-header">
      <div className="web-header-inner">
        <Link href="/" className="brandmark" aria-label={`${BRAND.name} home`}>
          <Logo size={30} />
        </Link>

        {minimal ? (
          <div className="trust" style={{ fontSize: 13 }}>
            <Icon name="lock" size={15} stroke="var(--brand)" /> Secure · never used to train AI
          </div>
        ) : (
          <nav className="web-nav">
            <Link href="/#how" className="hide-mobile">How it works</Link>
            <Link href="/#faq" className="hide-mobile">FAQ</Link>
            {session ? (
              <>
                <Link href="/books">My books</Link>
                <Link href="/account">Account</Link>
                <button className="btn btn-ghost btn-sm" onClick={() => void signOut()}>Sign out</button>
              </>
            ) : (
              <Link href="/signin">Sign in</Link>
            )}
            <Link href="/create" className="btn btn-primary btn-sm" style={{ padding: '12px 20px' }}>
              <Sparkle size={15} color="var(--accent-ink)" /> Create free preview
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}

export function Footer() {
  const cols: { h: string; items: { label: string; href: string }[] }[] = [
    {
      h: BRAND.name,
      items: [
        { label: 'How it works', href: '/#how' },
        { label: 'Sample pages', href: '/#samples' },
        { label: 'Pricing', href: '/#pricing' },
      ],
    },
    {
      h: 'Trust',
      items: [
        { label: 'Privacy', href: '/legal/privacy' },
        { label: 'Terms', href: '/legal/terms' },
        { label: 'AI Disclosure', href: '/legal/ai-disclosure' },
        { label: 'Content Policy', href: '/legal/content-policy' },
        { label: 'Cookies', href: '/legal/cookies' },
      ],
    },
    {
      h: 'Help',
      items: [
        { label: 'Refunds', href: '/legal/refunds' },
        { label: 'Shipping', href: '/legal/shipping' },
        { label: 'Contact', href: '/legal/contact' },
      ],
    },
  ];
  return (
    <footer style={{ background: 'var(--brand-deep)', color: '#EAE8FB' }}>
      <div className="container" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 40, padding: '56px 40px 30px' }}>
        <div>
          <div style={{ marginBottom: 14 }}>
            <Logo size={26} tone="light" />
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: '#C9C7EA', maxWidth: 260 }}>
            {BRAND.tagline} Personalised keepsake storybooks, made just for your child.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 16, fontSize: 13, color: '#D6D4F2' }}>
            <Icon name="lock" size={15} stroke="#D6D4F2" /> Your child&apos;s details, never used to train AI
          </div>
        </div>
        {cols.map((c) => (
          <div key={c.h}>
            <h4 style={{ fontSize: 13, letterSpacing: '.1em', textTransform: 'uppercase', color: '#A9A6D9', marginBottom: 14, fontWeight: 600 }}>{c.h}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {c.items.map((i) => (
                <Link key={i.label} href={i.href} style={{ color: '#EAE8FB', fontSize: 14, opacity: 0.88 }}>{i.label}</Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="container" style={{ borderTop: '1px solid rgba(255,255,255,.12)', padding: '18px 40px', fontSize: 12.5, color: '#9C99C9' }}>
        © 2026 {BRAND.name}. Made with care.
      </div>
    </footer>
  );
}
