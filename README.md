# MoonBell (repo: story-loom)

Next.js 16 App Router app for **MoonBell** (moonbell.in) — personalised AI
children's storybooks, India-first. This repo is the whole product: web app,
`/api/v1/*` route handlers, Supabase data layer, and the Inngest generation
pipeline in one deployable app (Vercel).

**The product:** a personalised printed hardcover (₹999, founder-fulfilled —
printed and shipped in ~7 days across India) with an instant digital PDF
companion. Parents see a free preview first and pay only if they love it.

**Current stage:** invite-gated beta (`BETA_ACCESS_CODE`). Payments are fully
built but OFF (`NEXT_PUBLIC_PAYMENTS_ENABLED=false`) pending Razorpay
activation; the print/fulfilment flow is live behind it.

## How the funnel works

1. **Anonymous, invite-gated entry** — a parent lands on `/create`, enters the
   invite code, and gets an anonymous Supabase session (no signup friction).
   Email sign-in (`/signin`) is the account-upgrade/return path.
2. **Intake + consent** — nickname (never a legal name), age band (never a DOB),
   appearance attributes, interests, occasion pack or custom theme, reading
   level. Explicit parental consent is recorded and enforced at book creation.
   An optional child photo is off by default (see Non-negotiables).
3. **Preview** (`previewPipeline`) — ONE structured text call writes the whole
   story (8/10/12 pages by reading level) → text moderation gate → character
   sheet (3 anchored views, cached per hero) → cover + first 3 page renders,
   each image-moderated. The preview shows the FULL story text with the
   remaining pages "illustrated when you order".
4. **Steering** — one free whole-preview tweak before checkout.
5. **Checkout** — server-priced Razorpay order (never client amounts); physical
   orders require a shipping address; optional gift message printed on the
   bookplate. The webhook is the source of truth: it marks paid, grants 3
   render credits, stamps the series number, and triggers fulfilment.
6. **Fulfilment** (`fulfillmentPipeline`) — renders the remaining pages,
   assembles the print-quality PDF (8×8", closing bookplate with "Book N in
   {name}'s MoonBell Adventures" + gift dedication), optional audio, delivers
   the digital instantly, and queues the print job for the founder at
   `/admin/fulfillments` (print → ship → track → delivered emails).
7. **Post-purchase editing** (`applyBookEdit`) — parents can edit any page's
   words (free, strictly moderated) or re-illustrate a page (3 included render
   credits; blocked renders keep the old image and refund the credit) until the
   founder starts printing.
8. **Retention** — per-child bookshelf with series numbers, `/r/[bookId]` QR
   reorder link, and consent-gated occasion/birthday/sibling reminder emails.

## Inngest functions (8)

| Function | Trigger | Purpose |
|---|---|---|
| `previewPipeline` | book created | story → gates → character sheet → preview renders |
| `fulfillmentPipeline` | payment webhook | remaining pages → PDF → deliver → print queue |
| `applyBookEdit` | page edit/regen | re-render one page / rebuild PDF, never re-emails |
| `reconcilePaidBooks` | cron */15m | re-enqueues paid-but-stuck books (leased) |
| `retentionPurge` | cron daily | purges expired unpurchased previews + orphan heroes |
| `previewWinback` | cron daily | one-shot win-back email (consent-gated) |
| `occasionNudges` | cron daily | festival/birthday/sibling reorder nudges (consent-gated) |
| `photoIntakePurge` | cron hourly | 24h TTL backstop on the ephemeral photo bucket |

## Routes

Pages: `/` (landing) · `/create` · `/books` (per-child bookshelf) ·
`/books/[id]` (preview/checkout/delivered + editing) · `/share/[token]` ·
`/account` (export/delete) · `/signin` + `/auth/callback` · `/legal/*` ·
`/admin/fulfillments` (founder print queue) · `/r/[bookId]` (QR reorder redirect).

API (`/api/v1`): `books` (+`[id]`, `events`, `feedback`, `pages/[index]`
(+`regenerate`), `reuse`, `revisions`, `share`) · `consent` · `beta/access` ·
`payments/order` + `payments/webhook` + `payments/[orderId]` · `heroes/photo` +
`heroes/[id]/likeness` · `account/export` + `account/delete` · `newsletter` ·
`marketing/unsubscribe` · admin: `fulfillments` (+`[id]`), `orders/[id]/refund`,
`books/[id]/rerun` + `deliver`, `review-queue`, `metrics` (+`export`),
`engine/health` · `/api/inngest`.

## Setup

```bash
npm install
cp .env.local.example .env.local
npm run dev                                              # app on :3000
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest  # pipeline
```

Minimum env for local preview generation: the Supabase vars
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), `OPENAI_API_KEY` (stories on
the quality tier + moderation, always), and Gemini — locally either
`GEMINI_API_KEY` (AI Studio backend) or Google ADC; **production uses Vertex AI
with keyless WIF** (`GOOGLE_CLOUD_PROJECT`, `GOOGLE_WORKLOAD_IDENTITY_AUDIENCE`,
etc. — see `src/server/config/env.ts`). Payments additionally need the three
`RAZORPAY_*` vars; admin endpoints need `ADMIN_API_SECRET`.

