import type { Metadata } from 'next';
import { BRAND } from '@/lib/brand';
import { AuthProvider } from '@/lib/auth';
import './globals.css';

export const metadata: Metadata = {
  title: `${BRAND.name} — Personalised Storybooks`,
  description: BRAND.hero.sub,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
