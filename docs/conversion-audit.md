# MoonBell — Ruthless Conversion Audit

**Audited:** live site `https://story-loom-mocha.vercel.app/` + source (`src/app/page.tsx`, `src/app/create/page.tsx`, `src/app/globals.css`, `src/components/chrome.tsx`).
**Lens:** Does a cold Instagram parent understand the product in 5s, *feel* the personalization before committing, and reach a paid book without friction or doubt?
**Verdict:** The homepage is competent and warm, but the funnel is built like an internal alpha tool, not a gift shop. Three separate walls (sign-in → beta code → consent) sit *before* any value. Two of the three price cards say "Coming soon." The hero shows a stock-style lifestyle image, not the child-as-hero product. **We are actively teaching qualified buyers to leave.**

> Money model for this doc: every friction step before the emotional payoff roughly halves the pool that reaches it. Fix order below is by rupees lost, not by effort.

---

## TL;DR — the five things bleeding the most money

1. **Registration + beta-code wall before the personalization** (`create/page.tsx:55, 199`). The hero CTA leads to sign-in, *then* a beta code, *then* child details. The emotional payoff (seeing their kid as the hero) is buried behind two accounts' worth of friction. **This is the whole ballgame.**
2. **"Private alpha / Built for known-family testing" framing + "Checkout is paused"** (`page.tsx:81, 97, 258, 305`). We tell every visitor the product isn't real yet and they can't buy. Purchase intent → 0.
3. **Three pricing tiers, two marked "Coming soon"** (`page.tsx:57–61`). Choice paralysis + "unfinished" signal, right where we should be closing.
4. **Static hero image, zero interactive personalization.** The single most persuasive thing we own — the child's name on a book — is never demonstrated. The brief's "type a nickname, watch the cover change" is absent.
5. **No product and no proof.** No readable spreads, no page-turn, no real reactions. "Sample spreads" are three 4:3 crops. Parents can't judge story/illustration quality — the #1 reason they hesitate to pay.

---

## 1. Critical conversion blockers

### 1.1 The preview is behind a sign-in wall
- **What's wrong:** `/create` calls `useRequireAuth()` (`create/page.tsx:55`) which redirects unauthenticated visitors to `/signin` (`lib/auth.tsx:52`). So "Create your free preview" → magic-link/Google sign-in *before* the parent types anything about their child.
- **Why it costs money:** You are asking a cautious parent to hand over an account to a brand they met 20 seconds ago on Instagram, with nothing shown in return. Expect 60–80% drop at this step. It also contradicts the core promise ("see it free before you pay").
- **Exact replacement:** Move auth to *after* the emotional reveal. Flow: child details → goal → generate cover + opening spread → **reveal** → *then* "Save your preview — enter your email/UPI to unlock the full book." Persist the in-progress form in `localStorage` so nothing is lost across the auth step. Create the parent account silently at first save (magic link) or at checkout.
- **Impact:** Highest in the doc. Expect a step-change in preview-starts and preview-completions.
- **Effort:** L (touches routing, an anonymous draft model, and where the account is created). Worth every hour.

### 1.2 A second wall: the beta-access code
- **What's wrong:** After auth, `/create` gates on `/beta/access` and renders a "Private beta — enter your beta code" screen (`create/page.tsx:199–212`) unless unlocked.
- **Why it costs money:** Even a determined parent who signed in now hits a velvet rope. For a public launch this is a hard stop for ~100% of organic traffic.
- **Exact replacement:** For launch, remove the beta gate from the public funnel (keep it behind an env flag for staging). If you must throttle, throttle *previews per IP/day*, not access to the product.
- **Impact:** Critical for any paid traffic.
- **Effort:** S.

### 1.3 The site announces it isn't a real product
- **What's wrong:** Hero eyebrow "PRIVATE ALPHA FOR FIRST FAMILIES" (`page.tsx:81`), "Built for known-family testing" (`:97`), pricing "Checkout is paused during the internal alpha" (`:258`), "payment checkout comes after quality validation" (`:305`), social-proof section literally titled "Ready for a small circle of first families" (`:238`).
- **Why it costs money:** Every one of these tells a buyer "don't get attached, you can't have it." It nukes urgency and trust simultaneously.
- **Exact replacement:** Remove all alpha/beta language from public pages. Replace the eyebrow with a benefit or proof ("Personalised in minutes · No photos"). Turn on a single real purchase path (see 1.4). Gate *incomplete* features by simply not showing them.
- **Impact:** Very high.
- **Effort:** S (copy) + M (enable one checkout path).

