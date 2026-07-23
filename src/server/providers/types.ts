/**
 * Provider abstraction (§7). One internal interface per capability, with
 * concrete adapters per vendor. Selecting cost vs quality = choosing adapters
 * via config (see ./index.ts). No vendor SDK leaks into business logic.
 */
import type { AgeBand, Goal, ReadingLevel } from '../types/api';

// ---- Story generation ----

export interface StoryRequest {
  /** Tokenized hero attributes — the real name is NEVER included (§6, §9). */
  heroToken: string;
  ageBand: AgeBand;
  readingLevel: ReadingLevel;
  goal: Goal;
  /** Already scrubbed of the child's name before reaching the provider. */
  interests: string[];
  /** Number of interior pages to plan for. */
  pageCount: number;
  /** Optional curated beta pack selected during intake. */
  occasionPack?: string | null;
  /** Optional parent-authored theme, already scrubbed of the child's name. */
  customTheme?: string | null;
  /** Optional parent-requested revision, already scrubbed of sensitive text. */
  revisionInstruction?: string | null;
  /** Sensitive terms (e.g. the nickname) the outbound payload must NOT contain. */
  guard: string[];
}

export interface StoryPage {
  index: number;
  /** Story text containing the {{HERO}} placeholder, never the real name. */
  text: string;
  illustrationPrompt: string;
}

export interface Story {
  title: string;
  theme: string;
  pages: StoryPage[];
  vocabulary: string[];
  discussionQuestions: string[];
  activity: string;
}

export interface TextResult<T> {
  value: T;
  usage: { model: string; tokensIn: number; tokensOut: number };
}

export interface TextProvider {
  readonly name: string;
  generateStory(req: StoryRequest): Promise<TextResult<Story>>;
}

// ---- Illustration ----

export interface CharacterSheetRequest {
  /** Avatar attribute set (skin tone, hair, glasses…). No name. */
  avatar: Record<string, unknown>;
  ageBand: AgeBand;
  /** Sensitive terms (e.g. the nickname) the outbound payload must NOT contain. */
  guard: string[];
  /**
   * OPTIONAL, consent-gated child photo, used ONCE to seed a *stylized* likeness
   * on the turnaround view only (never photoreal, never stored on the pack). The
   * caller must gate egress (Vertex-only) and delete the photo after this call.
   */
  likenessPhoto?: { base64: string; mime: string };
}

/** The canonical "character bible" — reused to anchor every page (§7). */
export interface CharacterReferencePack {
  /** Base64 reference images keyed by view (turnaround, face, expressions). */
  images: { view: string; base64: string; mime: string }[];
  palette: string[];
  clothingTokens: string[];
  negativeConstraints: string[];
}

export interface RenderedImage {
  base64: string;
  mime: string;
  width: number;
  height: number;
}

export interface ImageResult<T> {
  value: T;
  usage: { model: string; images: number };
}

export interface ImageProvider {
  readonly name: string;
  /** Generate the reusable character bible from avatar attributes (§7). */
  generateCharacterSheet(
    req: CharacterSheetRequest,
  ): Promise<ImageResult<CharacterReferencePack>>;
  /** Render one page, anchored to the character sheet (reference-guided). */
  renderPage(
    prompt: string,
    reference: CharacterReferencePack,
  ): Promise<ImageResult<RenderedImage>>;
}

// ---- Audio ----

export interface AudioResult {
  buffer: Buffer;
  mime: string;
  usage: { model: string; characters: number };
}

export interface AudioProvider {
  readonly name: string;
  synthesize(script: string): Promise<AudioResult>;
}

// ---- Moderation (§10) ----

export interface ModerationResult {
  allowed: boolean;
  /** Populated when blocked: the categories that tripped. */
  reasons: string[];
  /** Raw model/provider verdict for the audit trail. */
  raw?: unknown;
}

export interface Moderator {
  readonly name: string;
  /** Gate #1/#2 — story text + per-page prompts before any image spend. */
  moderateText(texts: string[]): Promise<ModerationResult>;
  /** Gate #3 — rendered images before exposure or delivery. */
  moderateImage(image: { base64: string; mime: string }): Promise<ModerationResult>;
}
