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

async function send(to: string, subject: string, html: string): Promise<void> {
  const env = loadEnv();
  const { error } = await client().emails.send({ from: env.EMAIL_FROM, to, subject, html });
  if (error) throw new Error(`Email send failed: ${error.message}`);
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

/** Physical order: the digital copy is ready now; the printed book is being made. */
export async function sendPrintReady(to: string, dashboardUrl: string): Promise<void> {
  await send(
    to,
    'Your book is ready — printed copy on its way 📖',
    layout({
      eyebrow: 'All set',
      heading: 'Your storybook is ready',
      body: `<p style="margin:0 0 14px">Your digital copy is ready to read right now.</p>
             <p style="margin:0">Your <strong style="color:${COLORS.ink}">printed hardcover</strong> is being made
               with care, and will be printed and shipped within about 7 days. We'll email you a tracking
               link the moment it's on the way.</p>`,
      cta: { label: 'Read your digital copy', url: dashboardUrl },
    }),
  );
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

interface LayoutOpts {
  eyebrow: string;
  heading: string;
  body: string;
  cta?: { label: string; url: string };
}

function layout({ eyebrow, heading, body, cta }: LayoutOpts): string {
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
          © 2026 MoonBell · Made with care.
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
