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

const PROMPT_VERSION = 'v1';

export interface ModelStamp {
  modelTier: string;
  textModel: string;
  imageModel: string;
  promptVersion: string;
}

/**
 * Resolve the current model config from env. Stamped onto a book at creation so
 * the free preview pages and the paid render use the SAME models even if
 * MODEL_TIER or a provider default changes between the two — no book split
 * across model versions (review finding).
 */
export function resolveModelStamp(): ModelStamp {
  const env = loadEnv();
  const textTier = env.TEXT_MODEL_TIER ?? env.MODEL_TIER;
  const imageTier = env.IMAGE_MODEL_TIER ?? env.MODEL_TIER;
  return {
    modelTier: env.MODEL_TIER,
    textModel: textTier === 'quality' ? env.OPENAI_TEXT_MODEL : env.GEMINI_TEXT_MODEL,
    imageModel: imageTier === 'quality' ? env.GEMINI_IMAGE_MODEL_QUALITY : env.GEMINI_IMAGE_MODEL_COST,
    promptVersion: PROMPT_VERSION,
  };
}

/** Text provider class is inferred from the model name (OpenAI models start gpt or o-series). */
const isOpenAiModel = (m: string): boolean => /^(gpt|o\d)/.test(m);

let cached: Providers | null = null;

/**
 * Provider set. With no argument: the env-configured providers (cached). With a
 * book's stamped model names: providers pinned to THOSE exact models, so a book
 * renders identically across preview and fulfilment regardless of later config.
 */
export function getProviders(stamp?: { textModel?: string; imageModel?: string }): Providers {
  if (!stamp && cached) return cached;
  const defaults = resolveModelStamp();
  const textModel = stamp?.textModel ?? defaults.textModel;
  const imageModel = stamp?.imageModel ?? defaults.imageModel;

  const providers: Providers = {
    text: isOpenAiModel(textModel) ? new OpenAITextProvider(textModel) : new GeminiTextProvider(textModel),
    image: new GeminiImageProvider(imageModel),
    audio: new ElevenLabsAudioProvider(),
    // Moderation is independent of the generation tier (§10) — always on.
    moderator: new OpenAIModerator(),
  };
  if (!stamp) cached = providers;
  return providers;
}

export type { AudioProvider, ImageProvider, Moderator, TextProvider } from './types';
