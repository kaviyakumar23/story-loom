import type { Metadata } from 'next';
import Link from 'next/link';
import { BUSINESS } from '@/lib/business';

export const metadata: Metadata = { title: 'Contact & Grievance Redressal — Plumtale' };

const h1: React.CSSProperties = { fontSize: 34, marginBottom: 6, lineHeight: 1.1 };
const meta: React.CSSProperties = { fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 28 };
const h2: React.CSSProperties = { fontSize: 22, margin: '34px 0 10px', lineHeight: 1.2 };
const p: React.CSSProperties = { margin: '0 0 14px' };
const ul: React.CSSProperties = { margin: '0 0 14px', paddingLeft: 22 };
const li: React.CSSProperties = { margin: '0 0 7px' };
const link: React.CSSProperties = { color: 'var(--brand)', fontWeight: 600 };
const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--hairline)',
  borderRadius: 'var(--r)',
  padding: '18px 20px',
  margin: '0 0 18px',
  lineHeight: 1.7,
};

export default function Contact() {
  return (
    <>
      <h1 className="display" style={h1}>Contact &amp; Grievance Redressal</h1>
      <p style={meta}>Effective date: {BUSINESS.effectiveDate}.</p>

      <p style={p}>
        We are here to help. This page tells you who we are and how to reach us, including how to raise a formal
        grievance under India&apos;s Consumer Protection (E-Commerce) Rules and the DPDP Act.
      </p>

      <h2 className="display" style={h2}>Who we are</h2>
      <div style={card}>
        <div><strong>Business name:</strong> {BUSINESS.legalName}</div>
        <div><strong>Registered address:</strong> {BUSINESS.registeredAddress}</div>
        <div><strong>Support email:</strong> {BUSINESS.supportEmail}</div>
      </div>

      <h2 className="display" style={h2}>Grievance officer</h2>
      <div style={card}>
        <div><strong>Name:</strong> {BUSINESS.grievanceOfficerName}</div>
        <div><strong>Email:</strong> {BUSINESS.grievanceOfficerEmail}</div>
        <div><strong>Address:</strong> {BUSINESS.registeredAddress}</div>
      </div>

      <h2 className="display" style={h2}>How to raise a complaint</h2>
      <ul style={ul}>
        <li style={li}>Email our support address or grievance officer with your account email, order details (if any), and a clear description of the issue.</li>
        <li style={li}>We will acknowledge your complaint within {BUSINESS.grievanceAckWindow} of receipt.</li>
        <li style={li}>We aim to resolve grievances within {BUSINESS.grievanceResolveWindow} (or sooner where required by applicable rules), and we will keep you updated on progress.</li>
        <li style={li}>For data-protection matters (access, correction, export, erasure, or withdrawing consent), you can also use your <Link href="/account" style={link}>account page</Link> directly.</li>
      </ul>

      <h2 className="display" style={h2}>Related policies</h2>
      <ul style={ul}>
        <li style={li}><Link href="/legal/privacy" style={link}>Privacy Policy</Link></li>
        <li style={li}><Link href="/legal/terms" style={link}>Terms of Service</Link></li>
        <li style={li}><Link href="/legal/refunds" style={link}>Refund &amp; Cancellation Policy</Link></li>
      </ul>
    </>
  );
}
