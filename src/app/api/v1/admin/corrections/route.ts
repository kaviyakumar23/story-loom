import { requireAdmin } from '@/server/auth';
import { jsonError } from '@/server/lib/route';
import { serviceClient } from '@/server/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---- GET /api/v1/admin/corrections — the founder's correction queue ----
//
// A parent gets one correction per book, and it waits here until a human reads
// it. Oldest first: the queue is a promise about turnaround, so the thing that
// has been waiting longest is the thing to do next.
export async function GET(req: Request): Promise<Response> {
  try {
    requireAdmin(req);
    const db = serviceClient();

    const { data } = await db
      .from('book_revision_requests')
      .select('id, book_id, instruction, status, created_at, reviewed_at, review_note')
      .eq('status', 'pending_review')
      .order('created_at', { ascending: true })
      .limit(200);
    const rows = (data ?? []) as {
      id: string;
      book_id: string;
      instruction: string;
      status: string;
      created_at: string;
      reviewed_at: string | null;
      review_note: string | null;
    }[];
    if (!rows.length) return Response.json({ corrections: [] });

    // Titles make the queue readable; a bare book id tells the founder nothing.
    const { data: books } = await db
      .from('books')
      .select('id, title, status, reading_level, goal')
      .in('id', rows.map((r) => r.book_id));
    const byId = new Map(
      ((books ?? []) as { id: string; title: string | null; status: string; reading_level: string; goal: string }[]).map((b) => [b.id, b]),
    );

    return Response.json({
      corrections: rows.map((r) => {
        const book = byId.get(r.book_id);
        return {
          id: r.id,
          bookId: r.book_id,
          bookTitle: book?.title ?? null,
          bookStatus: book?.status ?? null,
          goal: book?.goal ?? null,
          readingLevel: book?.reading_level ?? null,
          instruction: r.instruction,
          requestedAt: r.created_at,
        };
      }),
    });
  } catch (err) {
    return jsonError(err);
  }
}
