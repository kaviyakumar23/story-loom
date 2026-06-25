# Storyloom — Frontend

Next.js (App Router) web app for the personalized AI storybook product. Implements
the Storyloom design system and wires the full parent journey to the backend API.

- **Stack:** Next.js 16 (App Router, TypeScript), Supabase auth, Razorpay Checkout.
- **Design:** ported from the Claude Design handoff — warm storybook palette, Baloo 2
  display + Hanken Grotesk, chunky sticker buttons (see `src/app/globals.css`).
- **Backend contract:** types in `src/lib/types.ts` mirror the backend's
  `API_CONTRACT.md`. The app calls `NEXT_PUBLIC_API_URL` with the parent's Supabase
  bearer token.

## Routes

| Route | Purpose |
|---|---|
| `/` | Landing (marketing, free-preview CTA) |
| `/signin` | Parent sign-in (magic link + Google) → `/auth/callback` |
| `/create` | Multi-step form → `POST /consent` + `POST /books` |
| `/books` | Dashboard (the parent's books) |
| `/books/[id]` | Poll generation → preview → checkout (Razorpay) → download |

## Setup

1. `npm install`
2. `cp .env.local.example .env.local` and fill in:
   - `NEXT_PUBLIC_API_URL` — the backend `/api/v1` URL (e.g. `http://localhost:8080/api/v1`)
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the **same**
     Supabase project the backend uses (anon key, safe for the browser)
3. `npm run dev` → http://localhost:3000

### Wiring it to the backend (do these once)
- **CORS:** add the frontend origin to the backend's `CORS_ORIGINS`
  (e.g. `http://localhost:3000`).
- **Supabase Auth redirect:** in Supabase → Authentication → URL Configuration,
  add `http://localhost:3000/auth/callback` (and your prod URL) to the redirect
  allow-list, and set the Site URL.
- **Razorpay:** no frontend key needed — the `keyId` comes from the backend's
  `POST /payments/order` response; the Checkout script is loaded on demand.

## Key conventions (matching the backend)

- **No photos.** Children are described by attributes (skin tone, hair, glasses),
  a nickname (not a legal name), and an age band — a deliberate privacy choice.
- **Polling, not callbacks.** Generation and payment unlocking are async; the app
  polls `GET /books/:id` and treats the Razorpay client callback as a hint only —
  the backend webhook is the source of truth.
- **Signed URLs expire** (~10 min) — the book page re-fetches to refresh them.
- **Consent is explicit** — `POST /consent` is sent only after the parent ticks
  the consent box on the review step.

## Design reconciliation note

The original design mock assumed photo upload + printed/shipped books priced in £.
This app is wired to the **actual backend**: attributes-only (no photos), digital
tiers (`pdf` / `pdf_audio_guide` / `seven_day_pack`) priced in **INR**, with
Supabase auth required (the mock said "no account"). The visual language is kept;
the data model and flow follow the backend, which is the source of truth.
