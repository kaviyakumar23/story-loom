'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { Icon, Sparkle } from './ui';

export function Header({ minimal }: { minimal?: boolean }) {
  const { session, signOut } = useAuth();
  return (
    <header className="web-header">
      <div className="web-header-inner">
        <Link href="/" className="brandmark">
          <Sparkle size={22} color="var(--brand)" />
          <span className="display" style={{ fontSize: 25, color: 'var(--brand)' }}>Plumtale</span>
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
      h: 'Plumtale',
      items: [
        { label: 'How it works', href: '/#how' },
        { label: 'Sample pages', href: '/#how' },
        { label: 'Pricing', href: '/#faq' },
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
    <footer style={{ background: 'var(--brand-deep)', color: '#F4E7EE' }}>
      <div className="container" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 40, padding: '56px 40px 30px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
            <Sparkle size={20} color="var(--accent)" />
            <span className="display" style={{ fontSize: 23, color: '#fff' }}>Plumtale</span>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: '#D9BECC', maxWidth: 260 }}>
            Personalized keepsake storybooks, made just for your child.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 16, fontSize: 13, color: '#E9D2DD' }}>
            <Icon name="lock" size={15} stroke="#E9D2DD" /> Your child&apos;s details, never used to train AI
          </div>
        </div>
        {cols.map((c) => (
          <div key={c.h}>
            <h4 style={{ fontSize: 13, letterSpacing: '.1em', textTransform: 'uppercase', color: '#C99FB3', marginBottom: 14, fontWeight: 600 }}>{c.h}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {c.items.map((i) => (
                <Link key={i.label} href={i.href} style={{ color: '#F4E7EE', fontSize: 14, opacity: 0.88 }}>{i.label}</Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="container" style={{ borderTop: '1px solid rgba(255,255,255,.12)', padding: '18px 40px', fontSize: 12.5, color: '#B790A4' }}>
        © 2026 Plumtale. Made with care.
      </div>
    </footer>
  );
}
