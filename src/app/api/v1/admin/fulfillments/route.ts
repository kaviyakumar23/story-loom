import { requireAdmin } from '@/server/auth';
import { jsonError } from '@/server/lib/route';
import { signAsset } from '@/server/lib/storage';
import { serviceClient } from '@/server/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface FulfillmentRow {
  id: string;
  book_id: string;
  order_id: string;
  address_id: string | null;
  kind: string;
  status: string;
  carrier: string | null;
  tracking_number: string | null;
  print_master_key: string | null;
  printed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
  notes: string | null;
}

// ---- GET /api/v1/admin/fulfillments — the founder's print+ship queue ----
// ?all=1 includes delivered/cancelled; default shows only open orders.
export async function GET(req: Request): Promise<Response> {
  try {
    requireAdmin(req);
    const includeDone = new URL(req.url).searchParams.get('all') === '1';
    const db = serviceClient();

    let query = db
      .from('fulfillments')
      .select(
        'id, book_id, order_id, address_id, kind, status, carrier, tracking_number, print_master_key, printed_at, shipped_at, delivered_at, created_at, notes',
      )
      .order('created_at', { ascending: true })
      .limit(500);
    if (!includeDone) query = query.in('status', ['print_ready', 'printing', 'shipped']);
    const { data } = await query;
    const rows = (data ?? []) as FulfillmentRow[];

    // Batch-load related records (robust; avoids PostgREST embedding ambiguity).
    const bookIds = [...new Set(rows.map((r) => r.book_id))];
    const orderIds = [...new Set(rows.map((r) => r.order_id))];
    const addrIds = rows.map((r) => r.address_id).filter((x): x is string => Boolean(x));
    const [books, orders, addrs] = await Promise.all([
      bookIds.length ? db.from('books').select('id, title, series_number').in('id', bookIds) : Promise.resolve({ data: [] as { id: string; title: string | null; series_number: number | null }[] }),
      orderIds.length ? db.from('orders').select('id, tier, amount, currency').in('id', orderIds) : Promise.resolve({ data: [] as { id: string; tier: string; amount: number; currency: string }[] }),
      addrIds.length ? db.from('shipping_addresses').select('id, recipient_name, phone, line1, line2, city, state, postal_code, country, notes').in('id', addrIds) : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ]);
    const bookMap = new Map((books.data ?? []).map((b) => [b.id, b]));
    const orderMap = new Map((orders.data ?? []).map((o) => [o.id, o]));
    const addrMap = new Map((addrs.data ?? []).map((a) => [(a as { id: string }).id, a]));

    const fulfillments = await Promise.all(
      rows.map(async (r) => ({
        ...r,
        book: bookMap.get(r.book_id) ?? null,
        order: orderMap.get(r.order_id) ?? null,
        address: r.address_id ? addrMap.get(r.address_id) ?? null : null,
        printMasterUrl: r.print_master_key ? await signAsset(r.print_master_key, 3600) : null,
      })),
    );

    return Response.json({ fulfillments });
  } catch (err) {
    return jsonError(err);
  }
}
