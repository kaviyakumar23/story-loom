import { z } from 'zod';
import type { Story } from './types';

/**
 * Runtime validation of model output (§7). Models can return malformed or
 * incomplete JSON even with structured-output constraints; validate before we
 * persist or render, and fail with a clear, retryable error rather than
 * crashing deep in the pipeline.
 */
const storySchema = z.object({
  title: z.string().min(1),
  theme: z.string().min(1),
  pages: z
    .array(
      z.object({
        index: z.number().int().nonnegative(),
        text: z.string().min(1),
        illustrationPrompt: z.string().min(1),
      }),
    )
    .min(1),
  vocabulary: z.array(z.string()).default([]),
  discussionQuestions: z.array(z.string()).default([]),
  activity: z.string().default(''),
});

export function parseStory(raw: unknown): Story {
  const result = storySchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Model returned an invalid story: ${result.error.issues.map((i) => i.path.join('.') + ' ' + i.message).join('; ')}`);
  }
  // Normalize page order and re-index defensively.
  const pages = [...result.data.pages].sort((a, b) => a.index - b.index);
  return { ...result.data, pages };
}
