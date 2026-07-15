import { requireAdmin } from '@/server/auth';
import { buildAlphaMetricsCsv } from '@/server/lib/metrics';
import { jsonError } from '@/server/lib/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---- GET /api/v1/admin/metrics/export — CSV for internal alpha review ----
export async function GET(req: Request): Promise<Response> {
  try {
    requireAdmin(req);
    const windowDays = parseWindowDays(req.url);
    const csv = await buildAlphaMetricsCsv(windowDays);
    return new Response(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="storyloom-alpha-metrics-${windowDays}d.csv"`,
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}

function parseWindowDays(url: string): number {
  const raw = new URL(url).searchParams.get('days');
  if (!raw) return 30;
  const days = Number(raw);
  return Number.isFinite(days) && days > 0 && days <= 120 ? Math.floor(days) : 30;
}
