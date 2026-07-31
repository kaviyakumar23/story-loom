import { Resend } from 'resend';
import { loadEnv } from '../config/env';
import { COLORS, FONTS, GOOGLE_FONTS_HREF, RADIUS, sparkleSvg } from './brand';

/**
 * Transactional email (§3, §6 step 12), styled to the MoonBell design system
 * (lib/brand.ts) — warm cream paper, Baloo 2 display, coral sticker button,
 * plum footer, the four-point sparkle wordmark. Matches the app + PDF so the
 * "your book is ready" moment feels like the same product.
 */

let _client: Resend | null = null;

function client(): Resend {
  if (_client) return _client;
  const key = loadEnv().RESEND_API_KEY;
  if (!key) throw new Error('Resend is not configured');
  _client = new Resend(key);
  return _client;
}

async function send(
  to: string,
  subject: string,
  html: string,
  opts?: { listUnsubscribe?: string },
): Promise<void> {
  const env = loadEnv();
  // RFC 8058 one-click unsubscribe headers — only set for marketing email.
  const headers = opts?.listUnsubscribe
    ? { 'List-Unsubscribe': `<${opts.listUnsubscribe}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
    : undefined;
  const { error } = await client().emails.send({ from: env.EMAIL_FROM, to, subject, html, headers });
  if (error) throw new Error(`Email send failed: ${error.message}`);
}

/**
 * Best-effort add to the Resend newsletter audience. No-ops unless both the API
 * key and RESEND_AUDIENCE_ID are set — the DB row is the source of truth either
 * way, so callers can ignore failures.
 */
export async function addNewsletterContact(email: string): Promise<void> {
  const env = loadEnv();
  if (!env.RESEND_API_KEY || !env.RESEND_AUDIENCE_ID) return;
  await client().contacts.create({ email, audienceId: env.RESEND_AUDIENCE_ID, unsubscribed: false });
}

export interface OrderReceipt {
  orderId: string;
  /** Smallest currency unit (paise for INR), as stored on the order. */
  amount: number;
  currency: string;
}

export async function sendOrderReceived(to: string, tier: string, receipt: OrderReceipt): Promise<void> {
  await send(
    to,
    'We received your order — your storybook is on its way',
    layout({
      eyebrow: 'Order confirmed',
      heading: 'Your storybook is being woven',
      body: `<p style="margin:0 0 14px">Thank you! We've received your
               <strong style="color:${COLORS.ink}">${escapeHtml(prettyTier(tier))}</strong> order.</p>
             <p style="margin:0 0 14px;font-size:14px;color:${COLORS.inkSoft};">
               Order <strong style="color:${COLORS.ink}">${escapeHtml(receipt.orderId)}</strong>
               · Amount paid: <strong style="color:${COLORS.ink}">${escapeHtml(formatAmount(receipt.amount, receipt.currency))}</strong></p>
             <p style="margin:0">Our little workshop is personalising every page right now.
               We'll email you the moment it's ready to read — usually within a few minutes.
               Keep this email as your payment receipt.</p>`,
    }),
  );
}

/**
 * Operational alert to ALERT_EMAIL (amount mismatches, cost overruns…).
 * Silently no-ops when alerting or Resend isn't configured — callers must
 * never fail because an alert couldn't be sent.
 */
export async function sendAdminAlert(subject: string, context?: Record<string, unknown>): Promise<void> {
  const env = loadEnv();
  if (!env.ALERT_EMAIL || !env.RESEND_API_KEY) return;
  const details = context
    ? `<pre style="margin:12px 0 0;padding:12px;background:${COLORS.bg2};border-radius:8px;font-size:12.5px;white-space:pre-wrap;">${escapeHtml(JSON.stringify(context, null, 2))}</pre>`
    : '';
  await send(
    env.ALERT_EMAIL,
    `[MoonBell alert] ${subject}`,
    layout({
      eyebrow: 'Ops alert',
      heading: subject,
      body: `<p style="margin:0">Triggered at ${escapeHtml(new Date().toISOString())}.</p>${details}`,
    }),
  );
}

export async function sendBookReady(to: string, dashboardUrl: string): Promise<void> {
  await send(
    to,
    'Your storybook is ready! ✨',
    layout({
      eyebrow: 'It’s ready',
      heading: 'Time for a story',
      body: `<p style="margin:0">Your personalized storybook has been lovingly assembled
               and is waiting for you to read together.</p>`,
      cta: { label: 'Open your storybook', url: dashboardUrl },
    }),
  );
}

/**
 * Physical order: the book is written and now waiting on a person.
 *
 * No longer promises a digital copy to read "right now" — the hardcover is the
 * whole product, and the honest thing to describe is the wait and what is
 * happening during it.
 */
export async function sendPrintReady(to: string, dashboardUrl: string): Promise<void> {
  await send(
    to,
    'Your storybook is written — now we check it 📖',
    layout({
      eyebrow: 'In the workshop',
      heading: 'Your storybook is written',
      body: `<p style="margin:0 0 14px">Every page of
               <strong style="color:${COLORS.ink}">your child's book</strong> is finished. Before it
               prints, one of us reads it end to end — the spelling of their name, the pictures, the
               order of the pages.</p>
             <p style="margin:0">Once it passes, it goes to the printer and is dispatched within 7
               working days. We'll email you tracking the moment it's on its way.</p>`,
      cta: { label: 'Follow your order', url: dashboardUrl },
    }),
  );
}

/**
 * Win-back: an unpurchased preview that's still within the retention window.
 * This is promotional, so it carries a one-click unsubscribe link/header and is
 * only ever sent to a parent who has opted in (see canSendMarketing).
 */
export async function sendPreviewWinback(
  to: string,
  dashboardUrl: string,
  unsubscribeUrl: string,
): Promise<void> {
  await send(
    to,
    'Your storybook preview is still waiting ✨',
    layout({
      eyebrow: 'Still here for you',
      heading: 'Your preview is waiting',
      body: `<p style="margin:0 0 14px">You started a MoonBell story but haven't finished — it's still
               here, with your child as the hero.</p>
             <p style="margin:0">Come back to read the full story and turn it into a printed keepsake.
               Your free preview won't be around forever.</p>`,
      cta: { label: 'See your preview', url: dashboardUrl },
      unsubscribeUrl,
    }),
    { listUnsubscribe: unsubscribeUrl },
  );
}

