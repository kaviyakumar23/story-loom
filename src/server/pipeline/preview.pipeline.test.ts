import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { handlerOf, makeStep } from '../test/inngest-harness';

vi.mock('@/server/pipeline/client', () => ({ inngest: { createFunction: (_c: unknown, handler: unknown) => ({ handler }) }, EVENTS: {} }));
vi.mock('../lib/cost', () => ({ recordEvent: async () => {}, textCost: () => 0, imageCost: () => 0 }));
vi.mock('../lib/observability', () => ({ captureError: () => {} }));
vi.mock('../providers/index', () => ({
  getProviders: () => ({
    text: {
      generateStory: async () => ({
        value: {
          title: 'T', theme: 'Th',
          pages: Array.from({ length: 10 }, (_, i) => ({ index: i, text: `p${i}`, illustrationPrompt: `ill${i}` })),
          vocabulary: [], discussionQuestions: [], activity: 'a',
        },
        usage: { model: 'm', tokensIn: 1, tokensOut: 1 },
      }),
    },
  }),
}));
vi.mock('./helpers', () => ({
  PREVIEW_PAGE_COUNT: 3,
  pageCountFor: () => 10,
  loadContext: vi.fn(),
  gateText: vi.fn(),
  persistStory: vi.fn(),
  resolveCharacterSheet: vi.fn(),
  renderAndStorePage: vi.fn(),
  setProgress: vi.fn(),
  markLatestRevision: vi.fn(),
  markFailed: vi.fn(),
}));

import { previewPipeline } from './preview';
import * as helpers from './helpers';

const ctx = { bookId: 'book-1', nickname: 'Aarav', interests: [], readingLevel: 'early', imageModel: 'i', textModel: 't' };
const run = () => handlerOf(previewPipeline)({ event: { data: { bookId: 'book-1' } }, step: makeStep() });

describe('previewPipeline (orchestration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (helpers.loadContext as Mock).mockResolvedValue(ctx);
    (helpers.resolveCharacterSheet as Mock).mockResolvedValue({ images: [], palette: [], clothingTokens: [], negativeConstraints: [] });
    (helpers.renderAndStorePage as Mock).mockResolvedValue({ model: 'm', attempts: 1 });
  });

  it('gates the story, then renders the cover + PREVIEW_PAGE_COUNT pages, then marks preview_ready', async () => {
    const out = (await run()) as { status: string };
    expect(out.status).toBe('preview_ready');
    expect(helpers.gateText).toHaveBeenCalledTimes(1); // moderation gate before any image
    expect(helpers.persistStory).toHaveBeenCalledTimes(1);
    expect(helpers.renderAndStorePage).toHaveBeenCalledTimes(4); // 1 cover + 3 preview pages
    expect(helpers.setProgress).toHaveBeenCalledWith('book-1', 100, 'preview_ready');
    expect(helpers.markFailed).not.toHaveBeenCalled();
  });

  it('marks the book failed and rethrows if a stage blows up (e.g. a moderation block)', async () => {
    (helpers.resolveCharacterSheet as Mock).mockRejectedValueOnce(new Error('moderation_blocked'));
    await expect(run()).rejects.toThrow(/moderation_blocked/);
    expect(helpers.markFailed).toHaveBeenCalledWith('book-1', 'preview_failed', expect.stringContaining('moderation_blocked'));
  });
});
