import { expect, test } from '@playwright/test';

/**
 * Photo-likeness OFF posture — read-only, safe against any environment
 * (including production, where both photo flags are false).
 *
 * The flag-ON section at the bottom is SKIPPED unless E2E_PHOTO_ENABLED is set;
 * it exists for a future staging environment with the feature switched on and
 * must never run against production.
 */
test.describe('photo likeness (flags off)', () => {
  test.skip(!!process.env.E2E_PHOTO_ENABLED, 'environment has photos enabled — the off-posture does not apply');

  test('the upload API refuses before anything else — even unauthenticated', async ({ request }) => {
    // Server-side flag check runs before auth and before the body is read, so
    // an anonymous, empty POST proves the refusal without touching real data.
    const res = await request.post('/api/v1/heroes/photo', { multipart: {} });
    expect(res.status()).toBe(403);
    const body = (await res.json()) as { error?: { message?: string } };
    expect(body.error?.message ?? '').toMatch(/photo likeness is not enabled/i);
  });

  test('the landing page carries the no-child-photos trust posture', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/no child photo/i).first()).toBeVisible();
  });
});

// Only for a staging environment with BOTH photo flags on. Mutates nothing by
// itself (it stops at the uploader UI), but the uploader only renders when the
// build was made with NEXT_PUBLIC_PHOTO_LIKENESS_ENABLED=true.
test.describe('photo likeness (flags on — staging only)', () => {
  test.skip(!process.env.E2E_PHOTO_ENABLED, 'set E2E_PHOTO_ENABLED against a photo-enabled staging build');

  test('the create flow offers the optional uploader with honest copy', async ({ page }) => {
    await page.goto('/create');
    if (process.env.E2E_INVITE_CODE) {
      const gate = page.getByPlaceholder(/invite code/i);
      if (await gate.isVisible().catch(() => false)) {
        await gate.fill(process.env.E2E_INVITE_CODE);
        await page.getByRole('button', { name: /unlock|continue/i }).click();
      }
    }
    await expect(page.getByText(/used once.*then deleted|once.*deleted/i).first()).toBeVisible();
    await expect(page.getByText(/optional/i).first()).toBeVisible();
  });
});
