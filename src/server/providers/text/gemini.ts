import { loadEnv } from '../../config/env';
import { assertNoSensitive } from '../../lib/tokenize';
import { callGemini } from '../gemini-transport';
import { storyJsonSchema, storySystemPrompt, storyUserPrompt } from '../prompts';
import { parseStory } from '../validate';
import type { Story, StoryRequest, TextProvider, TextResult } from '../types';

/**
 * Cost-tier text provider — Gemini Flash (§3), via REST (no SDK coupling).
 * Re-confirm the exact model name at build time; swap the constant to change it.
 * Reaches Gemini through `callGemini`, so it works on either backend (AI Studio
 * API key or Vertex AI service account) with no change here.
 */
const DEFAULT_MODEL = 'gemini-2.5-flash';

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

export class GeminiTextProvider implements TextProvider {
  readonly name: string;

  constructor(private readonly model = DEFAULT_MODEL) {
    this.name = model;
  }

  async generateStory(req: StoryRequest): Promise<TextResult<Story>> {
    const env = loadEnv();
    const system = storySystemPrompt();
    const user = storyUserPrompt(req);
    assertNoSensitive(`${system}\n${user}\n${req.interests.join(' ')}`, req.guard);

    const res = await callGemini(this.model, 'generateContent', {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: {
        temperature: env.STORY_TEMPERATURE,
        responseMimeType: 'application/json',
        responseJsonSchema: storyJsonSchema(req.pageCount),
      },
    });
    if (!res.ok) {
      throw new Error(`Gemini text generation failed (${res.status}): ${await res.text()}`);
    }
    const data = (await res.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text) throw new Error('Gemini returned empty story content');
    const value: Story = parseStory(JSON.parse(text), req.pageCount);

    return {
      value,
      usage: {
        model: this.model,
        tokensIn: data.usageMetadata?.promptTokenCount ?? 0,
        tokensOut: data.usageMetadata?.candidatesTokenCount ?? 0,
      },
    };
  }
}