### 1.4 Pricing shows two products you can't buy
- **What's wrong:** Three tiers, two tagged "Coming soon" (`page.tsx:57–61`); the whole section is a teaser with no buy action.
- **Why it costs money:** The brief nails it — never show "coming soon" cards beside the thing you're selling. It splits attention, invites "I'll wait for the audio version," and reads as unfinished.
- **Exact replacement:** One product, one price, one button. **Personalised Digital Storybook — ₹299**, 16–20 pages, personalised cover, downloadable PDF, one free revision, delivered in minutes. The post-preview CTA becomes **"Unlock the complete story — ₹299."** Park audio/print/story-pack on a roadmap note or an email-capture, never as sibling price cards.
- **Impact:** High.
- **Effort:** S–M.

### 1.5 The hero never demonstrates personalization
- **What's wrong:** Hero is a static `Image` of a mother/child reading (`page.tsx:104–112`). Nothing shows the child's *own* name/appearance on a book.
- **Why it costs money:** The one "aha" that sells this category — *that's my kid on the cover* — is invisible above the fold. We're describing the magic instead of doing it.
- **Exact replacement:** Interactive hero: an animated book cover with a nickname input. Default "Aarav"; as the parent types, the title re-renders ("**{Name}** and the Star That Listens"). Gentle one-time open animation. No account required to play. This *is* the pitch.
- **Impact:** Very high (comprehension + emotional hook in <5s).
- **Effort:** M.

---

## 2. High-impact improvements

### 2.1 Show the actual product: readable spreads + page-turn
- **Wrong:** "Sample spreads" are three 4:3 image crops with captions (`page.tsx:189–204`); no interior text, no page-turn, no sense of a *book*.
- **Why:** Parents buy story + art quality. If they can't read a page and see character consistency, they assume the worst and don't pay.
- **Replacement:** One finished cover + at least two full, readable spreads with visible story text and a consistent hero. A lightweight, swipeable page-turn that works with touch + keyboard. Caption the format: "16–20 pages · PDF · character stays consistent across every page."
- **Impact:** High. **Effort:** M.

### 2.2 Kill the lifestyle stock hero, sell the object
- **Wrong:** The hero photo-illustration reads as a mood board, not a deliverable.
- **Replacement:** Lead with a rendered *book* — cover + a peek of an inside spread — that visibly carries a name. Lifestyle imagery can support lower down, never as the primary above-the-fold proof.
- **Impact:** High. **Effort:** S once art exists (see image prompts).

### 2.3 Single, obvious CTA language everywhere
- **Wrong:** CTAs vary: "Create free preview" (header), "Create your free preview", "Start with a free preview", "Start with a free preview" (`chrome.tsx`, `page.tsx:90, 303, 366`).
- **Replacement:** One primary verb sitewide: **"Create their free preview."** Secondary everywhere: **"See a sample book."** Consistency compounds trust and reduces micro-decisions.
- **Impact:** Med. **Effort:** S.

### 2.4 Collapse the section sprawl
- **Wrong:** 11 stacked full-bleed bands (hero, trust, how, features×6, spreads, occasions×5, social, pricing×3, privacy, faq, final CTA). It's long, repetitive (features and occasions overlap heavily), and delays the reveal CTA.
- **Replacement:** Follow the briefed order: Header → interactive hero → sample-book proof → 3 steps → emotional benefits (3, not 6) → real reactions → privacy → one price → FAQ → final CTA. Merge Features + Occasions into one "why parents love it" block.
- **Impact:** Med–High. **Effort:** M.

### 2.5 Progress + back-nav in the funnel without data loss
- **Wrong:** The 3-step wizard exists (`create/page.tsx`) but state lives in component memory; an auth redirect or refresh wipes it.
- **Replacement:** Persist funnel state to `localStorage`, show a step indicator, allow back without loss. Essential once auth moves later.
- **Impact:** Med. **Effort:** S–M.

---

## 3. Trust & credibility issues

- **3.1 Zero social proof.** No testimonials, no faces, no "loved by N families." The brand kit even shows "Trusted by 10,000+ families" — but the live site says "small circle of first families." **Fix:** add 3–4 real, attributed parent reactions (photo optional, city + child age) once you have them; until then, use honest specifics ("Made by parents in Bengaluru", "Every book reviewed for safety"). Never fabricate counts or testimonials.
- **3.2 Privacy is told, not shown at the point of fear.** The privacy section is strong (`page.tsx:311–339`) but sits far below the fold; the moment of doubt is *when asked for child details*. **Fix:** put a one-line reassurance directly under the child-details form ("No photos. A nickname, not a real name. Delete anytime.") with a link to the policy.
- **3.3 Brand mismatch = "vibe-coded" tell.** Live site still reads "Plumtale" and uses a cream/berry palette that doesn't match the MoonBell indigo/gold kit. Inconsistent brand is the fastest way to look unfinished. **Fix:** ship the MoonBell tokens + logo (Phase 3/4).
- **3.4 No pricing transparency in currency at the decision point.** "From ₹299" is fine, but the buyer never sees a clean "₹299 · UPI & cards · instant PDF" line near the purchase. **Fix:** show it at the reveal and at checkout.
- **3.5 No delivery expectation.** "ready in minutes" appears once; a gift-buyer needs certainty ("Delivered to your account in ~2 minutes; download anytime"). **Fix:** state timeline at hero, price, and confirmation.

