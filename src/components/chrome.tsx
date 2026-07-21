'use client';

import Link from 'next/link';
import { BRAND } from '@/lib/brand';
import { useAuth } from '@/lib/auth';
import { NewsletterForm } from './landing/NewsletterForm';
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

const SOCIALS: { label: string; d: string }[] = [
  { label: 'Instagram', d: 'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Zm5 5.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM17.5 6.5h.01' },
  { label: 'Facebook', d: 'M14 8h2V5h-2a3 3 0 0 0-3 3v2H9v3h2v6h3v-6h2.5l.5-3H14V8Z' },
  { label: 'YouTube', d: 'M3 8.5A2.5 2.5 0 0 1 5.5 6h13A2.5 2.5 0 0 1 21 8.5v7A2.5 2.5 0 0 1 18.5 18h-13A2.5 2.5 0 0 1 3 15.5v-7ZM10.5 9.5v5l4-2.5-4-2.5Z' },
  { label: 'Pinterest', d: 'M12 3a9 9 0 0 0-3.3 17.4c-.1-.8-.2-2 0-2.9l1.1-4.7s-.3-.6-.3-1.4c0-1.3.8-2.3 1.7-2.3.8 0 1.2.6 1.2 1.4 0 .8-.5 2-.8 3.2-.2.9.5 1.7 1.4 1.7 1.7 0 2.9-2.2 2.9-4.7 0-2-1.3-3.4-3.7-3.4a4.2 4.2 0 0 0-4.4 4.2c0 .8.3 1.4.6 1.8.1.2.2.3.1.5l-.2.9c-.1.3-.3.4-.5.2-1.1-.5-1.6-1.8-1.6-3.3 0-2.5 2.1-5.4 6.2-5.4 3.4 0 5.6 2.4 5.6 5 0 3.4-1.9 6-4.7 6-1 0-1.9-.5-2.2-1.1l-.6 2.3c-.2.7-.6 1.5-1 2.1A9 9 0 1 0 12 3Z' },
];

export function Footer() {
  const cols: { h: string; items: { label: string; href: string }[] }[] = [
    { h: 'Explore', items: [
      { label: 'How it works', href: '/#how' },
      { label: 'See a sample', href: '/#sample' },
      { label: 'The book', href: '/#pricing' },
      { label: 'FAQ', href: '/#faq' },
    ] },
    { h: 'Trust & safety', items: [
      { label: 'Privacy', href: '/legal/privacy' },
      { label: 'Terms', href: '/legal/terms' },
      { label: 'AI Disclosure', href: '/legal/ai-disclosure' },
      { label: 'Content Policy', href: '/legal/content-policy' },
      { label: 'Cookies', href: '/legal/cookies' },
    ] },
    { h: 'Help', items: [
      { label: 'Refunds', href: '/legal/refunds' },
      { label: 'Shipping', href: '/legal/shipping' },
      { label: 'Contact', href: '/legal/contact' },
    ] },
  ];
  return (
    <footer style={{ background: 'var(--brand-deep)', color: '#EAE8FB' }}>
      <div className="container foot-grid">
        <div className="foot-brand">
          <Logo size={26} tone="light" tagline />
          <p style={{ fontSize: 14, lineHeight: 1.6, color: '#C9C7EA', maxWidth: 260, marginTop: 12 }}>
            Personalised stories and keepsakes that celebrate who they are.
          </p>
          {/* Social links are placeholders — set real URLs when accounts exist. */}
          <div className="foot-social">
            {SOCIALS.map((s) => (
              <a key={s.label} href="#" aria-label={s.label} className="foot-social-btn">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={s.d} /></svg>
              </a>
            ))}
          </div>
        </div>
        {cols.map((c) => (
          <div key={c.h}>
            <h4 className="foot-h">{c.h}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {c.items.map((i) => (
                <Link key={i.label} href={i.href} style={{ color: '#EAE8FB', fontSize: 14, opacity: 0.88 }}>{i.label}</Link>
              ))}
            </div>
          </div>
        ))}
        <div className="foot-news">
          <h4 className="foot-h">Stay in the loop</h4>
          <p style={{ fontSize: 13.5, color: '#C9C7EA', lineHeight: 1.55, marginBottom: 12 }}>
            Get stories, offers and inspiration straight to your inbox.
          </p>
          <NewsletterForm variant="dark" />
        </div>
      </div>
      <div className="container" style={{ borderTop: '1px solid rgba(255,255,255,.12)', padding: '18px 40px', fontSize: 12.5, color: '#9C99C9', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <span>© 2026 {BRAND.name}. Made with care.</span>
        <span>India (English)</span>
      </div>
    </footer>
  );
}
