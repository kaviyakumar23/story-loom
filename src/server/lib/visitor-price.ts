import { cookies } from 'next/headers';
import { DEFAULT_PRICE_ARM, priceForArm } from '../config/pricing';
import { VISITOR_COOKIE, resolveArm } from './price-arm';

/**
 * The price to render for this visitor, resolved on the server.
 *
 * Rendering a placeholder and correcting it after hydration would show one price
 * and then another, which is the single worst thing a page selling something can
 * do. Read here, before the HTML is written.
 *
 * The visitor id is minted by src/proxy.ts before this runs, so an arm can be
 * both chosen and persisted here — a Server Component cannot set a cookie, but
 * it can write a row against a cookie that already exists. Without the proxy
 * this fell through to the default arm for everyone and the experiment silently
 * collected nothing.
 */
export interface VisitorPrice {
  amount: number;
  display: string;
}

export async function visitorPrice(): Promise<VisitorPrice> {
  try {
    const id = (await cookies()).get(VISITOR_COOKIE)?.value;
    if (!id) return priceForArm(DEFAULT_PRICE_ARM);

    const assignment = await resolveArm(id);
    return { amount: assignment.amount, display: assignment.display };
  } catch {
    // A pricing lookup must never be the reason the landing page fails to
    // render. A default price is a slightly lopsided experiment; a 500 is a
    // lost visitor.
    return priceForArm(DEFAULT_PRICE_ARM);
  }
}
