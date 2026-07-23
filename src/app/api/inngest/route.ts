import { serve } from 'inngest/next';
import { inngest } from '@/server/pipeline/client';
import { applyBookEdit } from '@/server/pipeline/edit';
import { fulfillmentPipeline } from '@/server/pipeline/fulfillment';
import { occasionNudges } from '@/server/pipeline/occasions';
import { photoIntakePurge } from '@/server/pipeline/photo-purge';
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
  functions: [previewPipeline, fulfillmentPipeline, applyBookEdit, reconcilePaidBooks, retentionPurge, previewWinback, occasionNudges, photoIntakePurge],
});
