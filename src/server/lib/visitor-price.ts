import { cookies } from 'next/headers';
import { DEFAULT_PRICE_ARM, priceForArm } from '../config/pricing';
import { VISITOR_COOKIE } from './price-arm';
import { serviceClient } from './supabase';

/**
 * The price to render for this visitor, resolved on the server.
 *
 * Rendering a placeholder and correcting it after hydration would show one price
 * and then another, which is the single worst thing a page selling something can
 * do. Read here, before the HTML is written.
 *
 * Read-only: assignment happens in /api/v1/beta/pricing, because a Server
 * Component cannot set a cookie. A visitor with no assignment yet sees the
 * default arm, and is assigned one the moment the page's client code asks.
 */
export interface VisitorPrice {
  amount: number;
  display: string;
}

export async function visitorPrice(): Promise<VisitorPrice> {
  try {
    const id = (await cookies()).get(VISITOR_COOKIE)?.value;
    if (!id) return priceForArm(DEFAULT_PRICE_ARM);

    const { data } = await serviceClient()
      .from('price_arm_assignments')
      .select('arm')
      .eq('visitor_id', id)
      .maybeSingle();
    const arm = (data as { arm: 'A' | 'B' } | null)?.arm;
    return priceForArm(arm ?? DEFAULT_PRICE_ARM);
  } catch {
    // A pricing lookup must never be the reason the landing page fails to
    // render. A default price is a slightly lopsided experiment; a 500 is a
    // lost visitor.
    return priceForArm(DEFAULT_PRICE_ARM);
  }
}
