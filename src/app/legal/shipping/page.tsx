import type { Metadata } from 'next';
import Link from 'next/link';
import { SERVICEABLE_SUMMARY } from '@/server/config/beta-geo';
import { BUSINESS } from '@/lib/business';

export const metadata: Metadata = { title: 'Shipping & Delivery — MoonBell' };

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
      <p style={meta}>Effective date: {BUSINESS.effectiveDate} · {BUSINESS.legalName}.</p>

      <h2 className="display" style={h2}>Digital delivery (at launch)</h2>
      <p style={p}>
        At launch, MoonBell delivers digital products only. When your purchase is complete, your book is
        available instantly:
      </p>
      <ul style={ul}>
        <li style={li}>You can download your PDF (and audio, if included) from your <Link href="/books" style={link}>book dashboard</Link>.</li>
        <li style={li}>We also email you a link to your finished book.</li>
        <li style={li}>Download links refresh each time you open the book page, so you can re-download whenever you need.</li>
      </ul>
      <p style={p}>There are no shipping charges for digital products.</p>

      <h2 className="display" style={h2}>Printed books</h2>
      <p style={p}>
        Every printed book is made to order for one child, so it is not picked off a shelf — it is
        checked by a person, printed, and then posted.
      </p>
      <ul style={ul}>
        <li style={li}>
          <strong>Where we deliver.</strong> While we are in beta we deliver to {SERVICEABLE_SUMMARY}.
          We check your PIN code before you pay, so you will never be charged for an address we
          cannot reach.
        </li>
        <li style={li}>
          <strong>How long it takes.</strong> Dispatched within 7 working days of your order, and
          delivered within 14 working days. If anything is going to take longer, we email you rather
          than leave you guessing.
        </li>
        <li style={li}>
          <strong>What it costs.</strong> Shipping is included in the price. There are no charges
          added at checkout.
        </li>
        <li style={li}>
          <strong>Tracking.</strong> We email you the courier and tracking number when the book
          ships.
        </li>
        <li style={li}>
          <strong>If delivery fails.</strong> If the courier cannot deliver and the book comes back
          to us, we contact you the same day to arrange another attempt. Damage, misprints and losses
          are handled under our{' '}
          <Link href="/legal/refunds" style={link}>Refund &amp; Cancellation Policy</Link>.
        </li>
      </ul>

      <h2 className="display" style={h2}>Questions</h2>
      <p style={p}>
        For delivery questions, contact us via our{' '}
        <Link href="/legal/contact" style={link}>Contact &amp; Grievance Redressal</Link> page.
      </p>
    </>
  );
}
