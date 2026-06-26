import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Terms of Service — Plumtale' };

const h1: React.CSSProperties = { fontSize: 34, marginBottom: 6, lineHeight: 1.1 };
const meta: React.CSSProperties = { fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 28 };
const h2: React.CSSProperties = { fontSize: 22, margin: '34px 0 10px', lineHeight: 1.2 };
const p: React.CSSProperties = { margin: '0 0 14px' };
const ul: React.CSSProperties = { margin: '0 0 14px', paddingLeft: 22 };
const li: React.CSSProperties = { margin: '0 0 7px' };
const link: React.CSSProperties = { color: 'var(--brand)', fontWeight: 600 };

export default function Terms() {
  return (
    <>
      <h1 className="display" style={h1}>Terms of Service</h1>
      <p style={meta}>Effective date: [PLACEHOLDER: effective date] · Operated by [PLACEHOLDER: legal/business name].</p>

      <p style={p}>
        These Terms of Service (&quot;Terms&quot;) govern your use of Plumtale (&quot;Plumtale&quot;,
        &quot;we&quot;, &quot;us&quot;), a service that creates personalized, AI-generated illustrated
        children&apos;s storybooks. By creating an account, generating a preview, or making a purchase, you
        agree to these Terms. If you do not agree, please do not use the service.
      </p>

      <h2 className="display" style={h2}>1. What Plumtale does</h2>
      <p style={p}>
        Plumtale turns details you provide about a child — a nickname, an age band, appearance attributes
        (such as skin tone, hair, and whether they wear glasses), interests, and a chosen life-lesson goal —
        into a personalized story in which the child is the hero. Stories and illustrations are generated with
        the help of artificial intelligence. We do not collect photographs of any child.
      </p>

      <h2 className="display" style={h2}>2. Eligibility</h2>
      <p style={p}>
        You must be at least 18 years old and be the parent or legal guardian of the child described in a
        book, or otherwise be legally authorized to provide that child&apos;s details and to consent on their
        behalf. Children do not create or hold accounts. By using Plumtale you confirm you meet these
        requirements.
      </p>

      <h2 className="display" style={h2}>3. Your account</h2>
      <p style={p}>
        You access Plumtale through a parent account tied to your email address. You are responsible for
        keeping access to your email and account secure and for activity that occurs under your account.
        Please tell us promptly at [PLACEHOLDER: support email] if you believe your account has been used
        without your permission.
      </p>

      <h2 className="display" style={h2}>4. Acceptable use</h2>
      <p style={p}>
        You agree to use Plumtale only for lawful, personal, non-commercial purposes and to follow our{' '}
        <Link href="/legal/content-policy" style={link}>Content &amp; Acceptable Use Policy</Link>. Among
        other things, you may not submit requests that sexualize, endanger, or abuse children, that promote
        hate or harassment, that impersonate real people or public figures, or that are illegal, defamatory,
        or infringing. Requests are moderated and may be rejected, and accounts that misuse the service may be
        suspended or terminated.
      </p>

      <h2 className="display" style={h2}>5. Verifiable parental consent</h2>
      <p style={p}>
        Before we create a book featuring a child, we capture your verifiable consent as the child&apos;s
        parent or guardian. This consent is versioned, and we record which version you agreed to. You may
        withdraw your consent and delete the child&apos;s data at any time through your{' '}
        <Link href="/account" style={link}>account page</Link>.
      </p>

      <h2 className="display" style={h2}>6. Intellectual property and ownership</h2>
      <p style={p}>
        You retain ownership of the personal details you provide about your child. When you purchase a book,
        we grant you a personal, non-exclusive, worldwide, perpetual license to use, print at home, and share
        that finished book for personal, non-commercial purposes.
      </p>
      <p style={p}>
        Plumtale retains all rights in the underlying technology that powers the service, including our story
        templates, prompt designs, narrative structures, art direction, and software. AI-generated outputs may
        contain elements similar to other works, and the legal status of AI-generated content is still
        developing — so we make no representation that any output is protected by copyright or that ownership
        is exclusive. We do not claim that you receive &quot;100% copyright&quot; in generated text or images.
      </p>
      <p style={p}>
        We will not reuse your child&apos;s name, likeness, or personal story in our marketing or public
        materials without your separate, explicit permission.
      </p>

      <h2 className="display" style={h2}>7. AI-generated content disclaimer</h2>
      <p style={p}>
        Books are generated by AI from the details you provide. Outputs are creative and fictional and may
        contain small visual inconsistencies or imperfections. Illustrations are artistic interpretations and
        are not photographs, likeness verification, or identity documents. Please review your free preview
        before purchasing. See our{' '}
        <Link href="/legal/ai-disclosure" style={link}>AI Disclosure</Link> for details.
      </p>

      <h2 className="display" style={h2}>8. Pricing and payments</h2>
      <p style={p}>
        You can generate a free preview before paying. Purchases are made in Indian Rupees (INR) through our
        payment processor, Razorpay. Prices shown at checkout are the prices that apply to your order. At
        launch we deliver a digital PDF; printed books are not offered yet (see our{' '}
        <Link href="/legal/shipping" style={link}>Shipping Policy</Link>).
      </p>

      <h2 className="display" style={h2}>9. Refunds and cancellation</h2>
      <p style={p}>
        Refunds and cancellations are governed by our{' '}
        <Link href="/legal/refunds" style={link}>Refund &amp; Cancellation Policy</Link>, which forms part of
        these Terms.
      </p>

      <h2 className="display" style={h2}>10. Disclaimers and limitation of liability</h2>
      <p style={p}>
        The service is provided on an &quot;as is&quot; and &quot;as available&quot; basis. To the fullest
        extent permitted by applicable law, Plumtale is not liable for indirect, incidental, special, or
        consequential damages, and our total liability for any claim relating to the service will not exceed
        the amount you paid us for the order giving rise to the claim. Nothing in these Terms limits any rights
        you have under India&apos;s consumer protection laws that cannot be lawfully waived.
      </p>

      <h2 className="display" style={h2}>11. Termination</h2>
      <p style={p}>
        You may stop using Plumtale and delete your account and data at any time from your{' '}
        <Link href="/account" style={link}>account page</Link>. We may suspend or terminate access if you
        breach these Terms or our Content &amp; Acceptable Use Policy, or where required by law.
      </p>

      <h2 className="display" style={h2}>12. Changes to these Terms</h2>
      <p style={p}>
        We may update these Terms from time to time. If we make material changes, we will take reasonable
        steps to notify you. Your continued use after changes take effect means you accept the updated Terms.
      </p>

      <h2 className="display" style={h2}>13. Governing law and disputes</h2>
      <p style={p}>
        These Terms are governed by the laws of India, and the courts of [PLACEHOLDER: governing-law
        state/city in India] will have jurisdiction, subject to any mandatory consumer protections.
      </p>

      <h2 className="display" style={h2}>14. Grievance contact</h2>
      <p style={p}>
        For complaints or questions about these Terms, contact our grievance officer, [PLACEHOLDER: grievance
        officer name], at [PLACEHOLDER: grievance officer email], or write to us at [PLACEHOLDER: registered
        address]. See our{' '}
        <Link href="/legal/contact" style={link}>Contact &amp; Grievance Redressal</Link> page for the full
        process and timelines.
      </p>

      <ul style={ul}>
        <li style={li}><Link href="/legal/privacy" style={link}>Privacy Policy</Link></li>
        <li style={li}><Link href="/legal/refunds" style={link}>Refund &amp; Cancellation Policy</Link></li>
        <li style={li}><Link href="/legal/content-policy" style={link}>Content &amp; Acceptable Use Policy</Link></li>
      </ul>
    </>
  );
}
