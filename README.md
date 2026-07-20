# MoonBell / Storyloom — Internal Alpha App

Next.js 16 App Router app for personalized AI children's storybooks. This repo
now contains the web app, API routes, Supabase-backed data layer, and Inngest
generation pipeline in one deployable app.

## Current Alpha Scope

- Parent sign-in via Supabase magic link / Google.
- Attribute-only child intake: no photos, nickname instead of legal name, age
  band instead of DOB.
- Explicit consent before preview generation.
- AI preview pipeline: story text, moderation, character sheet, cover, and first
  pages.
- Wider-beta helpers: curated occasion packs, parent reading guides, expiring
  private preview links, and one capped preview tweak before checkout.
- Dashboard, book polling page, account export/delete, legal drafts, and admin
  API endpoints.
- Alpha measurement: preview events, download clicks, feedback, lifecycle timing,
  admin metrics JSON, and CSV export.
- Optional beta invite gate: set `BETA_ACCESS_CODE` to require a private code
  before any preview generation starts.
- Payment routes exist, but payment/live Razorpay setup is intentionally not
  part of this internal alpha pass.

## Routes

| Route | Purpose |
|---|---|
| `/` | Landing page |
| `/signin`, `/auth/callback` | Parent authentication |
| `/create` | Story intake + consent |
| `/books` | Parent dashboard |
| `/books/[id]` | Preview polling, checkout panel, delivery state |
| `/share/[token]` | Expiring read-only shared preview |
| `/account` | Data export and account deletion |
| `/legal/*` | Draft legal pages |
| `/api/v1/*` | Product API |
| `/api/v1/admin/metrics?days=7` | Admin alpha/ops metrics JSON |
| `/api/v1/admin/metrics/export?days=30` | Admin CSV export for tester review |
| `/api/v1/admin/engine/health` | Admin live engine check for DB, AI providers, moderation, and storage |
| `/api/inngest` | Inngest functions |

## Setup

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Local app: http://localhost:3000

For preview generation, fill at minimum:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`

Keep `NEXT_PUBLIC_PAYMENTS_ENABLED=false` for internal alpha. Set it to `true`
only after the Razorpay flow has been separately validated.

Set `BETA_ACCESS_CODE` in hosted environments before inviting known testers. The
code is validated server-side and grants an HTTP-only browser cookie; `/api/v1/books`
still refuses preview creation without it.

Run Inngest locally in another terminal:

```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

Run migrations when `DATABASE_URL` is set:

```bash
npm run migrate
```

## Validation

```bash
npm run typecheck
npm run build
npm test
```

`npm test` currently runs the TypeScript check. Add route/pipeline unit tests as
the next hardening layer before expanding the beta.

Before inviting testers, run the hosted engine health check with the admin token:

```bash
curl -H "authorization: Bearer $ADMIN_API_SECRET" \
  "$APP_BASE_URL/api/v1/admin/engine/health"
```

It performs one live text probe, one live image probe, moderation checks, and a
temporary private-storage upload/sign/delete. It returns `ok: true` only when the
real preview engine is ready.

## Non-Negotiables

- No child photos.
- Never send a child's real name to AI vendors; use tokenization.
- Consent before processing child details.
- Signed URLs only for generated assets.
- Webhook is source of truth for payment unlocks.
- Parent-scoped queries and RLS defense in depth.
- Data export/delete must work before any wider beta.

## Internal Alpha Checklist

- Configure Supabase and run migrations.
- Configure OpenAI + Gemini.
- Set `BETA_ACCESS_CODE` in Vercel before sharing the app beyond your own device.
- Start app + Inngest and create 5-10 previews with known test users.
- Review `/api/v1/admin/metrics?days=7` and export
  `/api/v1/admin/metrics/export?days=30` before inviting more families.
- Track preview success rate, time to preview, feedback rating, reported issues,
  cost per book, preview saves, share-link usage, tweak requests, and download
  clicks.
- Verify account export/delete, including storage asset deletion.
- Keep payment disabled/untrusted until Razorpay live/test flow is separately
  validated.
- Replace draft legal placeholders before charging money or inviting strangers.

## Measure Before Expanding

Internal alpha should expand only after the measurement loop is healthy:

- Preview success rate is consistently high for known families.
- Average time to preview is acceptable and failed books are reviewed quickly.
- Tester feedback shows parents want the full book, not just the preview.
- Image/story/safety issues are visible in `book_feedback`, not hidden in chats.
- Cost per generated book stays within the target range in admin metrics.
- Download clicks and preview saves show real intent before payment is enabled.
- Share links and one-tweak requests show whether parents are invested enough
  to ask for feedback or improve the preview.

## Add Before Wider Beta

These are now implemented in this repo:

- Occasion packs on `/create` for common parent moments like first day school,
  bedtime independence, new sibling, English practice, moving homes, and reading
  confidence.
- Parent reading guides stored from the story engine output and shown on preview
  pages/shared previews.
- Expiring private preview links with server-side token hashing and revocation.
- One free preview tweak per book, capped before checkout and rerun through the
  same moderated preview pipeline.
- Trust cues on create/preview/share surfaces plus account export/erasure updates
  for the new beta data.
