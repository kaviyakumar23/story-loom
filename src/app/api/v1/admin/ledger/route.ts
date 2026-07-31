import { requireAdmin } from '@/server/auth';
import { jsonError } from '@/server/lib/route';
import { serviceClient } from '@/server/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The per-order ledger: did this book make money?
 *
 * The AI cost of a book has always been tracked. What was never captured is
 * everything that decides whether a PRINTED order was worth doing — printing,
 * packing, postage, the payment fee, the reprint when it arrives damaged, and
 * the founder's own time, which is the cost most easily pretended to be zero.
 * Without those, "contribution per order" is a number that flatters itself.
 *
 * Deliberately no parent id and no free text from a customer. The old metrics
 * CSV carried both, which made an operational export into a personal-data
 * export nobody had asked for.
 */
export async function GET(req: Request): Promise<Response> {
  try {
    requireAdmin(req);
    const url = new URL(req.url);
    const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days') ?? 90)));
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const db = serviceClient();

    const { data: orderRows } = await db
      .from('orders')
      .select('id, book_id, tier, amount, currency, status, price_arm, metro, created_at, paid_at')
      .gte('created_at', since)
      .order('created_at', { ascending: true });
    const orders = (orderRows ?? []) as OrderRow[];
    if (!orders.length) return respond([], url);

    const ids = orders.map((o) => o.id);
    const bookIds = orders.map((o) => o.book_id).filter((b): b is string => Boolean(b));

    const [{ data: costRows }, { data: eventRows }, { data: genRows }, { data: fulfilRows }, { data: releaseRows }] =
      await Promise.all([
        db.from('order_costs').select('order_id, kind, amount_paise, minutes').in('order_id', ids),
        db.from('order_events').select('order_id, type, created_at').in('order_id', ids),
        db.from('generation_events').select('book_id, cost_usd').in('book_id', bookIds.length ? bookIds : ['__none__']),
        db
          .from('fulfillments')
          .select('order_id, status, open_exception, printed_at, shipped_at, delivered_at')
          .in('order_id', ids),
        db.from('print_releases').select('order_id, released_at').in('order_id', ids),
      ]);

    const costs = groupBy((costRows ?? []) as CostRow[], (c) => c.order_id);
    const events = groupBy((eventRows ?? []) as EventRow[], (e) => e.order_id);
    const gen = groupBy((genRows ?? []) as GenRow[], (g) => g.book_id ?? '');
    const fulfilments = new Map(((fulfilRows ?? []) as FulfilRow[]).map((f) => [f.order_id, f]));
    const releases = new Map(((releaseRows ?? []) as ReleaseRow[]).map((r) => [r.order_id, r]));

    const rows = orders.map((o) => {
      const c = costs.get(o.id) ?? [];
      const sum = (kind: string) => c.filter((x) => x.kind === kind).reduce((t, x) => t + (x.amount_paise ?? 0), 0);
      const minutes = c.filter((x) => x.kind === 'labour_minutes').reduce((t, x) => t + (x.minutes ?? 0), 0);
      const aiUsd = (gen.get(o.book_id ?? '') ?? []).reduce((t, g) => t + Number(g.cost_usd ?? 0), 0);
      const f = fulfilments.get(o.id);
      const ev = events.get(o.id) ?? [];

      const captured = o.status === 'paid' ? o.amount : 0;
      const refunded = o.status === 'refunded' ? o.amount : 0;
      const physicalCost = sum('print') + sum('pack') + sum('ship') + sum('other');
      const paymentFee = sum('payment_fee');
      // Founder time at a real rate. Counting it as free is how a beta concludes
      // that a business works when it does not.
      const labourPaise = minutes * LABOUR_PAISE_PER_MINUTE;
      const aiPaise = Math.round(aiUsd * USD_TO_PAISE);

      return {
        orderId: o.id,
        createdAt: o.created_at,
        paidAt: o.paid_at,
        status: o.status,
        tier: o.tier,
        priceArm: o.price_arm ?? '',
        metro: o.metro ?? '',
        capturedPaise: captured,
        refundedPaise: refunded,
        aiPaise,
        printPaise: sum('print'),
        packPaise: sum('pack'),
        shipPaise: sum('ship'),
        paymentFeePaise: paymentFee,
        labourMinutes: minutes,
        labourPaise,
        contributionPaise: captured - refunded - aiPaise - physicalCost - paymentFee - labourPaise,
        fulfillmentStatus: f?.status ?? '',
        openException: f?.open_exception ?? '',
        releasedAt: releases.get(o.id)?.released_at ?? '',
        printedAt: f?.printed_at ?? '',
        shippedAt: f?.shipped_at ?? '',
        deliveredAt: f?.delivered_at ?? '',
        exceptions: ev.filter((e) => EXCEPTION_TYPES.has(e.type)).map((e) => e.type).join('|'),
      };
    });

    return respond(rows, url);
  } catch (err) {
    return jsonError(err);
  }
}

/** Founder time, valued at the plan's floor rate rather than at zero. */
const LABOUR_PAISE_PER_MINUTE = 500; // ₹300/hour
const USD_TO_PAISE = 8500; // indicative; the ledger is for direction, not filing
const EXCEPTION_TYPES = new Set(['reprint', 'reship', 'rto', 'lost', 'refund']);

interface OrderRow {
  id: string;
  book_id: string | null;
  tier: string;
  amount: number;
  currency: string;
  status: string;
  price_arm: string | null;
  metro: string | null;
  created_at: string;
  paid_at: string | null;
}
interface CostRow { order_id: string; kind: string; amount_paise: number | null; minutes: number | null }
interface EventRow { order_id: string; type: string; created_at: string }
interface GenRow { book_id: string | null; cost_usd: number | string | null }
interface FulfilRow {
  order_id: string;
  status: string;
  open_exception: string | null;
  printed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
}
interface ReleaseRow { order_id: string; released_at: string }

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = out.get(k);
    if (list) list.push(row);
    else out.set(k, [row]);
  }
  return out;
}

function respond(rows: Record<string, unknown>[], url: URL): Response {
  if (url.searchParams.get('format') !== 'csv') return Response.json({ orders: rows });
  if (!rows.length) return new Response('', { headers: csvHeaders() });
  const cols = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = [cols.join(','), ...rows.map((r) => cols.map((c) => escape(r[c])).join(','))].join('\n');
  return new Response(body, { headers: csvHeaders() });
}

function csvHeaders(): HeadersInit {
  return {
    'content-type': 'text/csv; charset=utf-8',
    'content-disposition': 'attachment; filename="moonbell-ledger.csv"',
  };
}
