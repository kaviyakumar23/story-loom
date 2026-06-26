<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Storyloom — Frontend

Next.js 16 (App Router, TypeScript) web app for Storyloom — personalized AI
children's storybooks, India-first. This repo is the **frontend only**; it talks
to the backend API over HTTP.

> The **backend + full product docs, the master checklist (`CHECKLIST.md`), the
> API contract (`API_CONTRACT.md`), and the specialized subagents
> (`.claude/agents/`)** live in the backend repo at
> `/Users/kaviya/products/storyloom`. Read those for the system-wide picture.

## What this app does

Parent journey: sign in → describe the child + pick a story goal → free preview →
checkout (Razorpay) → download. Routes:

| Route | Purpose |
|---|---|
| `/` | Landing |
| `/signin` + `/auth/callback` | Supabase auth (magic link + Google) |
| `/create` | Multi-step form → `POST /consent` + `POST /books` |
| `/books` | Dashboard |
| `/books/[id]` | Poll generation → preview → checkout → download |

## Rules that mirror the backend (don't break)

- **No photos.** Children are described by attributes (skin tone, hair, glasses),
  a **nickname** (not a legal name), and an **age band**.
- **Poll, don't trust callbacks.** Generation and payment unlocking are async —
  poll `GET /books/:id` and `GET /payments/:orderId`. The Razorpay client
  `handler` is a hint; the backend webhook is the source of truth.
- **Consent is explicit** — `POST /consent` only after the parent ticks the box.
- **Signed URLs expire** (~10 min) — re-fetch the book to refresh download links.
- **No secrets in the client.** Only `NEXT_PUBLIC_*` (API URL + Supabase URL/anon
  key). No service-role key, no Razorpay secret.

## Layout

- `src/app/` — routes. `globals.css` = the design system (cream `#FBEFD6`, berry
  `#9C3C6B`, coral `#EE6C45`, Baloo 2 + Hanken Grotesk, sticker buttons). Reuse
  `.btn/.card/.pill/.chip/.input/.eyebrow` — don't invent new styles.
- `src/components/` — `ui` (Sparkle/Icon), `chrome` (Header/Footer).
- `src/lib/` — `types` (mirror of backend `src/types/api.ts` — keep in sync),
  `api` (bearer client), `supabase` + `auth` (session/guard), `razorpay`.

## Run / build

```bash
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL + Supabase URL/anon key
npm install
npm run dev        # http://localhost:3000  (backend must run on :8080 + Inngest dev)
npm run build      # must pass before shipping
```

## Conventions

- TypeScript strict. Client components for interactive/polling pages.
- Handle every status (`generating`/`preview_ready`/`paid`/`complete`/`failed`)
  plus loading/empty/error — never dead-end the parent.
- Commit only when asked; never push without asking. End commit messages with the
  `Co-Authored-By: Claude Opus 4.8 (1M context)` trailer.
