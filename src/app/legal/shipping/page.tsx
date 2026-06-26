import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Shipping & Delivery — Plumtale' };

const h1: React.CSSProperties = { fontSize: 34, marginBottom: 6, lineHeight: 1.1 };
const meta: React.CSSProperties = { fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 28 };
const h2: React.CSSProperties = { fontSize: 22, margin: '34px 0 10px', lineHeight: 1.2 };
const p: React.CSSProperties = { margin: '0 0 14px' };
const ul: React.CSSProperties = { margin: '0 0 14px', paddingLeft: 22 };
const li: React.CSSProperties = { margin: '0 0 7px' };
const link: React.CSSProperties = { color: 'var(--brand)', fontWeight: 600 };

export default function Shipping() {
  return (
    <>
      <h1 className="display" style={h1}>Shipping &amp; Delivery</h1>
      <p style={meta}>Effective date: [PLACEHOLDER: effective date] · [PLACEHOLDER: legal/business name].</p>

      <h2 className="display" style={h2}>Digital delivery (at launch)</h2>
      <p style={p}>
        At launch, Plumtale delivers digital products only. When your purchase is complete, your book is
        available instantly:
      </p>
      <ul style={ul}>
        <li style={li}>You can download your PDF (and audio, if included) from your <Link href="/books" style={link}>book dashboard</Link>.</li>
        <li style={li}>We also email you a link to your finished book.</li>
        <li style={li}>Download links refresh each time you open the book page, so you can re-download whenever you need.</li>
      </ul>
      <p style={p}>There are no shipping charges for digital products.</p>

      <h2 className="display" style={h2}>Printed books (coming later)</h2>
      <p style={p}>
        Printed, physical books are not offered yet. We hope to add them in the future. When we do, the intended
        terms below will apply and this page will be updated:
      </p>
      <ul style={ul}>
        <li style={li}><strong>Coverage:</strong> [PLACEHOLDER: shipping regions, e.g. across India to start].</li>
        <li style={li}><strong>Processing &amp; printing time:</strong> [PLACEHOLDER: e.g. 2–4 business days].</li>
        <li style={li}><strong>Delivery time:</strong> [PLACEHOLDER: estimated delivery window].</li>
        <li style={li}><strong>Shipping charges:</strong> [PLACEHOLDER: shipping fees / free-shipping threshold].</li>
        <li style={li}><strong>Tracking:</strong> [PLACEHOLDER: tracking details, if available].</li>
      </ul>
      <p style={p}>
        For printed orders, cancellations, damage, and misprints will be handled under our{' '}
        <Link href="/legal/refunds" style={link}>Refund &amp; Cancellation Policy</Link>.
      </p>

      <h2 className="display" style={h2}>Questions</h2>
      <p style={p}>
        For delivery questions, contact us via our{' '}
        <Link href="/legal/contact" style={link}>Contact &amp; Grievance Redressal</Link> page.
      </p>
    </>
  );
}