/**
 * Occasion / birthday reminder to a past buyer (marketing — carries unsubscribe).
 * Deep-links to a prefilled create flow so the reorder is near-effortless.
 */
export async function sendOccasionNudge(
  to: string,
  opts: { heroName: string; occasion: string; isBirthday: boolean; isSibling?: boolean; url: string; unsubscribeUrl: string },
): Promise<void> {
  const { heroName, occasion, isBirthday, isSibling, url, unsubscribeUrl } = opts;

  let subject: string;
  let eyebrow: string;
  let heading: string;
  let body: string;
  let cta: string;

  if (isSibling) {
    subject = `Does ${heroName} have a brother or sister? ✨`;
    eyebrow = 'A story for two';
    heading = 'One more little hero?';
    body = `<p style="margin:0 0 14px">${escapeHtml(heroName)} loved being the star of their own book. If there’s a brother or
              sister, they can have one all their own — same care, their own adventure.</p>
            <p style="margin:0">Start a new hero below.</p>`;
    cta = 'Make their book';
  } else if (isBirthday) {
    subject = `${heroName}’s birthday is coming ✨`;
    eyebrow = 'Birthday soon';
    heading = `${heroName}’s big day is coming`;
    body = `<p style="margin:0 0 14px">${escapeHtml(heroName)}’s birthday month is nearly here. A personalised MoonBell hardcover
              makes a keepsake they’ll remember — and printed books take about a week, so there’s just enough time.</p>
            <p style="margin:0">Start their next adventure below.</p>`;
    cta = 'Start their story';
  } else {
    subject = `A ${occasion} story for ${heroName} ✨`;
    eyebrow = occasion;
    heading = `A story for ${occasion}`;
    body = `<p style="margin:0 0 14px">${escapeHtml(occasion)} is around the corner. Turn it into a personalised storybook starring
              <strong style="color:${COLORS.ink}">${escapeHtml(heroName)}</strong> — printed and shipped in about a week.</p>
            <p style="margin:0">Pick up where you left off below.</p>`;
    cta = 'Start their story';
  }

  await send(to, subject, layout({ eyebrow, heading, body, cta: { label: cta, url }, unsubscribeUrl }), {
    listUnsubscribe: unsubscribeUrl,
  });
}

