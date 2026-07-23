import { Inngest } from 'inngest';

/**
 * Durable orchestration client (§13). Each pipeline stage is an Inngest step,
 * giving per-step retries, idempotency keys, and built-in observability.
 *
 * Reads INNGEST_EVENT_KEY directly (not via loadEnv) so importing this module at
 * build time never triggers full env validation.
 */
export const inngest = new Inngest({
  id: 'moonbell',
  eventKey: process.env.INNGEST_EVENT_KEY || undefined,
});

/** Event names. */
export const EVENTS = {
  previewRequested: 'book/preview.requested',
  fulfillmentRequested: 'book/fulfillment.requested',
  editApplied: 'book/edit.applied',
} as const;

export interface PreviewRequested {
  data: { bookId: string; correlationId?: string };
}
export interface FulfillmentRequested {
  data: { bookId: string; correlationId?: string };
}
export interface EditApplied {
  data: { bookId: string; pageIndex: number; mode: 'text' | 'image'; instruction?: string | null };
}
