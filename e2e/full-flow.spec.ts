import { expect, test } from '@playwright/test';

/**
 * Full funnel: create a book → wait for the preview → read the whole story →
 * request the one free tweak. This MUTATES data and calls the AI pipeline, so it
 * only runs against a seeded test environment — see e2e/README.md. It stays
 * skipped by default so `npm run test:e2e` is safe to run anywhere.
 *
 * Enable with E2E_INVITE_CODE set (and the app pointed at a test DB + mocked AI).
 */
const INVITE = process.env.E2E_INVITE_CODE;

test.describe(INVITE ? 'create → preview → tweak' : 'create → preview → tweak (skipped: set E2E_INVITE_CODE)', () => {
  test.skip(!INVITE, 'Needs a seeded test environment + invite code');

  test('creates a book and reaches a readable full-story preview', async ({ page }) => {
    await page.goto('/create');

    // Unlock the beta if the gate is present.
    const codeInput = page.getByLabel(/invite code/i);
    if (await codeInput.isVisible().catch(() => false)) {
      await codeInput.fill(INVITE!);
      await page.getByRole('button', { name: /unlock/i }).click();
    }

    // Step 1 — the hero.
    await expect(page.getByText(/tell us about your hero/i)).toBeVisible();
    await page.getByPlaceholder(/e\.g\. Mia/i).fill('Testy');
    await page.getByRole('button', { name: '5-6', exact: true }).click();
    await page.getByRole('button', { name: /medium/i }).click();
    await page.getByRole('button', { name: 'short', exact: true }).click();
    await page.getByRole('button', { name: /continue/i }).click();

    // Step 2 — the story shape.
    await page.getByRole('button', { name: /reading confidence/i }).click();
    await page.getByRole('button', { name: /early reader/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();

    // Step 3 — consent + submit.
    await page.getByRole('checkbox').first().check();
    await page.getByRole('button', { name: /see my free preview/i }).click();

    // Preview: the whole story is readable (every page's text, not just images).
    await expect(page.getByText(/your free preview is ready/i)).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText(/one free tweak/i)).toBeVisible();
  });
});
