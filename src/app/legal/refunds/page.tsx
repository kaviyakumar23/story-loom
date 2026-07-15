import type { Metadata } from 'next';
import Link from 'next/link';
import { BUSINESS } from '@/lib/business';

export const metadata: Metadata = { title: 'Refund & Cancellation Policy — Plumtale' };

const h1: React.CSSProperties = { fontSize: 34, marginBottom: 6, lineHeight: 1.1 };
const meta: React.CSSProperties = { fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 28 };
const h2: React.CSSProperties = { fontSize: 22, margin: '34px 0 10px', lineHeight: 1.2 };
const p: React.CSSProperties = { margin: '0 0 14px' };
const ul: React.CSSProperties = { margin: '0 0 14px', paddingLeft: 22 };
const li: React.CSSProperties = { margin: '0 0 7px' };
const link: React.CSSProperties = { color: 'var(--brand)', fontWeight: 600 };

export default function Refunds() {
  return (
    <>
      <h1 className="display" style={h1}>Refund &amp; Cancellation Policy</h1>
      <p style={meta}>Effective date: {BUSINESS.effectiveDate} · {BUSINESS.legalName}.</p>

      <p style={p}>
        We want you to love your book before you pay for it — that&apos;s why every book starts with a free
        preview. This policy explains when refunds and cancellations apply.
      </p>

      <h2 className="display" style={h2}>1. The free preview is free</h2>
      <p style={p}>
        You can generate and review a free preview before any payment. If you do not purchase, you are not
        charged anything. There is nothing to refund for a preview.
      </p>

      <h2 className="display" style={h2}>2. Digital products (PDF and audio)</h2>
      <p style={p}>
        Our digital products are generated and delivered to you on purchase. Because the finished book is
        produced specifically for your child and delivered immediately, <strong>digital purchases are
        generally non-refundable once the book has been generated or downloaded</strong>, except where there is
        a genuine technical failure that we are unable to fix (for example, a corrupted file or a delivery
        failure on our side that we cannot resolve).
      </p>
      <ul style={ul}>
        <li style={li}>Minor AI illustration imperfections or small visual inconsistencies — after you have already reviewed and approved the free preview — are not grounds for a refund.</li>
        <li style={li}>If a genuine technical failure prevents you from receiving or opening your purchased book and we cannot resolve it, we will re-deliver it or refund the affected purchase.</li>
        <li style={li}>If a story fails to complete due to an error on our side, you are not charged for what did not complete.</li>
      </ul>

      <h2 className="display" style={h2}>3. Printed books (coming later)</h2>
      <p style={p}>
        Printed books are not offered yet. When we introduce them, this policy will be updated. We expect the
        terms to work like this: you may cancel before printing begins; once a book has gone to print it cannot
        be cancelled; and we will reprint or refund a printed book that arrives damaged, misprinted, or
        delivered to the wrong address. See our{' '}
        <Link href="/legal/shipping" style={link}>Shipping Policy</Link>.
      </p>

      <h2 className="display" style={h2}>4. How to request a refund or cancellation</h2>
      <p style={p}>
        Email {BUSINESS.supportEmail} with your account email and order details, and a short description
        of the issue. We aim to acknowledge requests within {BUSINESS.refundAckWindow} and to resolve
        eligible requests within {BUSINESS.refundResolveWindow}. Approved refunds are returned to your
        original payment method through Razorpay; the time for the amount to appear depends on your bank or card
        provider.
      </p>

      <h2 className="display" style={h2}>5. Your statutory rights</h2>
      <p style={p}>
        Nothing in this policy limits any rights you have under India&apos;s consumer protection laws. For
        complaints, see our{' '}
        <Link href="/legal/contact" style={link}>Contact &amp; Grievance Redressal</Link> page.
      </p>
    </>
  );
}
