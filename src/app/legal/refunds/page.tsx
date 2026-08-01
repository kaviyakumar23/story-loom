import type { Metadata } from 'next';
import Link from 'next/link';
import { BUSINESS } from '@/lib/business';

export const metadata: Metadata = { title: 'Refund & Cancellation Policy — MoonBell' };

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

      <h2 className="display" style={h2}>3. Printed books</h2>
      <p style={p}>
        A printed book is made for one child and cannot be resold, so the cancellation window is tied
        to the moment it goes to the printer rather than to a fixed number of days.
      </p>
      <ul style={ul}>
        <li style={li}>
          <strong>Before we release it to print:</strong> cancel for any reason and receive a full
          refund. You can ask by email at any point after ordering; we check the book by hand first,
          so there is normally a day or more before it is released.
        </li>
        <li style={li}>
          <strong>After it has gone to print:</strong> the book cannot be cancelled, because it
          physically exists and carries your child&apos;s name. If you tell us during printing we will
          do what we can, but we cannot promise to stop it.
        </li>
        <li style={li}>
          <strong>If something is wrong with it:</strong> we reprint and reship at no cost to you.
          That covers damage in transit, printing faults, missing or misordered pages, and your
          child&apos;s details being wrong on our side. Tell us within 7 days of delivery and send a
          photo if you can.
        </li>
        <li style={li}>
          <strong>If it never arrives:</strong> if the courier loses it or it is returned to us
          undelivered, we reship it or refund you in full — your choice.
        </li>
      </ul>
      <p style={p}>
        Minor differences between the preview and the printed book — colour on paper versus a screen,
        small illustration imperfections you already saw and approved — are not by themselves grounds
        for a refund. See our{' '}
        <Link href="/legal/shipping" style={link}>Shipping Policy</Link> for delivery timelines.
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
