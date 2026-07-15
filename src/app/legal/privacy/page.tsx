import type { Metadata } from 'next';
import Link from 'next/link';
import { BUSINESS } from '@/lib/business';

export const metadata: Metadata = { title: 'Privacy Policy — Plumtale' };

const h1: React.CSSProperties = { fontSize: 34, marginBottom: 6, lineHeight: 1.1 };
const meta: React.CSSProperties = { fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 28 };
const h2: React.CSSProperties = { fontSize: 22, margin: '34px 0 10px', lineHeight: 1.2 };
const p: React.CSSProperties = { margin: '0 0 14px' };
const ul: React.CSSProperties = { margin: '0 0 14px', paddingLeft: 22 };
const li: React.CSSProperties = { margin: '0 0 7px' };
const link: React.CSSProperties = { color: 'var(--brand)', fontWeight: 600 };
const callout: React.CSSProperties = {
  background: 'var(--brand-tint)',
  border: '1px solid var(--hairline)',
  borderRadius: 'var(--r)',
  padding: '14px 16px',
  margin: '0 0 18px',
  fontSize: 14.5,
  lineHeight: 1.6,
};

export default function Privacy() {
  return (
    <>
      <h1 className="display" style={h1}>Privacy Policy</h1>
      <p style={meta}>Effective date: {BUSINESS.effectiveDate} · Data fiduciary: {BUSINESS.legalName}.</p>

      <p style={p}>
        This Privacy Policy explains how Plumtale (&quot;we&quot;, &quot;us&quot;) handles personal data when
        you use our service to create personalized, AI-generated children&apos;s storybooks. We have designed
        Plumtale to be privacy-first and to align with India&apos;s Digital Personal Data Protection Act, 2023
        (the &quot;DPDP Act&quot;). The parent or guardian is our point of contact and is the data principal
        interface for any child&apos;s data we process.
      </p>

      <div style={callout}>
        <strong>The short version:</strong> We do not collect photos of children. We never send a child&apos;s
        real name to our AI vendors, and your child&apos;s details are never used to train AI. Children do not
        have accounts and are not tracked, profiled, or advertised to. You can export or delete everything at
        any time.
      </div>

      <h2 className="display" style={h2}>1. What we collect</h2>
      <ul style={ul}>
        <li style={li}><strong>Parent account:</strong> your email address (used to sign in and to send you your book).</li>
        <li style={li}><strong>Child details for the story:</strong> a nickname (not a legal name), an age band (not a date of birth), appearance attributes (such as skin tone, hair, and whether they wear glasses), and interests.</li>
        <li style={li}><strong>Goal and reading level:</strong> the life-lesson goal and reading level you choose for the story.</li>
        <li style={li}><strong>Order and payment metadata:</strong> records of purchases and payment status. Card and bank details are handled by our payment processor; we do not store them.</li>
        <li style={li}><strong>Consent records:</strong> the version of consent you agreed to and when.</li>
        <li style={li}><strong>Basic technical data:</strong> information needed to keep your session secure and the service working.</li>
      </ul>

      <h2 className="display" style={h2}>2. What we do NOT collect</h2>
      <ul style={ul}>
        <li style={li}>No photographs or images of any child.</li>
        <li style={li}>No legal name, date of birth, school, home address, or phone number of the child.</li>
        <li style={li}>We do not send a child&apos;s real name to any AI vendor (see &quot;Tokenization&quot; below).</li>
        <li style={li}>We do not build advertising profiles of children or track children across the web.</li>
      </ul>

      <h2 className="display" style={h2}>3. Why we use this data (purposes)</h2>
      <ul style={ul}>
        <li style={li}>To generate the personalized story text and illustrations you request.</li>
        <li style={li}>To moderate content for safety and to prevent misuse.</li>
        <li style={li}>To process your free preview, payment, and delivery of the finished book.</li>
        <li style={li}>To provide support, respond to grievances, and meet legal obligations.</li>
      </ul>
      <p style={p}>We practice data minimization — we ask only for what a story needs, and nothing more.</p>

      <h2 className="display" style={h2}>4. Verifiable parental consent and children&apos;s data</h2>
      <p style={p}>
        Because Plumtale processes data relating to children, we treat that data with special care under the
        DPDP Act. Before creating a book featuring a child, we obtain the verifiable consent of the
        child&apos;s parent or guardian, and we record the consent version. Children do not have accounts and
        are not the users of the service — the parent or guardian is. We do not undertake tracking, behavioural
        monitoring, or targeted advertising directed at children. You may withdraw consent at any time, which
        removes the associated child data and generated assets.
      </p>

      <h2 className="display" style={h2}>5. Tokenization — the child&apos;s name is protected</h2>
      <p style={p}>
        The child&apos;s name is tokenized (replaced with a placeholder) before any request is sent to an AI
        vendor, and it is reinserted only within our own systems when the finished book is assembled. Your
        child&apos;s details are <strong>never used to train AI models</strong>.
      </p>

      <h2 className="display" style={h2}>6. AI vendors and sub-processors</h2>
      <p style={p}>We use the following service providers to operate Plumtale:</p>
      <ul style={ul}>
        <li style={li}><strong>OpenAI</strong> — generation of story text and safety moderation.</li>
        <li style={li}><strong>Google (Gemini)</strong> — generation of illustrations.</li>
        <li style={li}><strong>ElevenLabs</strong> — optional audio narration (only if you choose an audio product).</li>
        <li style={li}><strong>Supabase</strong> — authentication, database, and storage of your account and books.</li>
        <li style={li}><strong>Razorpay</strong> — payment processing (INR).</li>
        <li style={li}><strong>Resend</strong> — transactional email (such as sending you your book link).</li>
        <li style={li}><strong>Vercel</strong> — hosting and delivery of the web application.</li>
      </ul>

      <h2 className="display" style={h2}>7. Cross-border transfer</h2>
      <p style={p}>
        Some of these providers process data outside India, including in the United States. By using Plumtale
        you understand that limited data needed to generate and deliver your book may be processed outside
        India. We share only the minimum required, and the child&apos;s real name is tokenized before any AI
        vendor receives the request. We rely on appropriate safeguards and our agreements with these providers.
      </p>

      <h2 className="display" style={h2}>8. How long we keep data (retention)</h2>
      <ul style={ul}>
        <li style={li}><strong>Unpurchased previews:</strong> automatically purged after a retention window (approximately 30 days, configurable).</li>
        <li style={li}><strong>Purchased books:</strong> kept available to you so you can re-download them, until you delete them or close your account.</li>
        <li style={li}><strong>Records we must retain:</strong> certain order, tax, and legal records may be retained as required by law.</li>
      </ul>

      <h2 className="display" style={h2}>9. Security</h2>
      <p style={p}>
        We use reasonable technical and organizational measures to protect personal data, including
        authenticated access, owner-scoped data, expiring download links, and encryption in transit. No system
        is perfectly secure, but we work to safeguard your information and to handle any incident responsibly.
      </p>

      <h2 className="display" style={h2}>10. Your rights</h2>
      <p style={p}>As a data principal under the DPDP Act, you have the right to:</p>
      <ul style={ul}>
        <li style={li}><strong>Access and export</strong> the data we hold about you and your child&apos;s book.</li>
        <li style={li}><strong>Correct</strong> inaccurate or incomplete details.</li>
        <li style={li}><strong>Erase</strong> your data and the child&apos;s data, and withdraw consent.</li>
        <li style={li}><strong>Nominate</strong> another person to exercise your rights in the event of death or incapacity.</li>
        <li style={li}><strong>Grievance redressal</strong> — raise a complaint and receive a response.</li>
      </ul>
      <p style={p}>
        You can exercise access, export, and erasure yourself from your{' '}
        <Link href="/account" style={link}>account page</Link> (Download my data and Delete my account &amp;
        data). You may also email us at {BUSINESS.supportEmail}.
      </p>

      <h2 className="display" style={h2}>11. Grievance officer</h2>
      <p style={p}>
        Grievance Officer: {BUSINESS.grievanceOfficerName} · {BUSINESS.grievanceOfficerEmail} ·
        {BUSINESS.registeredAddress}. See our{' '}
        <Link href="/legal/contact" style={link}>Contact &amp; Grievance Redressal</Link> page for the process
        and timelines.
      </p>

      <h2 className="display" style={h2}>12. Cookies</h2>
      <p style={p}>
        We use essential cookies for authentication and security. See our{' '}
        <Link href="/legal/cookies" style={link}>Cookie Policy</Link> for details.
      </p>

      <h2 className="display" style={h2}>13. Changes to this policy</h2>
      <p style={p}>
        We may update this Privacy Policy. If we make material changes, we will take reasonable steps to notify
        you and, where required, seek fresh consent.
      </p>
    </>
  );
}
