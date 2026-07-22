/**
 * Shared API contract (§5, §14).
 *
 * This file is the single source of truth for the request/response shapes and
 * enums exchanged between the backend and the frontend. The frontend imports
 * these same types (or a generated copy) and develops against MSW mocks that
 * return exactly these shapes.
 *
 * Keep this file free of server-only imports so it can be shared verbatim.
 */

// ---- Enums (shared with frontend) ----

export const GOALS = [
  'reading_confidence',
  'sleeping_alone',
  'fear_of_school',
  'new_sibling',
  'kindness_patience',
  'speaking_english',
  'not_giving_up',
  'moving_to_new_place',
] as const;
export type Goal = (typeof GOALS)[number];

export const AGE_BANDS = ['3-4', '5-6', '7-8', '9-10'] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export const READING_LEVELS = ['emerging', 'early', 'fluent'] as const;
export type ReadingLevel = (typeof READING_LEVELS)[number];

export const BOOK_STATUSES = [
  'generating',
  'preview_ready',
  'paid',
  'complete',
  'failed',
] as const;
export type BookStatus = (typeof BOOK_STATUSES)[number];

export const TIERS = ['pdf', 'pdf_audio_guide', 'seven_day_pack', 'print'] as const;
export type Tier = (typeof TIERS)[number];

export const LANGUAGES = ['en'] as const;
export type Language = (typeof LANGUAGES)[number];

export const OCCASION_PACKS = [
  'first_day_school',
  'braver_bedtime',
  'new_sibling',
  'kindness_reset',
  'reading_win',
  'big_move',
  'english_practice',
  'try_again',
] as const;
export type OccasionPackId = (typeof OCCASION_PACKS)[number];

export const BOOK_EVENT_NAMES = [
  'preview_viewed',
  'preview_page_changed',
  'alpha_preview_saved',
  'preview_share_created',
  'preview_share_copied',
  'preview_tweak_requested',
  'download_pdf_clicked',
  'download_audio_clicked',
] as const;
export type BookEventName = (typeof BOOK_EVENT_NAMES)[number];

export const FEEDBACK_ISSUE_TYPES = [
  'none',
  'story_quality',
  'image_quality',
  'safety',
  'technical',
  'other',
] as const;
export type FeedbackIssueType = (typeof FEEDBACK_ISSUE_TYPES)[number];

// ---- Domain shapes ----

/**
 * Data-minimized child representation (§4 heroes, §9). Attributes only — never
 * a photo, never a legal name, never a date of birth.
 */
export interface Avatar {
  skinTone?: string;
  hair?: string;
  hairColor?: string;
  eyeColor?: string;
  glasses?: boolean;
  /** Free-form additional attribute tokens, e.g. ["freckles", "wheelchair"]. */
  features?: string[];
}

export interface ChildInput {
  /** Nickname preferred over legal name (§9 data minimization). */
  nickname: string;
  ageBand: AgeBand;
  avatar: Avatar;
  interests: string[];
}

export interface PreviewPage {
  pageIndex: number;
  text: string;
  /** Signed, short-lived URL — owner-scoped, issued on demand (§11). */
  imageUrl: string | null;
}

export interface ReadingGuide {
  vocabulary: string[];
  discussionQuestions: string[];
  activity: string | null;
}

export interface FulfillmentStatus {
  status: 'print_ready' | 'printing' | 'shipped' | 'delivered' | 'cancelled';
  carrier: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
}

export interface Book {
  id: string;
  status: BookStatus;
  progress: number;
  goal: Goal;
  occasionPack: OccasionPackId | null;
  language: Language;
  readingLevel: ReadingLevel;
  title: string | null;
  theme: string | null;
  purchasedTier: Tier | null;
  createdAt: string;
  updatedAt: string;
  /** Present once status reaches preview_ready. */
  preview?: { pages: PreviewPage[] };
  readingGuide?: ReadingGuide | null;
  revisionCount: number;
  revisionLimit: number;
  canRequestRevision: boolean;
  /** Signed URLs present once complete/paid (§11). */
  pdfUrl?: string | null;
  audioUrl?: string | null;
  /** Print fulfilment status, present for a paid physical order. */
  fulfillment?: FulfillmentStatus | null;
  error?: { code: string; message: string } | null;
}

export interface BookListItem {
  id: string;
  title: string | null;
  status: BookStatus;
  goal: Goal;
  purchasedTier: Tier | null;
  createdAt: string;
}

// ---- Request / response payloads ----

export interface CreateConsentRequest {
  /** Which policy text the parent agreed to. */
  consentVersion: string;
  /** How consent was verified (see §9 / §18.1). */
  method: 'explicit_checkbox' | 'adult_payment_signal' | 'digilocker';
}
export interface CreateConsentResponse {
  consentId: string;
}

export interface CreateBookRequest {
  child: ChildInput;
  goal: Goal;
  occasionPack?: OccasionPackId | null;
  language: Language;
  readingLevel: ReadingLevel;
  consentId: string;
}
export interface CreateBookResponse {
  bookId: string;
  /**
   * Usually 'generating'. An idempotent replay returns the book's real current
   * status — by then it may already be preview_ready, or failed.
   */
  status: BookStatus;
}

export interface ListBooksResponse {
  books: BookListItem[];
}

export interface CreateOrderRequest {
  bookId: string;
  tier: Tier;
}
export interface CreateOrderResponse {
  razorpayOrderId: string;
  /** Amount in the currency's smallest unit (paise for INR). */
  amount: number;
  currency: string;
  /** Public Razorpay key id for the client-side Checkout widget. */
  keyId: string;
}

export interface OrderStatusResponse {
  orderId: string;
  status: 'created' | 'paid' | 'failed' | 'refunded';
  bookId: string;
  tier: Tier;
}

export interface BetaAccessResponse {
  enabled: boolean;
  granted: boolean;
}

export interface CreateBookEventRequest {
  event: BookEventName;
  metadata?: Record<string, unknown>;
}

export interface CreateBookFeedbackRequest {
  rating: number;
  issueType: FeedbackIssueType;
  comments?: string;
  wantsFullBook: boolean;
}

export interface CreateBookShareResponse {
  shareUrl: string;
  expiresAt: string;
}

export interface RevokeBookShareResponse {
  revoked: number;
}

export interface CreateBookRevisionRequest {
  instruction: string;
}

export interface CreateBookRevisionResponse {
  ok: true;
  revisionId: string;
}

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}
