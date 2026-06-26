import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Content & Acceptable Use Policy — Plumtale' };

const h1: React.CSSProperties = { fontSize: 34, marginBottom: 6, lineHeight: 1.1 };
const meta: React.CSSProperties = { fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 28 };
const h2: React.CSSProperties = { fontSize: 22, margin: '34px 0 10px', lineHeight: 1.2 };
const p: React.CSSProperties = { margin: '0 0 14px' };
const ul: React.CSSProperties = { margin: '0 0 14px', paddingLeft: 22 };
const li: React.CSSProperties = { margin: '0 0 7px' };
const link: React.CSSProperties = { color: 'var(--brand)', fontWeight: 600 };

export default function ContentPolicy() {
  return (
    <>
      <h1 className="display" style={h1}>Content &amp; Acceptable Use Policy</h1>
      <p style={meta}>Effective date: [PLACEHOLDER: effective date] · [PLACEHOLDER: legal/business name].</p>

      <p style={p}>
        Plumtale makes warm, age-appropriate stories for children. To keep it safe, every request is checked by
        automated safety moderation across three gates, and content that is harmful or disallowed is blocked and
        may be routed to human review. This policy describes what is not allowed.
      </p>

      <h2 className="display" style={h2}>Prohibited requests</h2>
      <p style={p}>You may not use Plumtale to create or request any of the following:</p>
      <ul style={ul}>
        <li style={li}>Any sexual content involving minors, or any sexualization of children — strictly prohibited and reported where required by law.</li>
        <li style={li}>Abuse, exploitation, self-harm, or graphic violence involving children.</li>
        <li style={li}>Hate, harassment, bullying, or demeaning content targeting any person or group.</li>
        <li style={li}>Impersonation of, or content depicting, real people, celebrities, or public figures without authorization.</li>
        <li style={li}>Political propaganda, campaigning, or messaging that uses children to promote a cause.</li>
        <li style={li}>Non-consensual content, or content that uses another real person&apos;s identity or likeness.</li>
        <li style={li}>Illegal, defamatory, or infringing content, including material that violates someone else&apos;s intellectual property.</li>
        <li style={li}>Medical, legal, financial, or other professional claims or advice presented as fact within a story.</li>
      </ul>

      <h2 className="display" style={h2}>Moderation and enforcement</h2>
      <p style={p}>
        Requests are moderated automatically and may be rejected before or during generation. Borderline cases
        may be sent for human review. We may decline a request without generating a book, and we may suspend or
        terminate accounts that attempt to misuse the service or evade these rules.
      </p>

      <h2 className="display" style={h2}>Reporting a concern</h2>
      <p style={p}>
        If you believe content on Plumtale violates this policy, please contact us through our{' '}
        <Link href="/legal/contact" style={link}>Contact &amp; Grievance Redressal</Link> page. This policy
        works alongside our{' '}
        <Link href="/legal/terms" style={link}>Terms of Service</Link>.
      </p>
    </>
  );
}
