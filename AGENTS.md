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

- **Optional ephemeral photo, else attributes only; no legal names to vendors.**
  A child photo is OPTIONAL and OFF by default (`NEXT_PUBLIC_PHOTO_LIKENESS_ENABLED`);
  when enabled it is ephemeral — moderated before use, sent once to the image model
  over Vertex only, then deleted (24h hard-cap cron), never printed and never stored
  on the product. `assertPhotoEgressAllowed` (in `src/server/lib/photo-intake.ts`)
  gates every photo egress; that module is the only code that touches raw photo bytes.
  Otherwise: attributes + nickname + age band. `src/server/lib/tokenize.ts` swaps
  the name for `{{HERO}}` before any AI call; text/image egress calls
  `assertNoSensitive` (audio guards non-name PII).
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
npm run rls-check                                  # after any table/RLS change
npm run test:e2e                                   # Playwright (see e2e/README.md)
```

`npm test` = typecheck + vitest unit + integration tests (`src/**/*.test.ts`).
Handle every book status (`generating/preview_ready/paid/complete/failed`) plus
loading/empty/error in UI — never dead-end the parent.

## Conventions

- TypeScript strict; client components only for interactive/polling pages.
- Commit only when asked; never push without asking. End commit messages with a
  `Co-Authored-By: Claude <model name> <noreply@anthropic.com>` trailer crediting
  the model that authored the commit (history mostly uses
  `Claude Opus 4.8 (1M context)`).
