import { measureImage } from '../../lib/image-resolution';
import { assertNoSensitive } from '../../lib/tokenize';
import { callGemini } from '../gemini-transport';
import type {
  CharacterReferencePack,
  CharacterSheetRequest,
  ImageProvider,
  ImageQuality,
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

/**
 * Only the pro image model accepts an explicit size. Sending the field to a
 * model that does not understand it risks a 400 on every render, so we ask only
 * where it is supported — and `callImage` falls back once if the API rejects it
 * anyway, because losing all illustration to an unknown parameter is a far worse
 * failure than a soft one.
 */
function supportsImageSize(model: string): boolean {
  return /gemini-3.*-image/.test(model);
}

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
    quality: ImageQuality = 'preview',
  ): Promise<ImageResult<RenderedImage>> {
    const guided =
      `Illustrate this picture-book scene in a consistent style, using the attached ` +
      `reference images of the character (keep face, hair, palette, and clothing identical): ` +
      `${prompt}. Palette: ${reference.palette.join(', ')}. ` +
      `Avoid: ${reference.negativeConstraints.join(', ')}.`;
    const img = await this.callImage(guided, reference.images, quality);
    return { value: img, usage: { model: this.model, images: 1 } };
  }

  private async callImage(
    prompt: string,
    references: { base64: string; mime: string }[],
    quality: ImageQuality = 'preview',
  ): Promise<RenderedImage> {
    const parts: InlinePart[] = [
      { text: prompt },
      ...references.map((r) => ({ inlineData: { mimeType: r.mime, data: r.base64 } })),
    ];
    const wantsSize = quality === 'print' && supportsImageSize(this.model);
    const body = (withSize: boolean) => ({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseModalities: ['IMAGE'],
        // Square, because every page in the book is square — letting the model
        // pick would crop the hero out of a full-bleed placement.
        ...(withSize ? { imageConfig: { aspectRatio: '1:1', imageSize: '4K' } } : {}),
      },
    });

    let res = await callGemini(this.model, 'generateContent', body(wantsSize), 120_000);
    if (!res.ok && wantsSize) {
      const detail = await res.text();
      // The size parameter is newer than the models; if this deployment rejects
      // it, render anyway and let the resolution floor deal with the result.
      if (/imageConfig|imageSize|aspectRatio|Unknown name/i.test(detail)) {
        console.warn('[gemini] imageConfig rejected, retrying without an explicit size:', detail.slice(0, 200));
        res = await callGemini(this.model, 'generateContent', body(false), 120_000);
      } else {
        throw new Error(`Gemini image generation failed (${res.status}): ${detail}`);
      }
    }
    if (!res.ok) {
      throw new Error(`Gemini image generation failed (${res.status}): ${await res.text()}`);
    }
    const data = (await res.json()) as GeminiImageResponse;
    const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part?.inlineData?.data) throw new Error('Gemini returned no image data');

    // Measure what actually came back. These used to be hard-coded zeros, which
    // meant nothing in the system could tell a print-ready render from one that
    // would come off the press soft.
    const bytes = Buffer.from(part.inlineData.data, 'base64');
    const { width, height } = await measureImage(bytes);
    return {
      base64: part.inlineData.data,
      mime: part.inlineData.mimeType ?? 'image/png',
      width,
      height,
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
    gender?: string;
    hairLength?: string;
    hairTexture?: string;
    hairStyle?: string;
    hair?: string;
    hairColor?: string;
    eyeColor?: string;
    glasses?: boolean;
    features?: string[];
  };
  const child =
    a.gender === 'girl' ? 'a young girl' : a.gender === 'boy' ? 'a young boy' : 'a young child';
  const bits = [`${child} (${ageBand} years)`];
  if (a.skinTone) bits.push(`${a.skinTone} skin`);
  // Length + texture + colour compose into one phrase; `hair` is the legacy
  // single field, used only when the split facets are absent (older heroes).
  const hairPhrase = [a.hairColor, a.hairLength, a.hairTexture].filter(Boolean).join(' ')
    || [a.hairColor, a.hair].filter(Boolean).join(' ');
  if (hairPhrase) bits.push(`${hairPhrase} hair`);
  if (a.hairStyle && a.hairStyle !== 'loose') bits.push(`worn in a ${a.hairStyle}`);
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
