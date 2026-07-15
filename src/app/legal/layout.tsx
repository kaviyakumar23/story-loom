import type { ReactNode } from 'react';
import { Footer, Header } from '@/components/chrome';
import { BUSINESS_DETAILS_COMPLETE } from '@/lib/business';

/**
 * Shared readable wrapper for all /legal/* pages.
 * Header + Footer chrome, a narrow prose container, and a DRAFT banner that
 * clears itself once every [TODO] in lib/business.ts is filled in.
 * These pages are static prose, so this layout (and its children) can be
 * server components; Header/Footer are client components, which is fine.
 */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="web" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main className="container-narrow" style={{ flex: 1, padding: '40px 40px 80px', maxWidth: 760 }}>
        {!BUSINESS_DETAILS_COMPLETE && (
          <div
            role="alert"
            style={{
              background: 'var(--soft-butter)',
              border: '1px solid var(--hairline)',
              borderRadius: 'var(--r)',
              padding: '12px 16px',
              marginBottom: 32,
              fontSize: 13.5,
              lineHeight: 1.5,
              color: '#8a6d1f',
              fontWeight: 600,
            }}
          >
            ⚠️ Draft — business details in lib/business.ts are pending; have a qualified lawyer review
            before charging customers.
          </div>
        )}
        <article
          className="legal-prose"
          style={{ fontSize: 15.5, lineHeight: 1.7, color: 'var(--ink)' }}
        >
          {children}
        </article>
      </main>
      <Footer />
    </div>
  );
}
