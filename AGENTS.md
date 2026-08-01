<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# MoonBell (repo: story-loom) — full-stack app

Next.js 16 (App Router, TypeScript) app for **MoonBell** (moonbell.in) —
personalized AI children's storybooks, India-first. Since June 2026 this repo is
the **whole product**: web app, `/api/v1/*` route handlers, Supabase data layer,
and the Inngest generation pipeline in one deployable app. (The old separate
backend repo at `~/products/storyloom` is superseded; its docs are historical.)

**The product is currently a narrow paid beta** (plan: 2026-07-31). One
invite-only printed hardcover — 8×8in casebound, 20 interior pages, 12
illustrated — at a tested ₹1,299 vs ₹1,499, capped at 75 stranger orders across
Bengaluru / Mumbai / Delhi-NCR, fulfilled by hand. Everything that is not that
is switched off in `src/server/config/beta-flags.ts` (server) and
`src/lib/beta-flags.ts` (client mirror). Before adding a feature, check whether
the beta deliberately excludes it.

## Map

- `src/app/` — pages + API routes. `globals.css` is the design system (Paper
  Cream `#FFF9F0`, Moon Indigo `#5653C6`, Bell Gold `#F5C85B`, action coral
  `#C9432F`; Playfair Display + Nunito + Caveat, self-hosted via `next/font` in
  `layout.tsx` — never re-add an `@import`). Reuse
  `.btn/.card/.pill/.chip/.input/.eyebrow` — don't invent new styles.
- `src/app/legal/*` — policy pages; business identity comes from
  `src/lib/business.ts` (fill every `[TODO]` before charging money).
- `src/server/` — pipeline (`pipeline/`), providers (`providers/`), config
  (`config/env.ts`, `config/pricing.ts`, `config/beta-flags.ts`,
  `config/beta-geo.ts`), libs (auth, email, razorpay, refunds, metrics, erasure,
  tokenize, funnel).
- **Print** is its own path, separate from the reader's PDF: `print-spec.ts`
  (trim/bleed/safe area/gutter/page plan/PPI floors — the numbers a printer is
  quoted), `print-pdf.ts` (the press file), `casewrap.ts`, `print-preflight.ts`
  (measures a PDF and says whether it is printable; the CLI at
  `scripts/print-preflight.mjs` is the same code). `src/server/lib/pdf.ts` is the
  on-screen copy only. Fonts are checked into `src/server/assets/fonts/` because
  a PDF needs outlines, not woff2.
- `src/lib/types.ts` mirrors `src/server/types/api.ts` — keep in sync (including
  `TIER_META.enabled` ↔ pricing table `enabled`).
- Migrations (through `0023`): `src/server/db/migrations/*.sql` mirrored in
  `supabase/migrations/`. **Production tracks the Supabase CLI history — apply
  with `node scripts/db-apply.mjs <version_name>`, never `npm run migrate`.**
- Observability: `src/server/lib/observability.ts` (`captureError`/`alert`)
  forwards into Sentry (`@sentry/nextjs`, init in `src/instrumentation.ts` +
  `sentry.*.config.ts`). Keep it PII-free — contexts are `{stage, bookId}`.

## Non-negotiables (child safety + payments)

- **No child photos during the beta; attributes only; no legal names to vendors.**
  The photo feature exists but is **OFF**, and off means refused rather than
  hidden: `PHOTO_LIKENESS_SERVER_ENABLED` is read at request time (the
  `NEXT_PUBLIC_` twin is inlined at build and only hides the uploader), the
  upload route rejects before reading a body, `POST /books` rejects a
  `photoUploadId`, and `putPhoto`/`getPhoto`/`assertPhotoEgressAllowed` all throw.
  `src/server/lib/photo-intake.ts` is the only module that touches raw photo
  bytes. Evidence: `photo-off.negative.test.ts`.
  Otherwise: attributes + nickname + age band. `src/server/lib/tokenize.ts` swaps
  the name for `{{HERO}}` before any AI call; text/image egress calls
  `assertNoSensitive` (audio guards non-name PII).
