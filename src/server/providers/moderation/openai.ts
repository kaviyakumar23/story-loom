import { loadEnv } from '../../config/env';
import { fetchWithTimeout } from '../../lib/http';
import type { ModerationResult, Moderator } from '../types';

/**
 * Independent moderation pass (§10) — OpenAI's purpose-built moderation endpoint
 * (`omni-moderation-latest`), which classifies both text and images. It is a
 * dedicated safety classifier, distinct from the story-generation model, so the
 * "independent of the generation provider" property holds. Free to call.
 *
 * A flagged result blocks; the pipeline routes blocked content to human review
 * and never auto-delivers. When uncertain (e.g. the API errors), we BLOCK —
 * never trade child safety for availability.
 */
const MODEL = 'omni-moderation-latest';
const ENDPOINT = 'https://api.openai.com/v1/moderations';

interface ModerationApiResponse {
  results?: { flagged?: boolean; categories?: Record<string, boolean> }[];
}

export class OpenAIModerator implements Moderator {
  readonly name = MODEL;

  async moderateText(texts: string[]): Promise<ModerationResult> {
    return this.call(texts.map((text) => ({ type: 'text', text })));
  }

  async moderateImage(image: { base64: string; mime: string }): Promise<ModerationResult> {
    return this.call([
      { type: 'image_url', image_url: { url: `data:${image.mime};base64,${image.base64}` } },
    ]);
  }

  private async call(input: unknown[]): Promise<ModerationResult> {
    const env = loadEnv();
    let data: ModerationApiResponse;
    try {
      const res = await fetchWithTimeout(
        ENDPOINT,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${env.OPENAI_API_KEY}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ model: MODEL, input }),
        },
        30_000,
      );
      if (!res.ok) throw new Error(`moderation API ${res.status}: ${await res.text()}`);
      data = (await res.json()) as ModerationApiResponse;
    } catch (err) {
      // Fail closed: if we cannot moderate, treat as blocked (§10).
      return {
        allowed: false,
        reasons: ['moderation_unavailable'],
        raw: { error: err instanceof Error ? err.message : String(err) },
      };
    }

    const results = data.results ?? [];
    const flagged = results.filter((r) => r.flagged);
    if (flagged.length === 0) return { allowed: true, reasons: [], raw: data };

    const reasons = [
      ...new Set(
        flagged.flatMap((r) =>
          Object.entries(r.categories ?? {})
            .filter(([, on]) => on)
            .map(([cat]) => cat),
        ),
      ),
    ];
    return { allowed: false, reasons: reasons.length ? reasons : ['flagged'], raw: data };
  }
}
