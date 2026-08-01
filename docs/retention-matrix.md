# What we keep, and for how long

Written down because "delete everything" and "keep the books" are both true of
different things, and the difference is where privacy promises get broken by
accident.

The rule underneath all of it: **a child's content is deleted on request; a
financial transaction is not, because it is no longer only ours to delete.**

## Child content

| What | Kept for | Why |
| --- | --- | --- |
| Unpurchased previews (book, pages, illustrations) | `PREVIEW_RETENTION_DAYS`, default 30 | Long enough to come back and buy, short enough that an abandoned preview is not an indefinite store of a child's likeness. Purged nightly. |
| Character sheets and their reference images | With their hero; swept when the hero has no books left | The sheet IS the child's illustrated likeness. It outlives no book. |
| Child photos (`photo-intake`) | 24 hours, hard cap | Consumed into one stylized sheet and deleted immediately; the hourly cron is the backstop for a delete that failed. The feature is off entirely during the beta. |
| Purchased books | Until the parent asks | Someone paid for this and may want to reprint it. Deleted in full on request. |

## Orders and money

| What | Kept for | Why |
| --- | --- | --- |
| `orders`, `payments`, `order_costs` | 8 years | Statutory retention for a financial record. Survives erasure with `parent_id` and `book_id` nulled — the transaction, not the person. |
| `payments.raw_webhook` | Scrubbed at erasure | It carries the payer's email and phone from Razorpay. Left alone, "erasure" would leave personal data sitting inside a JSON blob. |
| `shipping_addresses` | Until the order is delivered, then anonymised at erasure | An address is only needed while something is travelling to it. |
| `print_releases` | 8 years, immutable | Which bytes were sent to a printer and by whom. Cannot be updated or deleted, so a complaint can be answered rather than argued about. |

## Logs and operational records

| What | Kept for | Why |
| --- | --- | --- |
| `audit_log`, `webhook_events`, `funnel_events` | ≥ 180 days | CERT-In direction 5 requires 180 days of logs, so nothing here is purged earlier. |
| `generation_events` (AI cost ledger) | Indefinite, book id nulled on delete | Historical margin has to survive the books it was measured on, or "what did this cost us?" becomes unanswerable a month later. |
| `preview_ip_usage` | 30 days | Salted hashes, never raw addresses — enough to rate-limit, not enough to identify. |

## Deferred erasure

A deletion request that arrives while a printed order is in flight is recorded
as `deferred` rather than executed. Erasing through it would cascade away the
fulfilment row and the shipping address and delete the print master — silently
cancelling a paid order with no operator visibility at all.

The retention cron re-checks the live order state daily and completes the
erasure as soon as the book is delivered or cancelled. The parent is told this
in plain words at the point of asking, and does not have to do anything else.

**Never deferred for convenience.** The only thing that may delay an erasure is
a physical order that is genuinely still moving.
