import { assertNoSensitive } from '../../lib/tokenize';
import { callGemini } from '../gemini-transport';
import type {
  CharacterReferencePack,
  CharacterSheetRequest,
  ImageProvider,
  ImageResult,
  RenderedImage,
} from '../types';

/**
 * Gemini image provider (§3, §7). Cost tier = `gemini-2.5-flash-image`; quality
 * tier = `gemini-3-pro-image`. Chosen for kids'-book quality, speed,
 * cost, and the privacy posture (no training on inputs by default).
 *
 * The flow is reference-anchored: generate the canonical character sheet ONCE,
 * then render every page conditioned on those reference images — never recreate
 * the hero from a text prompt per page (that's where visual drift comes from).
 *
 * Backend-agnostic: `callGemini` routes to AI Studio or Vertex AI per config.
 */
interface InlinePart {
  inlineData?: { mimeType?: string; data?: string };
  text?: string;
}
interface GeminiImageResponse {
  candidates?: { content?: { parts?: InlinePart[] } }[];
}

const CHARACTER_VIEWS = ['turnaround', 'face_closeup', 'expression_sheet'] as const;

export class GeminiImageProvider implements ImageProvider {
  readonly name: string;
  constructor(private readonly model: string) {
    this.name = model;
  }

  async generateCharacterSheet(
    req: CharacterSheetRequest,
  ): Promise<ImageResult<CharacterReferencePack>> {
    const descriptor = describeAvatar(req.avatar, req.ageBand);
    // The avatar descriptor is built from parent free-text — guard against any
    // real name leaking into the image prompt (§9).
    assertNoSensitive(descriptor, req.guard);
    const images: CharacterReferencePack['images'] = [];

    // The turnaround is the anchor: generate it first, then condition every
    // other view on it. Generating the views independently from the same text
    // would give three different-looking children — in the very pack whose job
    // is to stop the hero drifting between pages.
    let anchor: { base64: string; mime: string } | null = null;
    for (const view of CHARACTER_VIEWS) {
      const isTurnaround = anchor === null;
      let prompt =
        `Children's picture-book character reference — ${view.replace(/_/g, ' ')}. ` +
        `${descriptor}. Consistent, friendly, soft illustrated style on a plain background. ` +
        `No text, no logos.`;
      let refs: { base64: string; mime: string }[] = anchor ? [anchor] : [];

      if (isTurnaround && req.likenessPhoto) {
        // Seed a STYLIZED likeness from the photo on the turnaround ONLY — this is
        // the single call the photo is ever attached to. Explicitly non-photoreal.
        prompt =
          `Create a soft, STYLIZED children's picture-book character inspired by the attached photo of a child. ` +
          `Capture a friendly, recognisable likeness (hair, skin tone, general features) but do NOT produce a ` +
          `photorealistic image — this is a warm hand-illustrated cartoon character, plain background, no text, no logos. ` +
          `${descriptor}.`;
        refs = [{ base64: req.likenessPhoto.base64, mime: req.likenessPhoto.mime }];
      } else if (!isTurnaround) {
        prompt += ` Draw the exact same child as the attached reference — identical face, hair, skin tone, palette, and outfit.`;
      }

      const img = await this.callImage(prompt, refs);
      anchor ??= { base64: img.base64, mime: img.mime };
      images.push({ view, base64: img.base64, mime: img.mime });
    }

    return {
      value: {
        images,
        palette: derivePalette(req.avatar),
        clothingTokens: deriveClothing(req.avatar),
        negativeConstraints: NEGATIVE_CONSTRAINTS,
      },
      usage: { model: this.model, images: images.length },
    };
  }

  async renderPage(
    prompt: string,
    reference: CharacterReferencePack,
  ): Promise<ImageResult<RenderedImage>> {
    const guided =
      `Illustrate this picture-book scene in a consistent style, using the attached ` +
      `reference images of the character (keep face, hair, palette, and clothing identical): ` +
      `${prompt}. Palette: ${reference.palette.join(', ')}. ` +
      `Avoid: ${reference.negativeConstraints.join(', ')}.`;
    const img = await this.callImage(guided, reference.images);
    return { value: img, usage: { model: this.model, images: 1 } };
  }

  private async callImage(
    prompt: string,
    references: { base64: string; mime: string }[],
  ): Promise<RenderedImage> {
    const parts: InlinePart[] = [
      { text: prompt },
      ...references.map((r) => ({ inlineData: { mimeType: r.mime, data: r.base64 } })),
    ];
    const res = await callGemini(
      this.model,
      'generateContent',
      {
        contents: [{ role: 'user', parts }],
        generationConfig: { responseModalities: ['IMAGE'] },
      },
      90_000,
    );
    if (!res.ok) {
      throw new Error(`Gemini image generation failed (${res.status}): ${await res.text()}`);
    }
    const data = (await res.json()) as GeminiImageResponse;
    const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part?.inlineData?.data) throw new Error('Gemini returned no image data');
    return {
      base64: part.inlineData.data,
      mime: part.inlineData.mimeType ?? 'image/png',
      width: 0,
      height: 0,
    };
  }
}

const NEGATIVE_CONSTRAINTS = [
  'text or letters in the image',
  'scary or violent imagery',
  'photorealistic faces',
  'extra fingers or distorted anatomy',
  'brand logos',
];

function describeAvatar(avatar: Record<string, unknown>, ageBand: string): string {
  const a = avatar as {
    skinTone?: string;
    hair?: string;
    hairColor?: string;
    eyeColor?: string;
    glasses?: boolean;
    features?: string[];
  };
  const bits = [`a young child (${ageBand} years)`];
  if (a.skinTone) bits.push(`${a.skinTone} skin`);
  if (a.hairColor || a.hair) bits.push(`${[a.hairColor, a.hair].filter(Boolean).join(' ')} hair`);
  if (a.eyeColor) bits.push(`${a.eyeColor} eyes`);
  if (a.glasses) bits.push('wearing glasses');
  if (a.features?.length) bits.push(a.features.join(', '));
  return bits.join(', ');
}

function derivePalette(avatar: Record<string, unknown>): string[] {
  const a = avatar as { hairColor?: string; eyeColor?: string };
  return [a.hairColor, a.eyeColor, 'warm pastel', 'soft cream'].filter(Boolean) as string[];
}

function deriveClothing(avatar: Record<string, unknown>): string[] {
  const a = avatar as { features?: string[] };
  return a.features?.length ? a.features : ['simple everyday outfit'];
}
