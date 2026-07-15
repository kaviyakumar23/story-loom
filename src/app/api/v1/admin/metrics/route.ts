import { requireAdmin } from '@/server/auth';
import { computeMetrics } from '@/server/lib/metrics';
import { jsonError } from '@/server/lib/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---- GET /api/v1/admin/metrics (§12) ----
export async function GET(req: Request): Promise<Response> {
  try {
    requireAdmin(req);
    const windowDays = parseWindowDays(req.url);
    return Response.json(await computeMetrics(windowDays));
  } catch (err) {
    return jsonError(err);
  }
}

function parseWindowDays(url: string): number {
  const raw = new URL(url).searchParams.get('days');
  if (!raw) return 7;
  const days = Number(raw);
  return Number.isFinite(days) && days > 0 && days <= 120 ? Math.floor(days) : 7;
}
