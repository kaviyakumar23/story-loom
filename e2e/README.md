# End-to-end tests (Playwright)

These are true browser tests. They are **separate** from the unit/integration
suite (`npm test`, Vitest) and are **not** run by it.

## First-time setup

```bash
npm install                 # installs @playwright/test (already a devDependency)
npx playwright install      # downloads the browser binaries (~once)
```

## Running

```bash
# Against a locally running app (default http://localhost:3000):
npm run dev                 # in one terminal
npm run test:e2e            # in another

# Against any deployed environment (read-only smoke only):
PLAYWRIGHT_BASE_URL=https://www.moonbell.in npm run test:e2e e2e/landing.spec.ts
```

## What runs where

- **`landing.spec.ts`** — read-only smoke (landing renders, create is invite-gated).
  Safe against **any** environment, including production.
- **`full-flow.spec.ts`** — creates a book, waits for the preview, exercises the
  free tweak. It **mutates data and calls the AI pipeline**, so it is **skipped
  unless `E2E_INVITE_CODE` is set** and must point at a **test environment**, never
  production.

## Test environment for the full flow

Do **not** run the mutating flow against prod. It needs:

1. A **test Supabase project** (or a disposable branch DB) via the app's env.
2. **Mocked/stubbed AI providers** so the pipeline returns quickly and for free
   (e.g. a fake Gemini/OpenAI/ElevenLabs base URL, or a `MODEL_TIER` test stub).
   Otherwise each run spends real image-generation budget.
3. `E2E_INVITE_CODE` set to that environment's `BETA_ACCESS_CODE`.
4. The Inngest dev server running (`npx inngest-cli@latest dev`) so the preview
   pipeline actually executes.

Until that test environment exists, the full-flow spec self-skips — so
`npm run test:e2e` stays green everywhere.
