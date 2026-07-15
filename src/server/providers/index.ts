import { loadEnv } from '../config/env';
import { ElevenLabsAudioProvider } from './audio/elevenlabs';
import { GeminiImageProvider } from './image/gemini';
import { OpenAIModerator } from './moderation/openai';
import { GeminiTextProvider } from './text/gemini';
import { OpenAITextProvider } from './text/openai';
import type { AudioProvider, ImageProvider, Moderator, TextProvider } from './types';

/**
 * Provider selection (§7). Choosing cost vs quality is a config switch
 * (MODEL_TIER) that picks adapters — never a code change in the pipeline.
 */
export interface Providers {
  text: TextProvider;
  image: ImageProvider;
  audio: AudioProvider;
  moderator: Moderator;
}

let cached: Providers | null = null;

export function getProviders(): Providers {
  if (cached) return cached;
  const env = loadEnv();
  const tier = env.MODEL_TIER;

  cached = {
    text: tier === 'quality' ? new OpenAITextProvider(env.OPENAI_TEXT_MODEL) : new GeminiTextProvider(env.GEMINI_TEXT_MODEL),
    image: new GeminiImageProvider(
      tier === 'quality' ? env.GEMINI_IMAGE_MODEL_QUALITY : env.GEMINI_IMAGE_MODEL_COST,
    ),
    audio: new ElevenLabsAudioProvider(),
    // Moderation is independent of the generation tier (§10) — always on.
    moderator: new OpenAIModerator(),
  };
  return cached;
}

export type { AudioProvider, ImageProvider, Moderator, TextProvider } from './types';
