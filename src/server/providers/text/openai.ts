import { loadEnv } from '../../config/env';
import { fetchWithTimeout } from '../../lib/http';
import { assertNoSensitive } from '../../lib/tokenize';
import { storyJsonSchema, storySystemPrompt, storyUserPrompt } from '../prompts';
import { parseStory } from '../validate';
import type { Story, StoryRequest, TextProvider, TextResult } from '../types';

/**
 * Quality-tier text provider — OpenAI (§3, §7), via the **Responses API**.
 * Structured Outputs (`text.format: json_schema`) force schema-valid story JSON.
 *
 * Reasoning models (gpt-5.6-sol) take `reasoning.effort` and reject
 * `temperature`, so the two are mutually exclusive below — setting
 * `OPENAI_REASONING_EFFORT=off` restores the temperature path for classic
 * models like gpt-4o (which the Responses API also serves).
 */
const DEFAULT_MODEL = 'gpt-5.6-sol';
const ENDPOINT = 'https://api.openai.com/v1/responses';

/** Responses API payload (only the fields we read). */
interface ResponsesReply {
  model?: string;
  status?: string;
  incomplete_details?: { reason?: string };
  error?: { message?: string } | null;
  output?: {
    type?: string;
    content?: { type?: string; text?: string; refusal?: string }[];
  }[];
  usage?: { input_tokens?: number; output_tokens?: number };
}

/**
 * Pull the assistant's JSON text out of the Responses `output` array. The array
 * also carries reasoning items, so we specifically want the message's
 * `output_text` — and we surface a refusal as an error rather than empty text.
 */
function extractOutputText(data: ResponsesReply): string {
  for (const item of data.output ?? []) {
    if (item.type && item.type !== 'message') continue;
    for (const part of item.content ?? []) {
      if (part.refusal) throw new Error(`OpenAI refused the request: ${part.refusal}`);
      if (part.type === 'output_text' && part.text) return part.text;
    }
  }
  return '';
}

export class OpenAITextProvider implements TextProvider {
  readonly name: string;

  constructor(private readonly model = DEFAULT_MODEL) {
    this.name = model;
  }

  async generateStory(req: StoryRequest): Promise<TextResult<Story>> {
    const env = loadEnv();
    if (!env.OPENAI_API_KEY) throw new Error('OpenAI is not configured');
    const system = storySystemPrompt();
    const user = storyUserPrompt(req);

    // Defense in depth: the prompt must never carry the child's real name (§9).
    assertNoSensitive(`${system}\n${user}\n${req.interests.join(' ')}`, req.guard);

    const reasoning = env.OPENAI_REASONING_EFFORT;
    const res = await fetchWithTimeout(
      ENDPOINT,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${env.OPENAI_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          // Reasoning effort and temperature are mutually exclusive.
          ...(reasoning === 'off'
            ? { temperature: env.STORY_TEMPERATURE }
            : { reasoning: { effort: reasoning } }),
          input: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'story',
              strict: true,
              schema: storyJsonSchema(req.pageCount),
            },
          },
          // Reasoning tokens count toward this budget, so keep headroom over the
          // longest book (12 pages). Tunable without a code change.
          max_output_tokens: env.OPENAI_MAX_OUTPUT_TOKENS,
        }),
      },
      120_000,
    );
    if (!res.ok) {
      throw new Error(`OpenAI text generation failed (${res.status}): ${await res.text()}`);
    }

    const data = (await res.json()) as ResponsesReply;
    if (data.error?.message) throw new Error(`OpenAI text generation error: ${data.error.message}`);
    // A truncated response would otherwise surface as unparseable JSON.
    if (data.status === 'incomplete') {
      throw new Error(
        `OpenAI response was incomplete (${data.incomplete_details?.reason ?? 'unknown'}) — ` +
          'raise OPENAI_MAX_OUTPUT_TOKENS.',
      );
    }

    const text = extractOutputText(data);
    if (!text) throw new Error('OpenAI returned empty story content');
    const value: Story = parseStory(JSON.parse(text), req.pageCount);

    return {
      value,
      usage: {
        model: data.model ?? this.model,
        tokensIn: data.usage?.input_tokens ?? 0,
        tokensOut: data.usage?.output_tokens ?? 0,
      },
    };
  }
}
