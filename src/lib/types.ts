/**
 * Shared API contract types — kept in sync with the backend's src/types/api.ts
 * (see the backend's API_CONTRACT.md). Single source of truth for request and
 * response shapes.
 */
export type Goal =
  | 'reading_confidence'
  | 'sleeping_alone'
  | 'fear_of_school'
  | 'new_sibling'
  | 'kindness_patience'
  | 'speaking_english'
  | 'not_giving_up'
  | 'moving_to_new_place';
export type AgeBand = '3-4' | '5-6' | '7-8' | '9-10';
export type ReadingLevel = 'emerging' | 'early' | 'fluent';
export type Language = 'en';
export type BookStatus = 'generating' | 'preview_ready' | 'paid' | 'complete' | 'failed';
export type Tier = 'pdf' | 'pdf_audio_guide' | 'seven_day_pack';
export type OccasionPackId =
  | 'first_day_school'
  | 'braver_bedtime'
  | 'new_sibling'
  | 'kindness_reset'
  | 'reading_win'
  | 'big_move'
  | 'english_practice'
  | 'try_again';
export type BookEventName =
  | 'preview_viewed'
  | 'preview_page_changed'
  | 'alpha_preview_saved'
  | 'preview_share_created'
  | 'preview_share_copied'
  | 'preview_tweak_requested'
  | 'download_pdf_clicked'
  | 'download_audio_clicked';
export type FeedbackIssueType = 'none' | 'story_quality' | 'image_quality' | 'safety' | 'technical' | 'other';

export interface Avatar {
  skinTone?: string;
  hair?: string;
  hairColor?: string;
  eyeColor?: string;
  glasses?: boolean;
  features?: string[];
}
export interface ChildInput {
  nickname: string;
  ageBand: AgeBand;
  avatar: Avatar;
  interests: string[];
}
export interface PreviewPage {
  pageIndex: number;
  text: string;
  imageUrl: string | null;
}
export interface ReadingGuide {
  vocabulary: string[];
  discussionQuestions: string[];
  activity: string | null;
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
  preview?: { pages: PreviewPage[] };
  readingGuide?: ReadingGuide | null;
  revisionCount: number;
  revisionLimit: number;
  canRequestRevision: boolean;
  pdfUrl?: string | null;
  audioUrl?: string | null;
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

export interface CreateConsentRequest {
  consentVersion: string;
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
  /** Usually 'generating'; an idempotent replay returns the real status. */
  status: BookStatus;
}
export interface ListBooksResponse {
  books: BookListItem[];
  nextOffset: number | null;
}
export interface CreateOrderRequest {
  bookId: string;
  tier: Tier;
}
export interface CreateOrderResponse {
  razorpayOrderId: string;
  amount: number;
  currency: string;
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

// ---- UI helper metadata (frontend-only) ----
export const GOAL_LABELS: Record<Goal, string> = {
  reading_confidence: 'Reading confidence',
  sleeping_alone: 'Sleeping alone',
  fear_of_school: 'Starting school',
  new_sibling: 'A new sibling',
  kindness_patience: 'Kindness & patience',
  speaking_english: 'Speaking English',
  not_giving_up: 'Never giving up',
  moving_to_new_place: 'Moving somewhere new',
};
export const READING_LEVELS: { id: ReadingLevel; label: string; note: string }[] = [
  { id: 'emerging', label: 'Emerging', note: 'Just starting out' },
  { id: 'early', label: 'Early reader', note: 'Short sentences' },
  { id: 'fluent', label: 'Fluent', note: 'Confident reader' },
];
export const OCCASION_PACKS: {
  id: OccasionPackId;
  label: string;
  note: string;
  goal: Goal;
  interests: string[];
  readingLevel?: ReadingLevel;
}[] = [
  {
    id: 'first_day_school',
    label: 'First day school',
    note: 'A calm, brave start',
    goal: 'fear_of_school',
    interests: ['classroom helper', 'new friend', 'morning routine'],
  },
  {
    id: 'braver_bedtime',
    label: 'Braver bedtime',
    note: 'Settling in alone',
    goal: 'sleeping_alone',
    interests: ['moon lamp', 'favorite blanket', 'goodnight ritual'],
  },
  {
    id: 'new_sibling',
    label: 'New sibling',
    note: 'Feeling included',
    goal: 'new_sibling',
    interests: ['tiny helper', 'family team', 'gentle hands'],
  },
  {
    id: 'kindness_reset',
    label: 'Kindness reset',
    note: 'Patience after a hard day',
    goal: 'kindness_patience',
    interests: ['sharing game', 'deep breath', 'helping hands'],
  },
  {
    id: 'reading_win',
    label: 'Reading win',
    note: 'Confidence with words',
    goal: 'reading_confidence',
    interests: ['word treasure', 'library corner', 'page turner'],
    readingLevel: 'early',
  },
  {
    id: 'big_move',
    label: 'Big move',
    note: 'A new place feels familiar',
    goal: 'moving_to_new_place',
    interests: ['new room', 'neighborhood walk', 'memory box'],
  },
  {
    id: 'english_practice',
    label: 'English practice',
    note: 'Gentle speaking practice',
    goal: 'speaking_english',
    interests: ['hello words', 'small sentences', 'friendly chat'],
    readingLevel: 'emerging',
  },
  {
    id: 'try_again',
    label: 'Try again',
    note: 'Resilience after mistakes',
    goal: 'not_giving_up',
    interests: ['practice round', 'tiny steps', 'proud finish'],
  },
];
export const AGE_BANDS: AgeBand[] = ['3-4', '5-6', '7-8', '9-10'];
// `enabled` mirrors the server price table (src/server/config/pricing.ts) —
// keep the two in sync. Disabled tiers are hidden from checkout; the server
// refuses orders for them regardless.
export const TIER_META: Record<Tier, { label: string; note: string; price: string; badge?: string; enabled: boolean }> = {
  pdf: { label: 'Digital PDF', note: 'Instant, print at home', price: '₹299', enabled: true },
  pdf_audio_guide: { label: 'PDF + Audio & Guide', note: 'Narrated + parent guide', price: '₹499', badge: 'Most loved', enabled: false },
  seven_day_pack: { label: '7-Day Story Pack', note: 'A week of bedtime stories', price: '₹999', enabled: false },
};
export const TIER_ORDER: Tier[] = ['pdf', 'pdf_audio_guide', 'seven_day_pack'];
