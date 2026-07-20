# MoonBell Redesign — Implementation Plan (Phase 4)

Decisions locked with the founder:
- **Funnel:** anonymous preview → pay to unlock. No account/beta before the reveal. Account + UPI only to save/checkout. Add per-IP rate-limiting + existing moderation to cap AI-spend abuse.
- **Sequence:** Foundation + homepage first → funnel/auth rework → launch states + analytics.
- **Type/brand:** MoonBell kit is source of truth — **Playfair Display** (headings) + **Nunito** (UI/body), Moon Indigo / Bell Gold / Story Coral on Paper Cream.

Principle: **preserve all working backend + generation logic.** Re-skin via tokens (keep CSS variable *names*, change *values*) so the whole app moves to MoonBell without per-component edits. Nothing about the pipeline, Supabase, Razorpay, or Inngest changes in Stage 1.

---

## Existing stack (as-is)
- Next.js 16 App Router, TS strict. Client components for interactive/polling pages.
- Design system in `src/app/globals.css` (semantic CSS vars + utility classes `.btn/.card/.pill/.chip/.input/.eyebrow`). **Re-skin here = whole site re-skins.**
- Chrome in `src/components/chrome.tsx` (Header/Footer); icons in `src/components/ui.tsx` (`Sparkle`, `Icon`, `Uline`).
- Marketing homepage: `src/app/page.tsx` (11 sections).
- Funnel: `src/app/create/page.tsx` (3-step wizard, gated by `useRequireAuth` + `/beta/access`).
- Business identity: `src/lib/business.ts`. Backend brand tokens (email/PDF): `src/server/lib/brand.ts`.

## Reusable components (keep, restyle via tokens)
`.btn`, `.card`, `.pill`, `.chip`, `.input`, `Icon`, funnel step logic, book preview/polling, Razorpay handler. Do **not** rewrite these — they inherit the new palette.

## Risky migrations (flagged)
1. **Auth-after-reveal** (Stage 2): needs an anonymous draft (localStorage + server-side anonymous book row) and moving account creation to save/checkout. Touches `/create`, `/api/v1/books`, consent, and RLS assumptions (a book exists before a parent row). Highest care; isolated to Stage 2.
2. **Font swap**: Playfair on chunky pill buttons looks wrong → buttons/pills/eyebrow move to Nunito; only `.display` headings use Playfair.
3. **Email/PDF brand tokens** (`server/lib/brand.ts`): changing colours could shift `pdf.test.ts` output — do as its own small step with test re-run.

---

## Stage 1 — Foundation + homepage (current)

### 1a. Brand config + tokens + logo  ← this commit
- **NEW `src/lib/brand.ts`** — single source of truth: name, tagline, hero copy, and the one launch product (name, `price: 299`, `₹299`, pages, format, delivery, revision, CTA labels). Everything else imports from here; no hard-coded name/price/product strings.
- **`src/lib/business.ts`** — `brandName` now references `BRAND.name`.
- **`src/app/globals.css`** — remap `:root` to MoonBell palette (same var names); swap `@import` to Playfair Display + Nunito; `--display`→Playfair, `--sans`→Nunito; move `.btn/.pill/.eyebrow` to Nunito; tune `.display` metrics for a serif.
- **NEW `src/components/logo.tsx`** — `<Logo/>` (crescent + bell + star + wordmark) and `<LogoMark/>` (icon only), inline SVG, theme via `currentColor`/tokens.
- **`src/components/chrome.tsx`** — Header/Footer use `<Logo/>` and `BRAND.*` (no literal "MoonBell").
- **`src/app/layout.tsx`** — metadata title/description from `BRAND`; add font `preconnect`.

### 1b. Email/PDF brand parity (small, test-gated)
- **`src/server/lib/brand.ts`** — COLORS/FONTS/`GOOGLE_FONTS_HREF`/mark → MoonBell; re-run `pdf.test.ts`.

### 1c. Homepage rebuild (`src/app/page.tsx` → componentised)
Order per brief: Header → **interactive hero** (nickname → live cover, one-time open) → **sample-book proof** (cover + 2 readable spreads, touch/keys page-turn) → 3 steps → 3 emotional benefits → reactions (honest, no fabrication) → privacy → **one price (₹299)** → FAQ → final CTA → footer.
- New section components under `src/components/landing/*` (HeroCover, SampleBook, Steps, Benefits, Privacy, PriceCard, Faq, FinalCta).
- Remove all alpha/beta/"paused" copy; single CTA verb `BRAND.hero.primaryCta`.
- Art: swap sample images for the founder-supplied cover/spreads (prompts delivered); placeholders until then.
- Motion: one-time hero open, typed name, one page-turn, small scroll-reveals; all respect `prefers-reduced-motion`, no infinite loops, no layout shift.

## Stage 2 — Funnel + anonymous preview  (RISKY — touches auth/consent/payment)

Reality of the current backend (`/api/v1/books` POST): enforces `requireParent`
(auth) **+** `assertBetaAccess` (code) **+** `assertRateLimit`, needs a
`consentId` from `/consent` (also parent-scoped), and rows are parent-scoped
under RLS. So "anonymous preview" is a real rearchitecture, not copy.

**Recommended approach — Supabase anonymous auth (least backend churn):**
- On funnel entry, if no session, `supabase.auth.signInAnonymously()`. The anon
  user IS a `parent` row → `requireParent`, `/consent`, book RLS, and the
  pipeline all keep working unchanged. Consent is captured under the anon user.
- Remove `useRequireAuth` redirect + the beta screen from `/create`; **env-gate
  `assertBetaAccess`** off for production (keep for staging).
- Persist funnel inputs to `localStorage` (survive reload/animation).
- At the reveal → to save/checkout: collect email and **upgrade** the anon user
  to permanent (`updateUser({ email })` + magic-link / `linkIdentity`), which
  preserves the already-generated book. Then Razorpay UPI as today.
- Abuse control: `assertRateLimit` keyed per-IP on anonymous book creation
  (already exists — verify keying); moderation stays fail-closed; keep
  `PREVIEW_DAILY_CAP`.

**Requires ONE founder action:** enable **Anonymous sign-ins** in Supabase
(Auth → Providers). Without it, `signInAnonymously()` fails.

**Risks:** anon→permanent linking must not orphan the book or its consent;
Razorpay/webhook parent-scoping must resolve to the upgraded user; Supabase Auth
redirect URLs must include the current host (already flagged separately). Do as
small commits: (1) env-gate beta + anon sign-in + drop the auth wall; (2) draft
persistence + progress/back-nav; (3) reveal → email-upgrade → checkout.

- States (own commits): loading, generation-progress, generation-failure+retry,
  payment-failure, empty, validation, slow-network, preview-unavailable, mobile
  keyboard, order confirmation, delivery, contact-support.

## Stage 3 — Analytics + hardening
- Events (no child names/sensitive values): landing view, sample-nickname entered, preview CTA, personalisation started, each step complete, preview gen start/complete/fail, checkout view, payment init/complete/fail, preview shared, abandon.
- Cross-browser/mobile/reduced-motion/keyboard/slow-network passes; contrast + image-opt + CLS checks; remove dead styles/components. → `docs/redesign-implementation-report.md`.

---

## Test gates each stage
`npm run typecheck && npm test && npm run build` green before commit. Stage 1c + 2 additionally driven in-browser (mobile widths, keyboard, reduced-motion) before marking done.
