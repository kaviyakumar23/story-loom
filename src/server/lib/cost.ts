import { serviceClient } from './supabase';

/**
 * Cost tracking + per-stage telemetry (§12). Every model call is logged to
 * generation_events with token/image counts and a computed USD cost. This powers
 * the cost-per-book metric and the "average attempts per image" alarm (the
 * retry-inflation failure mode in §6).
 */

type Stage = 'intake' | 'story' | 'safety' | 'images' | 'assemble' | 'fulfillment';

// Indicative unit prices (USD). Keep aligned with the validated ranges in §15;
// re-confirm at build time. Text priced per 1M tokens; images per image.
const TEXT_PRICE_PER_MTOK: Record<string, { in: number; out: number }> = {
  'gpt-4o': { in: 2.5, out: 10 },
  'gpt-4o-mini': { in: 0.15, out: 0.6 },
  'gemini-2.5-flash': { in: 0.3, out: 2.5 },
};
// Note: OpenAI's moderation endpoint (omni-moderation-latest) is free — no entry.
const IMAGE_PRICE: Record<string, number> = {
  'gemini-2.5-flash-image': 0.039,
  'gemini-3-pro-image': 0.134,
  'gemini-3-pro-image-preview': 0.134,
};

export function textCost(model: string, tokensIn: number, tokensOut: number): number {
  const p = TEXT_PRICE_PER_MTOK[model] ?? { in: 0, out: 0 };
  return (tokensIn / 1_000_000) * p.in + (tokensOut / 1_000_000) * p.out;
}

export function imageCost(model: string, images: number): number {
  return (IMAGE_PRICE[model] ?? 0) * images;
}

export interface EventInput {
  bookId: string;
  stage: Stage;
  attempt?: number;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  images?: number;
  costUsd?: number;
  status: 'ok' | 'retried' | 'failed';
  startedAt?: string;
}

export async function recordEvent(e: EventInput): Promise<void> {
  const { error } = await serviceClient().from('generation_events').insert({
    book_id: e.bookId,
    stage: e.stage,
    attempt: e.attempt ?? 1,
    model: e.model ?? null,
    tokens_in: e.tokensIn ?? null,
    tokens_out: e.tokensOut ?? null,
    images: e.images ?? null,
    cost_usd: e.costUsd ?? null,
    status: e.status,
    started_at: e.startedAt ?? null,
    finished_at: new Date().toISOString(),
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.error('generation_events insert failed', { stage: e.stage, error: error.message });
  }
}
