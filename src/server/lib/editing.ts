import { z } from 'zod';
import { badRequest, conflict, forbidden, notFound } from './errors';
import { serviceClient } from './supabase';

/**
 * Shared guard for the post-purchase page-edit endpoints. Confirms the parent
 * owns the book, it's in the editable window (complete, and — for a physical
 * order — printing hasn't started), and the target page exists.
 */
export interface EditableTarget {
  bookId: string;
  pageIndex: number;
  purchasedTier: string | null;
  renderCredits: number;
}

export async function loadEditableTarget(
  bookId: string,
  indexRaw: string,
  parentId: string,
): Promise<EditableTarget> {
  if (!z.string().uuid().safeParse(bookId).success) throw badRequest('Invalid book id');
  const pageIndex = Number.parseInt(indexRaw, 10);
  if (!Number.isInteger(pageIndex) || pageIndex < 0) throw badRequest('Invalid page index');

  const db = serviceClient();
  const { data: book } = await db
    .from('books')
    .select('id, parent_id, status, purchased_tier, render_credits, deleted_at')
    .eq('id', bookId)
    .maybeSingle();
  const b = book as
    | { id: string; parent_id: string; status: string; purchased_tier: string | null; render_credits: number; deleted_at: string | null }
    | null;
  if (!b || b.deleted_at) throw notFound('Book not found');
  if (b.parent_id !== parentId) throw forbidden();
  if (b.status !== 'complete') throw badRequest('You can make changes once your book is ready.');

  // A physical order can be edited only until the founder starts printing it.
  const { data: f } = await db
    .from('fulfillments')
    .select('status')
    .eq('book_id', bookId)
    .eq('kind', 'print')
    .maybeSingle();
  const fStatus = (f as { status: string } | null)?.status;
  if (fStatus && fStatus !== 'print_ready') {
    throw conflict('We’ve already started printing this book, so it can’t be changed now.');
  }

  const { data: page } = await db
    .from('book_pages')
    .select('page_index')
    .eq('book_id', bookId)
    .eq('page_index', pageIndex)
    .maybeSingle();
  if (!page) throw notFound('Page not found');

  return { bookId, pageIndex, purchasedTier: b.purchased_tier, renderCredits: b.render_credits ?? 0 };
}
