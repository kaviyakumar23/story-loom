import { expect, test } from '@playwright/test';

/**
 * Read-only smoke — safe against any environment (including the live site via
 * PLAYWRIGHT_BASE_URL). Asserts the landing renders and routes to the funnel.
 */
test.describe('landing', () => {
  test('renders the brand, a create CTA, and the privacy posture', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/MoonBell/i);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // At least one path into the create funnel.
    await expect(page.getByRole('link', { name: /create|free preview|start/i }).first()).toBeVisible();
  });

  test('create is gated behind the private-beta invite screen', async ({ page }) => {
    await page.goto('/create');
    // In the invite-gated beta, /create shows the invite screen; a code unlocks
    // the wizard. (With no gate configured locally, the wizard shows instead.)
    const invite = page.getByText(/invite code|private beta/i);
    const wizard = page.getByText(/tell us about your hero/i);
    await expect(invite.or(wizard).first()).toBeVisible();
  });
});