---

## 4. Mobile problems (from responsive CSS + render)

- **4.1 Hero image is a fixed `aspect-ratio: 1` card** (`page.tsx:104`). On a 390px phone it eats most of the first screen and can push the CTA below the fold. **Fix:** on mobile, cap hero media height and keep the CTA + trust line above the fold.
- **4.2 Long single-column scroll.** All grids collapse to 1 col (`globals.css:226`); with 11 bands that's a very long thumb-marathon before price. **Fix:** the section cull in 2.4 matters more on mobile.
- **4.3 Sticky header + backdrop-blur** (`globals.css:172`) on mid-range Android can jank on scroll. **Fix:** test on real Android Chrome; drop blur to a solid translucent fill if it stutters.
- **4.4 Tap targets / chunky shadows.** Sticker buttons use `translateY` on `:active` with hard shadows — fine, but verify 44px min targets on chips in the funnel (`.chip` padding 10×15 is borderline).
- **4.5 Keyboard behaviour in funnel unverified.** Nickname/interest inputs must not be covered by the Android keyboard; the review/consent CTA must stay reachable. **Fix:** scroll-into-view on focus; sticky continue bar.

---

## 5. Visual-quality problems

- **5.1 Palette + type off-brand.** Baloo 2 / Hanken Grotesk + cream/berry vs. the kit's Playfair Display / Nunito + Moon Indigo/Bell Gold. **Fix:** adopt MoonBell tokens (Phase 3).
- **5.2 Everything tilts.** `.tilt-l/.tilt-r` on cards + pills is charming in small doses; applied to nearly every card it reads as gimmicky and slightly "template." **Fix:** reserve tilt for 1–2 hero/sample moments; keep functional cards straight.
- **5.3 Six near-identical feature cards + five occasion cards** = visual monotony and the "generic three-column grid" the brief warns against. **Fix:** 3 benefit blocks with distinct art, not icon-in-rounded-square ×11.
- **5.4 Emoji-adjacent sparkles as permanent decoration.** Twinkling `Sparkle` used as constant ambient motion. **Fix:** restrained, purposeful motion only (brief's rule); stop-after-complete, not infinite `twinkle`.
- **5.5 Placeholder-grade sample art.** Current samples look like mood images, not book pages. **Fix:** replace with real cover + spreads (image prompts provided).

---

## 6. Nice-to-have refinements

- **6.1** Add an OG/social share image with a personalised cover (Instagram traffic will screenshot it).
- **6.2** Add a subtle "as seen: no photos required" iconographic strip using the kit's line icons instead of filled circles.
- **6.3** FAQ: lead with the two real objections ("Is it actually good?" via a sample link; "Is my child's data safe?"). Currently price is first.
- **6.4** Footer: add trust marks (DPDP-aligned, contact/grievance), payment icons (UPI, cards), and a single newsletter capture for the not-yet-shipped formats.
- **6.5** Micro-copy on the button: pair "Create their free preview" with "· free · no photos" as a sub-label to pre-empt cost/privacy fear at the click.

---

## Fix sequence (by ROI)

| # | Fix | Impact | Effort |
|---|-----|--------|--------|
| 1 | Move auth to after the reveal; persist draft | ★★★★★ | L |
| 2 | Remove beta gate from public funnel | ★★★★★ | S |
| 3 | Strip all alpha/"checkout paused" language | ★★★★☆ | S |
| 4 | One product, one price (₹299), one CTA | ★★★★☆ | S–M |
| 5 | Interactive nickname→cover hero | ★★★★☆ | M |
| 6 | Real cover + 2 readable spreads + page-turn | ★★★★☆ | M |
| 7 | MoonBell brand tokens + logo, single CTA verb | ★★★☆☆ | M |
| 8 | Section cull (11 → 8), merge features/occasions | ★★★☆☆ | M |
| 9 | Social proof + privacy-at-point-of-fear | ★★★☆☆ | S |
| 10 | Mobile hero height, funnel keyboard/back-nav | ★★★☆☆ | S–M |

*Nothing here recommends fake scarcity, fake testimonials, fabricated counts, or countdown manipulation. The wins are real product, real proof, and removing friction.*
