import { HERO_TOKEN } from '../lib/tokenize';
import type { StoryRequest } from './types';

/**
 * Prompt + schema construction for story generation (§7). The hero is always a
 * placeholder token here — the real name is injected only at local render.
 */

export function storySystemPrompt(): string {
  return [
    'You are a warm, careful author of personalized picture books for young children.',
    `The child protagonist is referred to ONLY by the placeholder "${HERO_TOKEN}".`,
    `Never invent or use a real name — always write "${HERO_TOKEN}" where the child is named.`,
    'Write age-appropriate, kind, emotionally safe stories with a clear, gentle arc that',
    'serves the requested goal. No violence, fear-mongering, scary imagery, or unsafe',
    'behavior. Do not make medical, diagnostic, or therapy claims; keep it fictional and',
    'supportive. Avoid shame, punishment, manipulative obedience, and stereotypes.',
    'Each page must include a concrete illustration prompt describing the scene',
    `(setting, action, mood) WITHOUT restating ${HERO_TOKEN}'s physical appearance — the`,
    'illustrator works from a fixed character reference. Illustration prompts must avoid',
    'text, letters, signage, brand logos, weapons, unsafe acts, and scary imagery.',
  ].join(' ');
}

export function storyUserPrompt(req: StoryRequest): string {
  return [
    `Write a ${req.pageCount}-page picture book for a child in the ${req.ageBand} age band.`,
    `Reading level: ${req.readingLevel}. Story goal: ${req.goal.replace(/_/g, ' ')}.`,
    req.occasionPack ? `Occasion pack: ${req.occasionPack.replace(/_/g, ' ')}.` : '',
    req.interests.length ? `Weave in these interests where natural: ${req.interests.join(', ')}.` : '',
    req.revisionInstruction
      ? `This is one parent-requested preview revision. Keep the original goal, but adjust the new version this way: ${req.revisionInstruction}.`
      : '',
    'Match vocabulary and sentence length to the reading level.',
    'Return a title, a one-line theme, exactly one entry per page (0-indexed),',
    'a short vocabulary list, 3 discussion questions for a parent, and one simple activity.',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * JSON Schema for structured story output. Constrained to what the structured
 * outputs feature supports (no min/maxLength; additionalProperties:false).
 */
export function storyJsonSchema(pageCount: number): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'theme', 'pages', 'vocabulary', 'discussionQuestions', 'activity'],
    properties: {
      title: { type: 'string' },
      theme: { type: 'string' },
      pages: {
        type: 'array',
        minItems: pageCount,
        maxItems: pageCount,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['index', 'text', 'illustrationPrompt'],
          properties: {
            index: { type: 'integer' },
            text: { type: 'string' },
            illustrationPrompt: { type: 'string' },
          },
        },
      },
      vocabulary: { type: 'array', items: { type: 'string' } },
      discussionQuestions: { type: 'array', items: { type: 'string' } },
      activity: { type: 'string' },
    },
  };
}
