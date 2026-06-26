import { requireAdmin } from '@/server/auth';
import { jsonError } from '@/server/lib/route';
import { serviceClient } from '@/server/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---- GET /api/v1/admin/review-queue — failed/blocked books (§10) ----
export async function GET(req: Request): Promise<Response> {
  try {
    requireAdmin(req);
    const { data } = await serviceClient()
      .from('books')
      .select('id, parent_id, status, error, created_at, updated_at')
      .eq('status', 'failed')
      .order('updated_at', { ascending: false })
      .limit(200);
    return Response.json({ books: data ?? [] });
  } catch (err) {
    return jsonError(err);
  }
}
