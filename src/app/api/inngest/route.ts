import { serve } from 'inngest/next';
import { inngest } from '@/server/pipeline/client';
import { fulfillmentPipeline } from '@/server/pipeline/fulfillment';
import { previewPipeline } from '@/server/pipeline/preview';
import { reconcilePaidBooks } from '@/server/pipeline/reconcile';
import { retentionPurge } from '@/server/pipeline/retention';
import { previewWinback } from '@/server/pipeline/winback';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Generation steps call external AI providers; alpha hosting should allow room
// for slow-but-successful image and PDF stages.
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [previewPipeline, fulfillmentPipeline, reconcilePaidBooks, retentionPurge, previewWinback],
});
