import { requireAdmin } from '@/server/auth';
import { computeMetrics } from '@/server/lib/metrics';
import { jsonError } from '@/server/lib/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---- GET /api/v1/admin/metrics (§12) ----
export async function GET(req: Request): Promise<Response> {
  try {
    requireAdmin(req);
    return Response.json(await computeMetrics());
  } catch (err) {
    return jsonError(err);
  }
}
