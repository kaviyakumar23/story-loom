import { describe, expect, it } from 'vitest';
import { redact } from './observability';

describe('redact (log PII scrub)', () => {
  it('scrubs emails and phone/long-id runs from strings', () => {
    expect(redact('reach parent@example.com now')).toBe('reach [email] now');
    expect(redact('call +91 98765 43210')).toContain('[phone/id]');
  });

  it('walks objects and arrays', () => {
    expect(redact({ a: 'x@y.co', b: ['ping z@w.io'] })).toEqual({ a: '[email]', b: ['ping [email]'] });
  });

  it('leaves clean telemetry untouched', () => {
    expect(redact({ stage: 'preview', bookId: 'abc-123', attempt: 2 })).toEqual({
      stage: 'preview',
      bookId: 'abc-123',
      attempt: 2,
    });
  });
});
