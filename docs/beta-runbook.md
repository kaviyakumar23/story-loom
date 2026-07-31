# Narrow paid beta — what is done, and what has to happen before money moves

Engineering state as of this branch, against the plan of 2026-07-31. The order
below is the order things unblock in, not the order they were built.

## The rule this whole thing hangs on

**No paid order is possible until `NEXT_PUBLIC_PAYMENTS_ENABLED=true`.** The
client flag hides the buy button; the server check in
`src/app/api/v1/payments/order/route.ts` refuses to create an order regardless.
Leave both off until every gate below is closed. Turning them on is the last
step, not the first.

## Environment

Set these in Vercel (Production). Defaults are already correct in code, so an
unset variable fails safe — the list exists so a wrong value is visible.

| Variable | Beta value | What it does |
| --- | --- | --- |
| `NEXT_PUBLIC_PAYMENTS_ENABLED` | `false` until gates close | The kill switch. |
| `PHOTO_LIKENESS_SERVER_ENABLED` | `false` | Runtime authority for photos. |
| `NEXT_PUBLIC_PHOTO_LIKENESS_ENABLED` | `false` | Hides the uploader; needs a redeploy to take effect. |
| `MARKETING_EMAILS_ENABLED` | `false` | Win-back + occasion nudges. |
| `DIGITAL_COMPANION_ENABLED` | `false` | Whether a print order also gets a PDF. |
| `NEXT_PUBLIC_DIGITAL_COMPANION_ENABLED` | `false` | Client mirror. |
| `PUBLIC_SHARING_ENABLED` | `false` | `/share/:token`. Off also kills links already sent. |
| `NEXT_PUBLIC_PUBLIC_SHARING_ENABLED` | `false` | Client mirror. |
| `SELF_SERVE_EDITING_ENABLED` | `false` | Post-purchase page edits. |
| `NEXT_PUBLIC_SELF_SERVE_EDITING_ENABLED` | `false` | Client mirror. |
| `NEXT_PUBLIC_OCCASION_PACKS_ENABLED` | `false` | Occasion shortcuts in the create flow. |
| `BETA_ACCESS_CODE` | set | The invite wall. |
| `EMAIL_FROM` | `MoonBell <hello@moonbell.in>` | **Needs the Resend domain verified first.** |
| `ALERT_EMAIL` | set | Where unmatched payments and refund-after-release land. Do not leave this empty. |

Photo flags are two variables on purpose: a `NEXT_PUBLIC_` value is baked into
the bundle at build time, so it cannot be trusted to stop a request.

## Migrations

Apply in order with `node scripts/db-apply.mjs <name>` — **never**
`npm run migrate`, which does not match production's history.

```
0018_beta_intake                 dedication, correction review states
0019_print_assets                print_master/casewrap/preflight asset types, sha256
0020_payment_integrity           one open order per book, webhook journal, paid_at
0021_fulfillment_states_ledger   QC states, print_releases, order_events/costs,
                                 release_to_print(), apply_refund(), deferred erasure
0022_beta_caps_price_arms        price arms, claim_beta_order_slot()
0023_funnel_events               funnel telemetry
0024_beta_review_fixes           shipping-address index fix, cap hold window,
                                 webhook 'received' state
```

**`0022` and `0024` are not optional for correctness.** Without `0022` the
`next_price_arm_block` function is missing and every visitor silently falls back
to one price — the experiment collects nothing while appearing to work (the
server logs a `[price-arm]` error if this happens). Without `0024` the
shipping-address upsert fails at plan time and no checkout can complete at all.

Run `npm run rls-check` afterwards. `0021` changes a foreign key and adds
functions the app calls by name — if `apply_refund` is missing, refunds throw
rather than silently half-applying, which is the intended failure.

## Gates

### PV — privacy and product safety · code complete

- Photos refused at the API with zero egress (`photo-off.negative.test.ts`).
- Preview locked to cover + 3 pages server-side (`preview-lock.api.test.ts`).
- One founder-reviewed correction; self-serve regeneration off.
- Privacy policy's collection list matches what the form asks.

**Still needed:** counsel sign-off, and the provider question the plan calls
potentially fatal — written clearance from Google on Vertex's under-18 terms for
a parent-operated workflow, or a move to a provider whose terms fit.

### PR — print · code complete, blocked on a printer

- `npm run print:rfq` writes `public/print-test/` — 8 test pages built from the
  same geometry as a real book: trim registration rings, a near-black gradient
  for banding, the five intake skin tones lit and shaded, hairlines to 0.15pt,
  type to 5pt including reversed, a cross-spread that must meet at the spine, and
  the gutter limit. Plus `RFQ.txt` with the spec and the questions to ask.
- `npm run print:preflight <pdf>` measures page geometry, font embedding, image
  resolution **at placed size**, and the output intent. Every generated print
  master is checked automatically and stored beside the book; one that fails is
  not stored at all.

**Still needed:** send the pack to three printers. Their template gives the
spine formula and calipers that `DEFAULT_CASEWRAP_PARAMS` in `print-spec.ts` is
currently guessing. Then proofs, then physical inspection.

**Also unverified in production:** the 4K image request. `gemini-3-pro-image` is
asked for `imageConfig.imageSize: '4K'`; if that deployment rejects the field we
fall back and the Lanczos floor catches it, but the first real paid book should
be checked for whether it upscaled (audit action `image.upscaled`).

### PAY — payments · code complete

- One payable order per book; a losing race returns the winner's order.
- Webhook journalled by event id; unmatched captures alert instead of 404-looping;
  a refund arriving before its capture is parked and replayed.
- Refunds stop the book in one transaction and escalate if it already printed.
- A daily job asks Razorpay what it thinks happened and reports disagreements.

**Still needed:** live-mode capture → refund → settlement with real money, and
the six dry runs from §10 of the plan.

### SHIP — caps, geography, landing · code complete

- Pincode allowlist and caps (75 / 25 per metro / 3 a day / 15 a week / QC
  backlog) both enforced before Razorpay opens.
- One price per visitor, assigned in balanced blocks, stamped on the order.
- Landing rebuilt: 5 CTAs, 8 FAQs, single price, mobile CTA above the fold.
- Funnel telemetry with a closed schema; report at `/api/v1/admin/funnel`.

**Still needed:** confirm the pincode prefixes in `src/server/config/beta-geo.ts`
against the courier's actual serviceable list — over-promising there is a refund,
not a bug. And product photography: drop files into
`public/landing/product/{cover,open,spine,stack,packaging}.jpg` and the page
starts using them, no code change. Until then each slot says it is an
illustration.

## Founder-owned, outside this repo

Named here because the code is finished and these are not:

1. Provider clearance (the plan's fatal gate).
2. Legal seller identity, GST treatment, and the seven `[TODO]`s in
   `src/lib/business.ts` — the legal pages render a draft banner while any remain.
3. Printer selection, contract, proofs, physical drop/compression tests.
4. Razorpay live activation and the live-money evidence above.
5. Courier rate card and the NDR/RTO process the exception states assume.

## Turning it on

Only when all of the above is true:

1. `PHOTO_LIKENESS_SERVER_ENABLED=false` and the rest of the table confirmed.
2. Apply migrations `0018`–`0024`; `npm run rls-check`.
3. `EMAIL_FROM` on a verified domain; `ALERT_EMAIL` set and tested.
4. Set `NEXT_PUBLIC_PAYMENTS_ENABLED=true` and redeploy.
5. Take one order yourself, end to end, before inviting anyone.