/** Physical order: the printed book has been dispatched. */
export async function sendShipped(
  to: string,
  opts: { dashboardUrl: string; carrier?: string | null; trackingNumber?: string | null },
): Promise<void> {
  const track = opts.trackingNumber
    ? `<p style="margin:0 0 14px;font-size:14px;color:${COLORS.inkSoft};">Carrier:
         <strong style="color:${COLORS.ink}">${escapeHtml(opts.carrier ?? '—')}</strong> · Tracking:
         <strong style="color:${COLORS.ink}">${escapeHtml(opts.trackingNumber)}</strong></p>`
    : '';
  await send(
    to,
    'Your printed storybook has shipped! 🚚',
    layout({
      eyebrow: 'On its way',
      heading: 'Your book is shipping',
      body: `<p style="margin:0 0 14px">Great news — your printed storybook is on its way to you.</p>
             ${track}<p style="margin:0">Thank you for creating with MoonBell.</p>`,
      cta: { label: 'View your order', url: opts.dashboardUrl },
    }),
  );
}

/**
 * The book arrived.
 *
 * Sent because the courier's "delivered" scan is not the same as a parent
 * knowing, and because this is the moment to ask how it went while the book is
 * in their hands rather than a week later.
 */
export async function sendDelivered(to: string, opts: { dashboardUrl: string }): Promise<void> {
  await send(
    to,
    'Your storybook has arrived 📦',
    layout({
      eyebrow: 'Delivered',
      heading: 'It’s there!',
      body: `<p style="margin:0 0 14px">Your printed storybook has been delivered. We hope the first
             reading is a good one.</p>
             <p style="margin:0 0 14px">If anything about it isn’t right — damage in the post, a
             printing fault, a detail we got wrong — just reply to this email and we’ll reprint it.</p>
             <p style="margin:0">And if you have two minutes to tell us what your child made of it,
             we read every reply ourselves.</p>`,
      cta: { label: 'View your order', url: opts.dashboardUrl },
    }),
  );
}

/**
 * A refund has been issued.
 *
 * There was no refund email at all, from either the admin route or the webhook,
 * which meant the only way a customer learned their money was coming back was
 * by checking their bank. Saying so — and saying how long it takes — is the
 * difference between a refund and a support ticket.
 */
export async function sendRefundConfirmation(
  to: string,
  opts: { orderId: string; amount: number; currency: string; reason?: string | null },
): Promise<void> {
  const reason = opts.reason
    ? `<p style="margin:0 0 14px;font-size:14px;color:${COLORS.inkSoft};">${escapeHtml(opts.reason)}</p>`
    : '';
  await send(
    to,
    'Your MoonBell refund is on its way',
    layout({
      eyebrow: 'Refunded',
      heading: 'We’ve refunded your order',
      body: `<p style="margin:0 0 14px">We’ve refunded
             <strong>${formatAmount(opts.amount, opts.currency)}</strong> for order
             <strong>${escapeHtml(opts.orderId.slice(0, 8))}</strong>.</p>
             ${reason}
             <p style="margin:0 0 14px">Refunds go back to the card or account you paid from. Your
             bank usually takes 5–7 working days to show it — that part is out of our hands.</p>
             <p style="margin:0">If it hasn’t appeared after that, reply to this email and we’ll
             chase it with you.</p>`,
    }),
  );
}

/**
 * An order was cancelled before it went to print.
 *
 * Distinct from a refund email because the two are not always the same event —
 * a book can be cancelled during QC before any money moves back, and silence at
 * that point reads as a book that is simply never coming.
 */
export async function sendCancellation(
  to: string,
  opts: { orderId: string; refunded: boolean; amount?: number; currency?: string },
): Promise<void> {
  const money = opts.refunded && opts.amount
    ? `<p style="margin:0 0 14px">We've refunded
       <strong>${formatAmount(opts.amount, opts.currency ?? 'INR')}</strong> in full. Your bank
       usually takes 5–7 working days to show it.</p>`
    : '<p style="margin:0 0 14px">You have not been charged.</p>';
  await send(
    to,
    'Your MoonBell order has been cancelled',
    layout({
      eyebrow: 'Cancelled',
      heading: 'We’ve cancelled your order',
      body: `<p style="margin:0 0 14px">Order <strong>${escapeHtml(opts.orderId.slice(0, 8))}</strong>
             has been cancelled and will not be printed.</p>
             ${money}
             <p style="margin:0">If this is a surprise, reply to this email — we would rather sort it
             out than leave you wondering.</p>`,
    }),
  );
}

