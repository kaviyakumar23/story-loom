import { describe, expect, it } from 'vitest';
import { GET } from './route';

const go = (bookId: string) => GET(new Request(`https://m/r/${bookId}`), { params: Promise.resolve({ bookId }) });

describe('GET /r/:bookId — reorder redirect', () => {
  it('redirects a valid book id to a prefilled create flow', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const res = await go(id);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain(`/create?from=${id}`);
  });

  it('falls back to a fresh create for a junk id', async () => {
    const res = await go('not-a-uuid');
    expect(res.status).toBe(302);
    const loc = res.headers.get('location') ?? '';
    expect(loc).toContain('/create');
    expect(loc).not.toContain('from=');
  });
});
