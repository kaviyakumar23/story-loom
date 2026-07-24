'use client';

import Link from 'next/link';
import { BRAND } from '@/lib/brand';
import { useAuth } from '@/lib/auth';
import { NewsletterForm } from './landing/NewsletterForm';
import { Logo } from './logo';
import { Icon } from './ui';

export function Header({ minimal }: { minimal?: boolean }) {
  const { session } = useAuth();
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
            <Link href="/#sample" className="hide-mobile">Sample</Link>
            <Link href="/#pricing" className="hide-mobile">The book</Link>
            <Link href="/#faq" className="hide-mobile">FAQ</Link>
            <Link href="/#trust" className="hide-mobile">About us</Link>
            <span className="nav-icons">
              <Link href={session ? '/account' : '/signin'} aria-label={session ? 'Account' : 'Sign in'} className="nav-ic">
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.4" /><path d="M5.5 20c.6-3.6 3.2-5.6 6.5-5.6s5.9 2 6.5 5.6" /></svg>
              </Link>
              <Link href="/books" aria-label="My books" className="nav-ic">
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 8h11l-.8 11.2a1.5 1.5 0 0 1-1.5 1.4H8.8a1.5 1.5 0 0 1-1.5-1.4L6.5 8Z" /><path d="M9.2 8V6.6a2.8 2.8 0 0 1 5.6 0V8" /></svg>
              </Link>
            </span>
            <Link href="/create" className="btn btn-brand btn-sm nav-cta">{BRAND.hero.primaryCta}</Link>
          </nav>
        )}
      </div>
    </header>
  );
}

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
      { label: 'Delivery', href: '/legal/shipping' },
      { label: 'Contact', href: '/legal/contact' },
    ] },
  ];
  return (
    <footer style={{ background: 'var(--brand-deep)', color: '#EAE8FB' }}>
      <div className="container foot-grid">
        <div className="foot-brand">
          <Logo size={26} tone="light" tagline />
          <p style={{ fontSize: 14, lineHeight: 1.6, color: '#C9C7EA', maxWidth: 260, marginTop: 12 }}>
            Personalised printed storybooks that celebrate who they are.
          </p>
          {/* Social icons intentionally omitted until real accounts exist —
              placeholder href="#" links read as broken/dishonest. */}
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
