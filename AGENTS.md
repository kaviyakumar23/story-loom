<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Plumtale (repo: story-loom) — full-stack app

Next.js 16 (App Router, TypeScript) app for **Plumtale** (plumtale.com) —
personalized AI children's storybooks, India-first. Since June 2026 this repo is
the **whole product**: web app, `/api/v1/*` route handlers, Supabase data layer,
and the Inngest generation pipeline in one deployable app. (The old separate
backend repo at `~/products/storyloom` is superseded; its docs are historical.)

## Map

- `src/app/` — pages + API routes. `globals.css` is the design system (cream
  `#FBEFD6`, berry `#9C3C6B`, coral `#EE6C45`, Baloo 2 + Hanken Grotesk). Reuse
  `.btn/.card/.pill/.chip/.input/.eyebrow` — don't invent new styles.
- `src/app/legal/*` — policy pages; business identity comes from
  `src/lib/business.ts` (fill every `[TODO]` before charging money).
- `src/server/` — pipeline (`pipeline/`), providers (`providers/`), config
  (`config/env.ts`, `config/pricing.ts`), libs (auth, email, razorpay, metrics,
  erasure, tokenize).
- `src/lib/types.ts` mirrors `src/server/types/api.ts` — keep in sync (including
  `TIER_META.enabled` ↔ pricing table `enabled`).
- Migrations: `src/server/db/migrations/*.sql` (runner: `npm run migrate`,
  needs `DATABASE_URL`) mirrored in `supabase/migrations/` for `supabase db push`.

## Non-negotiables (child safety + payments)

- **No photos; no legal names to vendors.** Attributes + nickname + age band;
  `src/server/lib/tokenize.ts` swaps the name for `{{HERO}}` before any AI call
  and every provider calls `assertNoSensitive` before egress.
- **Consent before processing** (`POST /api/v1/consent`, enforced at book create).
- **Moderation fails closed**; blocked images route to human review, never
  auto-deliver.
- **Webhook is the source of truth for payment** — the client Razorpay handler
  only starts polling. Prices come from `src/server/config/pricing.ts`; never
  trust client amounts.
- **Signed URLs only** for generated assets (~10 min expiry; re-fetch to refresh).
- Parent-scoped queries + RLS defense in depth; export/erasure must keep working.

## Run / validate

```bash
npm install && cp .env.local.example .env.local   # fill Supabase + AI keys
npm run dev                                        # app on :3000
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest  # pipeline
npm run typecheck && npm test && npm run build     # must pass before shipping
```

`npm test` = typecheck + vitest unit tests (`src/**/*.test.ts`). Handle every
book status (`generating/preview_ready/paid/complete/failed`) plus
loading/empty/error in UI — never dead-end the parent.

## Conventions

- TypeScript strict; client components only for interactive/polling pages.
- Commit only when asked; never push without asking. End commit messages with
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
