import { serve } from 'inngest/next';
import { inngest } from '@/server/pipeline/client';
import { fulfillmentPipeline } from '@/server/pipeline/fulfillment';
import { previewPipeline } from '@/server/pipeline/preview';
import { reconcilePaidBooks } from '@/server/pipeline/reconcile';
import { retentionPurge } from '@/server/pipeline/retention';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Generation steps (image gen, PDF assembly) can run tens of seconds.
export const maxDuration = 60;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [previewPipeline, fulfillmentPipeline, reconcilePaidBooks, retentionPurge],
});
