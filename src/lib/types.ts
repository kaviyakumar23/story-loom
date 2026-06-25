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
export interface Book {
  id: string;
  status: BookStatus;
  progress: number;
  goal: Goal;
  language: Language;
  readingLevel: ReadingLevel;
  title: string | null;
  theme: string | null;
  purchasedTier: Tier | null;
  createdAt: string;
  updatedAt: string;
  preview?: { pages: PreviewPage[] };
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
  language: Language;
  readingLevel: ReadingLevel;
  consentId: string;
}
export interface CreateBookResponse {
  bookId: string;
  status: 'generating';
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
export const AGE_BANDS: AgeBand[] = ['3-4', '5-6', '7-8', '9-10'];
export const TIER_META: Record<Tier, { label: string; note: string; price: string; badge?: string }> = {
  pdf: { label: 'Digital PDF', note: 'Instant, print at home', price: '₹299' },
  pdf_audio_guide: { label: 'PDF + Audio & Guide', note: 'Narrated + parent guide', price: '₹499', badge: 'Most loved' },
  seven_day_pack: { label: '7-Day Story Pack', note: 'A week of bedtime stories', price: '₹999' },
};
export const TIER_ORDER: Tier[] = ['pdf', 'pdf_audio_guide', 'seven_day_pack'];
