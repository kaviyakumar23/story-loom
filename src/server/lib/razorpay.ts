import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { loadEnv } from '../config/env';

/**
 * Razorpay integration (§8).
 *
 * The backend owns order creation and webhook verification. Unlocking is driven
 * by the webhook (the source of truth), never the client success callback.
 */

let _client: Razorpay | null = null;

export function razorpay(): Razorpay {
  if (_client) return _client;
  const env = loadEnv();
  _client = new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET,
  });
  return _client;
}

export interface CreatedOrder {
  id: string;
  amount: number;
  currency: string;
}

export async function createOrder(opts: {
  amount: number;
  currency: string;
  /** Our internal order id, so we can correlate the webhook back. */
  receipt: string;
  notes?: Record<string, string>;
}): Promise<CreatedOrder> {
  const order = await razorpay().orders.create({
    amount: opts.amount,
    currency: opts.currency,
    receipt: opts.receipt,
    notes: opts.notes,
  });
  return {
    id: order.id,
    amount: Number(order.amount),
    currency: order.currency,
  };
}

export interface RefundResult {
  id: string;
  amount: number;
  status: string;
}

/**
 * Issue a refund for a captured payment via the Razorpay API. `amount` omitted
 * = full refund. `notes.idempotencyKey` tags the refund; double-refund is
 * prevented by the caller checking `orders.status` before calling this.
 */
export async function refundPayment(opts: {
  paymentId: string;
  amount?: number;
  idempotencyKey: string;
}): Promise<RefundResult> {
  const params: { amount?: number; notes: Record<string, string> } = {
    notes: { idempotencyKey: opts.idempotencyKey },
  };
  if (opts.amount) params.amount = opts.amount;
  const refund = await razorpay().payments.refund(opts.paymentId, params);
  return { id: refund.id, amount: Number(refund.amount), status: String(refund.status) };
}

/**
 * Verify the HMAC-SHA256 signature Razorpay sends in the `X-Razorpay-Signature`
 * header for webhooks. Uses the raw request body and the webhook secret.
 * Constant-time comparison to avoid timing leaks.
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const env = loadEnv();
  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
