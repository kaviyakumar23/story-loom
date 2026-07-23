import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findOp, makeSupabase, type MockDb } from '../test/supabase-mock';

const h = vi.hoisted(() => ({ db: null as MockDb | null }));
vi.mock('../lib/supabase', () => ({ serviceClient: () => h.db }));
vi.mock('../providers/index', () => ({ resolveModelStamp: () => ({ modelTier: 'cost', textModel: 't', imageModel: 'i', promptVersion: 'v' }) }));

import { pageCountFor, persistStory, PREVIEW_PAGE_COUNT, type BookContext } from './helpers';
import type { Story } from '../providers/types';

describe('pageCountFor', () => {
  it('maps reading level to page count', () => {
    expect(pageCountFor('emerging')).toBe(8);
    expect(pageCountFor('early')).toBe(10);
    expect(pageCountFor('fluent')).toBe(12);
  });
});

describe('persistStory (engine — local name injection + preview flag)', () => {
  beforeEach(() => { h.db = makeSupabase({}); });

  const ctx = { bookId: 'book-1', nickname: 'Aarav' } as BookContext;
  const story: Story = {
    title: "{{HERO}}'s Big Day",
    theme: '{{HERO}} learns to try',
    pages: [
      { index: 0, text: '{{HERO}} took a breath.', illustrationPrompt: 'a calm scene' },
      { index: 4, text: '{{HERO}} smiled.', illustrationPrompt: 'a happy scene' },
    ],
    vocabulary: ['brave'],
    discussionQuestions: ['How did they feel?'],
    activity: 'Draw it',
  };

  it('injects the real name locally and flags only the first pages as preview', async () => {
    await persistStory(ctx, story);
    // Title/theme localized on the book row.
    expect(findOp(h.db!, 'books', 'update')?.values).toMatchObject({ title: "Aarav's Big Day", theme: 'Aarav learns to try' });
    // Pages: name injected, is_preview = index < PREVIEW_PAGE_COUNT.
    const pages = findOp(h.db!, 'book_pages', 'upsert')?.values as Array<{ page_index: number; text: string; is_preview: boolean }>;
    expect(pages[0]).toMatchObject({ page_index: 0, text: 'Aarav took a breath.', is_preview: true });
    expect(pages[1]).toMatchObject({ page_index: 4, text: 'Aarav smiled.', is_preview: 4 < PREVIEW_PAGE_COUNT });
    expect(pages[1].is_preview).toBe(false);
  });
});
