import type { Metadata } from 'next';
import { Caveat, Nunito, Playfair_Display } from 'next/font/google';
import { BRAND } from '@/lib/brand';
import { AuthProvider } from '@/lib/auth';
import './globals.css';

// Self-hosted via next/font (no render-blocking Google Fonts request). Each
// exposes a CSS variable consumed by --display/--sans/--hand in globals.css.
const display = Playfair_Display({ subsets: ['latin'], style: ['normal', 'italic'], variable: '--font-display', display: 'swap' });
const sans = Nunito({ subsets: ['latin'], style: ['normal', 'italic'], variable: '--font-sans', display: 'swap' });
const hand = Caveat({ subsets: ['latin'], variable: '--font-hand', display: 'swap' });

const TITLE = `${BRAND.name} — Personalised Storybooks`;

export const metadata: Metadata = {
  metadataBase: new URL('https://www.moonbell.in'),
  title: TITLE,
  description: BRAND.hero.sub,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: BRAND.name,
    title: TITLE,
    description: BRAND.hero.sub,
    url: '/',
    locale: 'en_IN',
    images: [{ url: '/landing/og-card.jpg', width: 1200, height: 630, alt: `${BRAND.name} — ${BRAND.hero.headline}` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: BRAND.hero.sub,
    images: ['/landing/og-card.jpg'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${hand.variable}`}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
