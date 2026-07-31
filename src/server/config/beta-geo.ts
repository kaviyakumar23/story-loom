/**
 * Where the beta ships.
 *
 * The cohort is capped at 75 orders fulfilled by one person by hand, so the
 * delivery area is deliberately small: three metros the founder can reach a
 * courier in, and reason about when something goes wrong. Anywhere else, the
 * honest answer at checkout is "not yet" — taking the money and hoping is how a
 * validation beta turns into a support problem.
 *
 * Prefixes, not full pincode lists: a six-digit Indian PIN encodes region in its
 * leading digits, and an exhaustive list would be both enormous and wrong within
 * a year. Wide enough to include the metro's real spread, narrow enough that we
 * are not quietly promising delivery to a different state.
 *
 * FOUNDER INPUT NEEDED: confirm these against the courier's actual serviceable
 * list before the first paid block. Over-promising here is a refund, not a bug.
 */
export type Metro = 'bengaluru' | 'mumbai' | 'delhi_ncr';

export const METRO_LABELS: Record<Metro, string> = {
  bengaluru: 'Bengaluru',
  mumbai: 'Mumbai & Navi Mumbai',
  delhi_ncr: 'Delhi NCR',
};

/** Longest prefix wins, so a specific exclusion can be added without reordering. */
const PREFIXES: { prefix: string; metro: Metro }[] = [
  // Bengaluru urban: 5600xx–5601xx.
  { prefix: '5600', metro: 'bengaluru' },
  { prefix: '5601', metro: 'bengaluru' },

  // Mumbai city 4000xx, suburbs 4000xx–4001xx, Navi Mumbai 4002xx–4007xx,
  // Thane 4006xx.
  { prefix: '4000', metro: 'mumbai' },
  { prefix: '4001', metro: 'mumbai' },
  { prefix: '4002', metro: 'mumbai' },
  { prefix: '4006', metro: 'mumbai' },
  { prefix: '4007', metro: 'mumbai' },

  // Delhi 1100xx, Gurugram 1220xx, Noida 2013xx, Ghaziabad 2010xx, Faridabad 1210xx.
  { prefix: '1100', metro: 'delhi_ncr' },
  { prefix: '1220', metro: 'delhi_ncr' },
  { prefix: '2013', metro: 'delhi_ncr' },
  { prefix: '2010', metro: 'delhi_ncr' },
  { prefix: '1210', metro: 'delhi_ncr' },
];

/** The metro a pincode belongs to, or null if we do not ship there yet. */
export function metroForPincode(pincode: string): Metro | null {
  const clean = pincode.trim();
  if (!/^[1-9][0-9]{5}$/.test(clean)) return null;
  let best: { prefix: string; metro: Metro } | null = null;
  for (const entry of PREFIXES) {
    if (clean.startsWith(entry.prefix) && (!best || entry.prefix.length > best.prefix.length)) {
      best = entry;
    }
  }
  return best?.metro ?? null;
}

export function isServiceable(pincode: string): boolean {
  return metroForPincode(pincode) !== null;
}

/** For the "not yet" message — naming the places we DO reach beats a bare no. */
export const SERVICEABLE_SUMMARY = Object.values(METRO_LABELS).join(', ');
