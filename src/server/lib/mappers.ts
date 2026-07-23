import { signAsset } from './storage';
import { serviceClient } from './supabase';
import type {
  Book,
  BookListItem,
  BookStatus,
  FulfillmentStatus,
  Goal,
  Language,
  OccasionPackId,
  PreviewPage,
  ReadingGuide,
  ReadingLevel,
  Tier,
} from '../types/api';

/** A `books` row as returned by Supabase. */
export interface BookRow {
  id: string;
  status: BookStatus;
  progress: number;
  goal: Goal;
  occasion_pack: OccasionPackId | null;
  language: Language;
  reading_level: ReadingLevel;
  title: string | null;
  theme: string | null;
  purchased_tier: Tier | null;
  cover_asset_id: string | null;
  error: { code: string; message: string } | null;
  created_at: string;
  updated_at: string;
}

export function toListItem(row: BookRow): BookListItem {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    goal: row.goal,
    purchasedTier: row.purchased_tier,
    createdAt: row.created_at,
  };
}

/**
 * Build the full Book response, including the preview (once preview_ready) and
 * signed delivery URLs (once paid/complete). All asset URLs are short-lived and
 * issued on demand (§11).
 *
 * `includeDelivery` must be left off for anyone who is not the owner. The shared
 * preview page renders a Book too, and signing the purchased PDF/audio for every
 * anonymous link holder — even unrendered — puts the paid product one
 * serialization change away from being handed out.
 */
export async function toBook(row: BookRow, { includeDelivery = false } = {}): Promise<Book> {
  const revisionCount = await loadRevisionCount(row.id);
  const book: Book = {
    id: row.id,
    status: row.status,
    progress: row.progress,
    goal: row.goal,
    occasionPack: row.occasion_pack ?? null,
    language: row.language,
    readingLevel: row.reading_level,
    title: row.title,
    theme: row.theme,
    purchasedTier: row.purchased_tier,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    error: row.error,
    revisionCount,
    revisionLimit: 1,
    canRequestRevision: row.status === 'preview_ready' && revisionCount < 1,
  };

  if (row.status === 'preview_ready' || row.status === 'paid' || row.status === 'complete') {
    // The full story text exists from preview_ready on (all pages are generated
    // in one call); surfacing it lets the preview show the whole book, not just
    // the rendered pages. `preview` keeps its original meaning (rendered pages).
    const allPages = await loadAllPages(row.id);
    book.fullStory = { pages: allPages };
    book.preview = { pages: await loadPreviewPages(row.id) };
    book.readingGuide = await loadReadingGuide(row.id);
  }

  if (includeDelivery && (row.status === 'paid' || row.status === 'complete')) {
    const assets = await loadDeliveryAssets(row.id);
    book.pdfUrl = assets.pdf ? await signAsset(assets.pdf) : null;
    book.audioUrl = assets.audio ? await signAsset(assets.audio) : null;
    book.fulfillment = await loadFulfillment(row.id);
  }

  return book;
}

/** Print fulfilment status for a paid physical order (null if none). */
async function loadFulfillment(bookId: string): Promise<FulfillmentStatus | null> {
  const { data } = await serviceClient()
    .from('fulfillments')
    .select('status, carrier, tracking_number, shipped_at')
    .eq('book_id', bookId)
    .eq('kind', 'print')
    .maybeSingle();
  if (!data) return null;
  const f = data as { status: FulfillmentStatus['status']; carrier: string | null; tracking_number: string | null; shipped_at: string | null };
  return { status: f.status, carrier: f.carrier, trackingNumber: f.tracking_number, shippedAt: f.shipped_at };
}

async function loadReadingGuide(bookId: string): Promise<ReadingGuide | null> {
  const { data } = await serviceClient()
    .from('book_reading_guides')
    .select('vocabulary, discussion_questions, activity')
    .eq('book_id', bookId)
    .maybeSingle();
  const row = data as {
    vocabulary: string[] | null;
    discussion_questions: string[] | null;
    activity: string | null;
  } | null;
  if (!row) return null;
  return {
    vocabulary: row.vocabulary ?? [],
    discussionQuestions: row.discussion_questions ?? [],
    activity: row.activity,
  };
}

async function loadRevisionCount(bookId: string): Promise<number> {
  const { count } = await serviceClient()
    .from('book_revision_requests')
    .select('id', { count: 'exact', head: true })
    .eq('book_id', bookId);
  return count ?? 0;
}

async function loadPreviewPages(bookId: string): Promise<PreviewPage[]> {
  return loadPages(bookId, true);
}

/** Every page of the book (text always; image once rendered). */
async function loadAllPages(bookId: string): Promise<PreviewPage[]> {
  return loadPages(bookId, false);
}

async function loadPages(bookId: string, previewOnly: boolean): Promise<PreviewPage[]> {
  let query = serviceClient()
    .from('book_pages')
    .select('page_index, text, image_asset_id')
    .eq('book_id', bookId);
  if (previewOnly) query = query.eq('is_preview', true);
  const { data: pages } = await query.order('page_index', { ascending: true });
  if (!pages) return [];

  const result: PreviewPage[] = [];
  for (const p of pages as Array<{ page_index: number; text: string; image_asset_id: string | null }>) {
    let imageUrl: string | null = null;
    if (p.image_asset_id) {
      const key = await assetKey(p.image_asset_id);
      imageUrl = key ? await signAsset(key) : null;
    }
    result.push({ pageIndex: p.page_index, text: p.text, imageUrl });
  }
  return result;
}

async function loadDeliveryAssets(
  bookId: string,
): Promise<{ pdf: string | null; audio: string | null }> {
  const { data } = await serviceClient()
    .from('assets')
    .select('type, storage_key, created_at')
    .eq('book_id', bookId)
    .in('type', ['pdf', 'audio'])
    .order('created_at', { ascending: false });
  const rows = (data ?? []) as Array<{ type: string; storage_key: string }>;
  return {
    pdf: rows.find((r) => r.type === 'pdf')?.storage_key ?? null,
    audio: rows.find((r) => r.type === 'audio')?.storage_key ?? null,
  };
}

async function assetKey(assetId: string): Promise<string | null> {
  const { data } = await serviceClient()
    .from('assets')
    .select('storage_key')
    .eq('id', assetId)
    .single();
  return (data as { storage_key: string } | null)?.storage_key ?? null;
}
