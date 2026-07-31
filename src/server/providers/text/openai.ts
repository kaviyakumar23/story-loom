import { loadEnv } from '../../config/env';
import { fetchWithTimeout } from '../../lib/http';
import { assertNoSensitive } from '../../lib/tokenize';
import { storyJsonSchema, storySystemPrompt, storyUserPrompt } from '../prompts';
import { parseStory } from '../validate';
import type { Story, StoryRequest, TextProvider, TextResult } from '../types';

/**
 * Quality-tier text provider — OpenAI (§3, §7), via REST. Uses Structured
 * Outputs (`response_format: json_schema`, strict) to force schema-valid story
 * JSON. Re-confirm the model at build time; swap the constant to change it.
 *
 * Reasoning models take `reasoning_effort` and reject `temperature`, so the two
 * are mutually exclusive below (`OPENAI_REASONING_EFFORT=off` restores the
 * classic temperature path for models like gpt-4o).
 */
const DEFAULT_MODEL = 'gpt-5.6-sol';
const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

interface ChatResponse {
  choices?: { message?: { content?: string; refusal?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  model?: string;
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
          // Reasoning models take an effort level and reject temperature; classic
          // models take temperature. Never send both.
          ...(env.OPENAI_REASONING_EFFORT === 'off'
            ? { temperature: env.STORY_TEMPERATURE }
            : { reasoning_effort: env.OPENAI_REASONING_EFFORT }),
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'storybook', strict: true, schema: storyJsonSchema(req.pageCount) },
          },
        }),
      },
      90_000,
    );
    if (!res.ok) {
      throw new Error(`OpenAI text generation failed (${res.status}): ${await res.text()}`);
    }

    const data = (await res.json()) as ChatResponse;
    const message = data.choices?.[0]?.message;
    if (message?.refusal) throw new Error(`OpenAI refused the request: ${message.refusal}`);
    const text = message?.content ?? '';
    if (!text) throw new Error('OpenAI returned empty story content');
    const value: Story = parseStory(JSON.parse(text), req.pageCount);

    return {
      value,
      usage: {
        model: data.model ?? this.model,
        tokensIn: data.usage?.prompt_tokens ?? 0,
        tokensOut: data.usage?.completion_tokens ?? 0,
      },
    };
  }
}
