import { randomUUID } from 'node:crypto';
import { requireAdmin } from '@/server/auth';
import { loadEnv } from '@/server/config/env';
import { jsonError } from '@/server/lib/route';
import { removeAssets, signAsset, uploadAsset } from '@/server/lib/storage';
import { serviceClient } from '@/server/lib/supabase';
import { HERO_TOKEN } from '@/server/lib/tokenize';
import { getProviders } from '@/server/providers';
import type { RenderedImage } from '@/server/providers/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

type Check = {
  name: string;
  ok: boolean;
  ms: number;
  details?: Record<string, unknown>;
  error?: string;
};

// ---- GET /api/v1/admin/engine/health — live provider/storage contract check ----
export async function GET(req: Request): Promise<Response> {
  try {
    requireAdmin(req);
    const env = loadEnv();
    const providers = getProviders();
    const checks: Check[] = [];
    let image: RenderedImage | null = null;

    checks.push(await runCheck('supabase_database', async () => {
      const { error } = await serviceClient().from('books').select('id', { count: 'exact', head: true }).limit(1);
      if (error) throw new Error(error.message);
      return {};
    }));

    checks.push(await runCheck('text_generation', async () => {
      const result = await providers.text.generateStory({
        heroToken: HERO_TOKEN,
        ageBand: '5-6',
        readingLevel: 'emerging',
        goal: 'reading_confidence',
        interests: ['stars'],
        pageCount: 2,
        guard: ['EngineKid'],
      });
      return {
        provider: providers.text.name,
        model: result.usage.model,
        pages: result.value.pages.length,
        titlePresent: Boolean(result.value.title),
        tokensIn: result.usage.tokensIn,
        tokensOut: result.usage.tokensOut,
      };
    }));

    checks.push(await runCheck('text_moderation', async () => {
      const result = await providers.moderator.moderateText([
        'A gentle bedtime story about sharing toys and feeling brave at school.',
      ]);
      if (!result.allowed) throw new Error(`Blocked safe text: ${result.reasons.join(', ')}`);
      return { model: providers.moderator.name };
    }));

    checks.push(await runCheck('image_generation', async () => {
      const result = await providers.image.renderPage(
        'A friendly watercolor picture-book scene of a yellow kite in a blue sky. No text, no letters, no logos.',
        {
          images: [],
          palette: ['warm pastel', 'soft cream', 'clear sky blue'],
          clothingTokens: ['simple everyday outfit'],
          negativeConstraints: ['text or letters in the image', 'brand logos', 'scary imagery'],
        },
      );
      image = result.value;
      return {
        provider: providers.image.name,
        model: result.usage.model,
        mime: result.value.mime,
        bytesApprox: Math.round(result.value.base64.length * 0.75),
      };
    }));

    checks.push(await runCheck('image_moderation', async () => {
      if (!image) throw new Error('No generated image available');
      const result = await providers.moderator.moderateImage(image);
      if (!result.allowed) throw new Error(`Blocked generated test image: ${result.reasons.join(', ')}`);
      return { model: providers.moderator.name };
    }));

    checks.push(await runCheck('asset_storage', async () => {
      const storageImage = image ?? { base64: TINY_PNG_BASE64, mime: 'image/png' };
      const ext = storageImage.mime === 'image/jpeg' ? 'jpg' : 'png';
      const key = `_health/engine-${randomUUID()}.${ext}`;
      await uploadAsset(key, Buffer.from(storageImage.base64, 'base64'), storageImage.mime);
      const signedUrl = await signAsset(key, 60);
      await removeAssets([key]);
      if (!signedUrl) throw new Error('Could not create signed URL');
      return { signedUrlCreated: true, removed: true, usedGeneratedImage: Boolean(image) };
    }));

    const ok = checks.every((check) => check.ok);
    return Response.json({
      ok,
      checkedAt: new Date().toISOString(),
      config: {
        modelTier: env.MODEL_TIER,
        textProvider: providers.text.name,
        imageProvider: providers.image.name,
        moderationProvider: providers.moderator.name,
        maxImageAttempts: env.MAX_IMAGE_ATTEMPTS,
      },
      checks,
    }, { status: ok ? 200 : 502 });
  } catch (err) {
    return jsonError(err);
  }
}

async function runCheck(
  name: string,
  fn: () => Promise<Record<string, unknown>>,
): Promise<Check> {
  const started = Date.now();
  try {
    const details = await fn();
    return { name, ok: true, ms: Date.now() - started, details };
  } catch (err) {
    return {
      name,
      ok: false,
      ms: Date.now() - started,
      error: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500),
    };
  }
}
