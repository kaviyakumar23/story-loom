import { signAsset } from './storage';
import { serviceClient } from './supabase';
import type {
  Book,
  BookListItem,
  BookStatus,
  Goal,
  Language,
  PreviewPage,
  ReadingLevel,
  Tier,
} from '../types/api';

/** A `books` row as returned by Supabase. */
export interface BookRow {
  id: string;
  status: BookStatus;
  progress: number;
  goal: Goal;
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
 */
export async function toBook(row: BookRow): Promise<Book> {
  const book: Book = {
    id: row.id,
    status: row.status,
    progress: row.progress,
    goal: row.goal,
    language: row.language,
    readingLevel: row.reading_level,
    title: row.title,
    theme: row.theme,
    purchasedTier: row.purchased_tier,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    error: row.error,
  };

  if (row.status === 'preview_ready') {
    book.preview = { pages: await loadPreviewPages(row.id) };
  }

  if (row.status === 'paid' || row.status === 'complete') {
    const assets = await loadDeliveryAssets(row.id);
    book.pdfUrl = assets.pdf ? await signAsset(assets.pdf) : null;
    book.audioUrl = assets.audio ? await signAsset(assets.audio) : null;
  }

  return book;
}

async function loadPreviewPages(bookId: string): Promise<PreviewPage[]> {
  const { data: pages } = await serviceClient()
    .from('book_pages')
    .select('page_index, text, image_asset_id')
    .eq('book_id', bookId)
    .eq('is_preview', true)
    .order('page_index', { ascending: true });
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