interface LayoutOpts {
  eyebrow: string;
  heading: string;
  body: string;
  cta?: { label: string; url: string };
  /** When set (marketing email only), renders an unsubscribe line in the footer. */
  unsubscribeUrl?: string;
}

function layout({ eyebrow, heading, body, cta, unsubscribeUrl }: LayoutOpts): string {
  const button = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 4px">
         <tr><td style="border-radius:${RADIUS.pill};background:${COLORS.coral};
                        box-shadow:0 5px 0 ${COLORS.coralDeep};">
           <a href="${escapeAttr(cta.url)}"
              style="display:inline-block;padding:15px 30px;font-family:${FONTS.display};
                     font-weight:700;font-size:16.5px;color:#FFFFFF;text-decoration:none;">
             ${escapeHtml(cta.label)}</a>
         </td></tr>
       </table>`
    : '';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link rel="stylesheet" href="${GOOGLE_FONTS_HREF}" />
</head>
<body style="margin:0;padding:32px 0;background:${COLORS.bg};font-family:${FONTS.sans};color:${COLORS.ink};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">

      <!-- wordmark -->
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:16px">
        <tr>
          <td style="padding-right:8px">${sparkleSvg(20, COLORS.berry)}</td>
          <td style="font-family:${FONTS.display};font-weight:700;font-size:23px;color:${COLORS.berry};">MoonBell</td>
        </tr>
      </table>

      <!-- card -->
      <table role="presentation" width="520" cellpadding="0" cellspacing="0"
             style="background:${COLORS.surface};border-radius:${RADIUS.card};overflow:hidden;
                    border:2px solid ${COLORS.hairline};box-shadow:0 18px 44px rgba(58,42,34,.14);max-width:520px;">
        <tr><td style="background:${COLORS.coral};height:6px;"></td></tr>
        <tr><td style="padding:38px 44px;">
          <div style="font-family:${FONTS.display};font-weight:700;font-size:13px;letter-spacing:.04em;
                      text-transform:uppercase;color:${COLORS.teal};margin-bottom:10px;">${escapeHtml(eyebrow)}</div>
          <h1 style="margin:0 0 16px;font-family:${FONTS.display};font-weight:700;font-size:30px;
                     line-height:1.1;color:${COLORS.ink};">${escapeHtml(heading)}</h1>
          <div style="font-size:16px;line-height:1.6;color:${COLORS.inkSoft};">${body}</div>
          ${button}
        </td></tr>
        <!-- trust line (privacy posture, §9) -->
        <tr><td style="padding:16px 44px;border-top:2px solid ${COLORS.hairline};background:${COLORS.bg2};
                       font-size:12.5px;color:${COLORS.inkSoft};line-height:1.5;">
          🔒 Your child’s details are auto-deleted on request · <strong style="color:${COLORS.ink}">never used to train AI</strong>
        </td></tr>
      </table>

      <!-- footer -->
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;margin-top:18px">
        <tr><td style="font-family:${FONTS.sans};font-size:11.5px;color:${COLORS.inkSoft};line-height:1.6;padding:0 8px;">
          You’re receiving this because you created a storybook with MoonBell.<br/>
          © 2026 MoonBell · Made with care.${
            unsubscribeUrl
              ? `<br/><a href="${escapeAttr(unsubscribeUrl)}" style="color:${COLORS.inkSoft};text-decoration:underline;">Unsubscribe from marketing emails</a>`
              : ''
          }
        </td></tr>
      </table>

    </td></tr>
  </table>
</body></html>`;
}

function formatAmount(amount: number, currency: string): string {
  const major = amount / 100;
  const rendered = Number.isInteger(major) ? String(major) : major.toFixed(2);
  return currency === 'INR' ? `₹${rendered}` : `${rendered} ${currency}`;
}

function prettyTier(tier: string): string {
  return (
    {
      print: 'Printed hardcover',
      pdf: 'Digital PDF',
      pdf_audio_guide: 'PDF + Audio & Guide',
      seven_day_pack: '7-Day Story Pack',
    }[tier] ?? tier
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;');
}
