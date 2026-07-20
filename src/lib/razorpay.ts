'use client';

import type { CreateOrderResponse } from './types';

/**
 * Razorpay Checkout (client-side widget). The backend creates the order and
 * verifies the webhook; the frontend only opens the widget and then polls the
 * order/book status — the client `handler` is NOT treated as confirmation (§8).
 */
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('no window'));
    if (window.Razorpay) return resolve();
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Razorpay'));
    document.body.appendChild(s);
  });
}

export async function openCheckout(
  order: CreateOrderResponse,
  opts: { name?: string; email?: string; onDismiss: () => void; onPaid: () => void },
): Promise<void> {
  await loadScript();
  if (!window.Razorpay) throw new Error('Razorpay unavailable');

  const rzp = new window.Razorpay({
    key: order.keyId,
    order_id: order.razorpayOrderId,
    amount: order.amount,
    currency: order.currency,
    name: 'MoonBell',
    description: 'Personalized storybook',
    prefill: opts.email ? { email: opts.email } : undefined,
    theme: { color: '#9C3C6B' },
    // Source of truth is our webhook — start polling, don't trust this callback.
    handler: () => opts.onPaid(),
    modal: { ondismiss: () => opts.onDismiss() },
  });
  rzp.open();
}