- **The preview is locked.** All page text exists from `preview_ready`, so
  withholding it is a serialisation decision in `mappers.ts`: an unpaid reader
  gets the cover + 3 pages and a count, never `fullStory`. Evidence:
  `preview-lock.api.test.ts`.
- **A person sees every book before it prints.** Fulfilment lands at
  `qc_pending`; releasing goes through `release_to_print`, which names the
  sha256 of the exact file and checks payment in the same transaction.
- **Consent before processing** (`POST /api/v1/consent`, enforced at book create).
- **Moderation fails closed**; blocked images route to human review, never
  auto-deliver.
- **Webhook is the source of truth for payment** — the client Razorpay handler
  only starts polling. Prices come from `src/server/config/pricing.ts` and the
  visitor's assigned arm; never trust a client amount or a client-supplied arm.
  One open order per book is enforced by `uq_orders_open_per_book`; every webhook
  delivery is journalled in `webhook_events` by Razorpay's event id; a refund
  goes through `applyRefundForPayment`, never by setting a status by hand.
- **Signed URLs only** for generated assets (~10 min expiry; re-fetch to refresh).
- **Public copy must stay true.** Page counts, delivery windows and privacy
  claims are load-bearing — `src/lib/brand.ts` is the single source, and the
  privacy policy's collection list must match what the intake actually asks for.
- **Erasure defers, never destroys a live order.** A deletion request while a
  printed order is in flight is parked and completed by the retention cron once
  it is delivered or cancelled. See `docs/retention-matrix.md`.
- **Analytics can only measure behaviour.** `funnel_events` accepts an allowlist
  of event names and a closed property schema with no string field, so a child's
  details cannot reach it. No third-party analytics anywhere.
- Parent-scoped queries + RLS defense in depth; export/erasure must keep working.

## Run / validate

```bash
npm install && cp .env.local.example .env.local   # fill Supabase + AI keys
npm run dev                                        # app on :3000
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest  # pipeline
npm run typecheck && npm test && npm run build     # must pass before shipping
npm run rls-check                                  # after any table/RLS change
npm run test:e2e                                   # Playwright (see e2e/README.md)
npm run print:rfq                                  # regenerate the printer RFQ pack
npm run print:preflight <file.pdf> [--casewrap|--test-form]
```

`npm test` = typecheck + 319 vitest unit + integration tests (`src/**/*.test.ts`).
Story generation runs on **OpenAI `gpt-5.6-sol` via the Responses API**
(`reasoning.effort`, `text.format` json_schema, `max_output_tokens`) — see
`src/server/providers/text/openai.ts`; images run on Gemini over **Vertex**,
authenticated with a service-account key (`GOOGLE_SERVICE_ACCOUNT_KEY`), which
takes precedence over the older keyless WIF vars.
Handle every book status (`generating/preview_ready/paid/complete/failed`) plus
loading/empty/error in UI — never dead-end the parent.

## Conventions

- TypeScript strict; client components only for interactive/polling pages.
- Commit only when asked; never push without asking. End commit messages with a
  `Co-Authored-By: Claude <model name> <noreply@anthropic.com>` trailer crediting
  the model that authored the commit (history mostly uses
  `Claude Opus 4.8 (1M context)`).
- Intake collects: nickname, age band, reading level, optional pronouns (blank ⇒
  they/them, never inferred), up to 3 personality traits, up to **3** interests,
  a dedication (printed in the front matter), the parent's email, and appearance
  where **hair is three orthogonal facets**
  (`hairLength`/`hairTexture`/`hairStyle`) — the legacy single `hair` field is
  still accepted for pre-split heroes. `gender` and `personality` ride inside the
  hero's `avatar` JSON, so neither needed a migration. The free-form theme is
  gone; every book is a fixed 12 illustrated pages.
