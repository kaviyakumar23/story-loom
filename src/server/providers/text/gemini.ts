import { loadEnv } from '../../config/env';
import { fetchWithTimeout } from '../../lib/http';
import { assertNoSensitive } from '../../lib/tokenize';
import { storyJsonSchema, storySystemPrompt, storyUserPrompt } from '../prompts';
import { parseStory } from '../validate';
import type { Story, StoryRequest, TextProvider, TextResult } from '../types';

/**
 * Cost-tier text provider — Gemini Flash (§3), via REST (no SDK coupling).
 * Re-confirm the exact model name at build time; swap the constant to change it.
 */
const MODEL = 'gemini-2.5-flash';
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

export class GeminiTextProvider implements TextProvider {
  readonly name = MODEL;

  async generateStory(req: StoryRequest): Promise<TextResult<Story>> {
    const env = loadEnv();
    const system = storySystemPrompt();
    const user = storyUserPrompt(req);
    assertNoSensitive(`${system}\n${user}\n${req.interests.join(' ')}`, req.guard);

    const res = await fetchWithTimeout(`${ENDPOINT}/${MODEL}:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: storyJsonSchema(req.pageCount),
        },
      }),
    });
    if (!res.ok) {
      throw new Error(`Gemini text generation failed (${res.status}): ${await res.text()}`);
    }
    const data = (await res.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text) throw new Error('Gemini returned empty story content');
    const value: Story = parseStory(JSON.parse(text));

    return {
      value,
      usage: {
        model: MODEL,
        tokensIn: data.usageMetadata?.promptTokenCount ?? 0,
        tokensOut: data.usageMetadata?.candidatesTokenCount ?? 0,
      },
    };
  }
}
