import { z } from 'zod';
import { serviceClient } from './supabase';

/**
 * The funnel, as a closed vocabulary.
 *
 * Two rules, both enforced here rather than trusted to whoever adds the next
 * call site:
 *
 * 1. Only these event names exist. An allowlist means a typo shows up as a
 *    rejected request today rather than as a hole in a report next month.
 * 2. Properties are numbers and enums. There is no string property anywhere in
 *    this schema, so a child's nickname cannot end up in analytics by way of
 *    somebody passing an object through — which is the realistic way that
 *    happens, not malice.
 */
export const FUNNEL_EVENTS = [
  // Landing
  'landing_view',
  'price_seen',
  'cta_click',
  'scroll_depth',
  'engaged_time',
  'sample_view',
  'sample_page',
  'faq_open',
  // Intake
  'preview_start',
  'intake_step',
  'intake_error',
  'email_captured',
  'consent_given',
  'preview_complete',
  'preview_failed',
  // Checkout
  'pincode_check',
  'checkout_open',
  'payment_initiated',
  'payment_failed',
  'payment_dismissed',
  // Server-written, after the fact
  'purchase',
  'correction_requested',
  'released_to_print',
  'shipped',
  'delivered',
  'refunded',
] as const;
export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

/**
 * Every property this system will ever record. Closed by design: adding a
 * dimension is a deliberate edit here, which is the moment to ask whether it
 * describes behaviour or describes a person.
 */
export const funnelPropsSchema = z
  .object({
    /** Percent of the page scrolled, bucketed by the client to 25/50/75/100. */
    depth: z.number().int().min(0).max(100).optional(),
    /** Seconds of active engagement, bucketed. */
    seconds: z.number().int().min(0).max(3600).optional(),
    /** Which step of the intake form (1-3). */
    step: z.number().int().min(1).max(5).optional(),
    /** Which page of the sample carousel. */
    page: z.number().int().min(0).max(50).optional(),
    /** Which named control was clicked — an enum, never free text. */
    target: z.enum(['hero', 'header', 'sticky', 'pricing', 'sample', 'final', 'product']).optional(),
    /** Whether a check succeeded. Used for pincode and payment outcomes. */
    ok: z.boolean().optional(),
    /** A machine-readable reason, from our own error codes. */
    reason: z.string().trim().max(40).regex(/^[a-z0-9_]+$/, 'reason must be a code, not prose').optional(),
    /** Order value in paise, on server-written commercial events. */
    amount: z.number().int().min(0).optional(),
  })
  .strict();

export type FunnelProps = z.infer<typeof funnelPropsSchema>;

export const funnelEventSchema = z.object({
  event: z.enum(FUNNEL_EVENTS),
  path: z.string().trim().max(120).optional(),
  props: funnelPropsSchema.optional(),
});

export interface RecordOptions {
  sessionId?: string | null;
  arm?: 'A' | 'B' | null;
  path?: string | null;
  props?: FunnelProps;
  orderId?: string | null;
  bookId?: string | null;
}

/**
 * Record an event. Never throws: losing a measurement is an acceptable outcome,
 * failing a checkout because a metric could not be written is not.
 */
export async function recordFunnel(event: FunnelEvent, opts: RecordOptions = {}): Promise<void> {
  try {
    await serviceClient().from('funnel_events').insert({
      session_id: opts.sessionId ?? null,
      arm: opts.arm ?? null,
      event,
      path: opts.path ?? null,
      props: opts.props ?? {},
      order_id: opts.orderId ?? null,
      book_id: opts.bookId ?? null,
    });
  } catch (err) {
    console.error('[funnel] could not record', event, err instanceof Error ? err.message : err);
  }
}
