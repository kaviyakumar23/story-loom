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
  const tier = loadEnv().MODEL_TIER;

  cached = {
    text: tier === 'quality' ? new OpenAITextProvider() : new GeminiTextProvider(),
    image: new GeminiImageProvider(
      tier === 'quality' ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image',
    ),
    audio: new ElevenLabsAudioProvider(),
    // Moderation is independent of the generation tier (§10) — always on.
    moderator: new OpenAIModerator(),
  };
  return cached;
}

export type { AudioProvider, ImageProvider, Moderator, TextProvider } from './types';