Migrations (through `0016`) live in `src/server/db/migrations/` and are mirrored
in `supabase/migrations/`. Production tracks the Supabase CLI history — apply
with `node scripts/db-apply.mjs <version_name>`, not `npm run migrate`.

## Validation

```bash
npm test          # typecheck + 186 vitest tests (unit + integration + engine + crons + pipelines)
npm run build     # production build
npm run rls-check # 60-assertion RLS audit against the live DB (after any table change)
npm run test:e2e  # Playwright: landing smoke runs anywhere; full flow needs a test env (e2e/README.md)
```

Before inviting testers, run the hosted engine health check:

```bash
curl -H "authorization: Bearer $ADMIN_API_SECRET" \
  "$APP_BASE_URL/api/v1/admin/engine/health"
```

It performs a live text probe, image probe, moderation checks, and a temporary
private-storage upload/sign/delete; `ok: true` means the engine is ready.

## Non-negotiables

- Child photos are optional and OFF by default (`NEXT_PUBLIC_PHOTO_LIKENESS_ENABLED`);
  when enabled they are ephemeral — moderated before use, single Vertex-only
  egress, deleted within minutes (24h hard cap) — never printed or stored. All
  public copy about photos is flag-aware and flips with the same switch.
- Never send a child's real name to AI vendors; tokenization (`{{HERO}}`) +
  `assertNoSensitive` before egress.
- Consent before processing child details; marketing emails additionally require
  opt-in (`canSendMarketing`) and carry one-click unsubscribe (RFC 8058).
- Moderation fails closed at every gate (input, story text, every rendered image,
  page edits); blocked content routes to human review, never auto-delivers.
- Webhook is the source of truth for payment; prices are server-side only.
- Signed URLs only for generated assets (~10 min expiry).
- Parent-scoped queries + RLS defense in depth; export/erasure must keep working
  (including the ephemeral photo bucket).

## Launch runbook (what's left)

- Fill every `[TODO]` in `src/lib/business.ts` (legal identity — clears the
  draft banner; required for Razorpay activation review).
- Razorpay activation day: set live `RAZORPAY_KEY_ID`/`KEY_SECRET`/`WEBHOOK_SECRET`,
  configure the webhook (`/api/v1/payments/webhook`; events `payment.captured`,
  `payment.failed`, `refund.processed`), then set
  `NEXT_PUBLIC_PAYMENTS_ENABLED=true` and REDEPLOY (build-time var).
- Confirm `EMAIL_FROM` is a verified moonbell.in sender in Resend.
- Add `SENTRY_DSN` for error monitoring; consider an Inngest plan upgrade
  (account cap 5 concurrent runs vs configured 4/3/2).
- Build free-generation abuse controls BEFORE removing the invite gate.
- Re-run `npm run rls-check` once real beta rows exist (behavioural isolation is
  vacuous on empty tables).
