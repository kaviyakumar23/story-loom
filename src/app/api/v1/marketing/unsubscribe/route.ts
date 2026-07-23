import { audit } from '@/server/lib/audit';
import { serviceClient } from '@/server/lib/supabase';
import { verifyUnsubscribeSignature } from '@/server/lib/marketing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---- GET /api/v1/marketing/unsubscribe?u=<parentId>&t=<token> ----
//
// One-click unsubscribe, clicked straight from an email (RFC 8058), so there is
// no session to authenticate against — the HMAC token proves the link is ours
// and scoped to this parent. Sets marketing_consent = false. Idempotent, and it
// only ever turns consent OFF, so a forged-but-invalid token simply does nothing.
export async function GET(req: Request): Promise<Response> {
  const sp = new URL(req.url).searchParams;
  const parentId = sp.get('u') ?? '';
  const token = sp.get('t') ?? '';

  const ok = parentId && verifyUnsubscribeSignature(parentId, token);
  if (ok) {
    await serviceClient().from('profiles').update({ marketing_consent: false }).eq('id', parentId);
    await audit({ actor: 'parent', action: 'marketing.unsubscribed', entity: 'profiles', entityId: parentId });
  }

  const heading = ok ? 'You’re unsubscribed' : 'This link has expired';
  const message = ok
    ? 'You won’t receive any more MoonBell marketing emails. You’ll still get essential updates about orders you place.'
    : 'We couldn’t verify this unsubscribe link. If you keep getting emails you don’t want, reply to any of them and we’ll take care of it.';

  return new Response(page(heading, message), {
    status: ok ? 200 : 400,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

function page(heading: string, message: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>MoonBell — Email preferences</title></head>
<body style="margin:0;background:#FBEFD6;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#3A2A22;">
  <div style="max-width:480px;margin:0 auto;padding:64px 24px;text-align:center;">
    <div style="font-weight:700;font-size:22px;color:#9C3C6B;margin-bottom:28px;">MoonBell</div>
    <div style="background:#fff;border:2px solid #F0E2CE;border-radius:18px;padding:36px 32px;box-shadow:0 18px 44px rgba(58,42,34,.12);">
      <h1 style="margin:0 0 12px;font-size:24px;line-height:1.2;color:#3A2A22;">${esc(heading)}</h1>
      <p style="margin:0;font-size:15.5px;line-height:1.6;color:#6B5A50;">${esc(message)}</p>
    </div>
  </div>
</body></html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
