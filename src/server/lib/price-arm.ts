import { randomUUID } from 'node:crypto';
import { DEFAULT_PRICE_ARM, priceForArm, type PriceArm } from '../config/pricing';
import { serviceClient } from './supabase';

/**
 * Which price this visitor sees, decided once and remembered.
 *
 * A price that changes between the landing page and checkout is a broken
 * promise, so the arm is assigned on first sight of the site and stored against
 * an opaque visitor id. The cookie is a random uuid and the row holds nothing
 * else: this identifies a browser for the length of an experiment, not a person.
 *
 * Assignment alternates in blocks rather than flipping a coin. With 75 orders,
 * random assignment can easily deal 60/40 and leave the comparison unreadable —
 * blocks of four keep the arms level as they fill, which is the whole point of
 * running a test this small.
 */
export const VISITOR_COOKIE = 'mb_vid';
const COOKIE_MAX_AGE = 180 * 86_400; // long enough to outlive the beta

export interface ArmAssignment {
  visitorId: string;
  arm: PriceArm;
  amount: number;
  display: string;
  /** Set when a new id was minted and the caller must write the cookie. */
  isNew: boolean;
}

export function readVisitorId(req: Request): string | null {
  const cookie = req.headers.get('cookie');
  if (!cookie) return null;
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${VISITOR_COOKIE}=([0-9a-f-]{36})`));
  return match?.[1] ?? null;
}

export function visitorCookie(visitorId: string): string {
  // httpOnly: the arm is decided server-side and read server-side. A client that
  // can rewrite it can shop for the cheaper price and poison the experiment.
  return [
    `${VISITOR_COOKIE}=${visitorId}`,
    'Path=/',
    `Max-Age=${COOKIE_MAX_AGE}`,
    'HttpOnly',
    'SameSite=Lax',
    process.env.NODE_ENV === 'production' ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

/** The visitor's arm, assigning one if this is their first visit. */
export async function resolveArm(visitorId: string | null): Promise<ArmAssignment> {
  const db = serviceClient();

  if (visitorId) {
    const { data } = await db
      .from('price_arm_assignments')
      .select('visitor_id, arm')
      .eq('visitor_id', visitorId)
      .maybeSingle();
    const row = data as { visitor_id: string; arm: PriceArm } | null;
    if (row) return { visitorId: row.visitor_id, ...priced(row.arm), isNew: false };
  }

  const id = visitorId ?? randomUUID();
  const { data: seq, error: seqErr } = await db.rpc('next_price_arm_block');
  // A sequence failure must not stop someone buying a book — a default arm is a
  // lopsided experiment, a hard error is a lost customer. But it must be LOUD:
  // silently assigning everyone to arm A looks exactly like a working experiment
  // while collecting nothing, and the usual cause is migration 0022 not having
  // been applied.
  if (seqErr) {
    console.error(
      '[price-arm] next_price_arm_block unavailable — every visitor is falling back to arm',
      DEFAULT_PRICE_ARM,
      '(is migration 0022 applied?):',
      seqErr.message,
    );
  }
  const blockSeq = typeof seq === 'number' ? seq : 0;
  const arm: PriceArm = seqErr ? DEFAULT_PRICE_ARM : armForSeq(blockSeq);

  const { error } = await db
    .from('price_arm_assignments')
    .upsert({ visitor_id: id, arm, block_seq: blockSeq }, { onConflict: 'visitor_id', ignoreDuplicates: true });
  if (error) {
    // Lost a race with our own concurrent request — read back whoever won, so
    // the visitor still sees one price rather than two.
    const { data } = await db.from('price_arm_assignments').select('arm').eq('visitor_id', id).maybeSingle();
    const existing = (data as { arm: PriceArm } | null)?.arm;
    if (existing) return { visitorId: id, ...priced(existing), isNew: visitorId == null };
  }

  return { visitorId: id, ...priced(arm), isNew: visitorId == null };
}

/**
 * Blocks of four: A B B A. Alternating strictly (A B A B) makes the arm
 * guessable from position, which matters if we ever recruit in ordered batches;
 * a balanced block keeps the counts equal without being a pattern.
 */
const BLOCK: PriceArm[] = ['A', 'B', 'B', 'A'];
export function armForSeq(seq: number): PriceArm {
  return BLOCK[Math.abs(seq) % BLOCK.length];
}

function priced(arm: PriceArm): { arm: PriceArm; amount: number; display: string } {
  const { amount, display } = priceForArm(arm);
  return { arm, amount, display };
}

/** The arm recorded for a visitor, for stamping onto their order. */
export async function armForVisitor(visitorId: string | null): Promise<PriceArm> {
  if (!visitorId) return DEFAULT_PRICE_ARM;
  const { data } = await serviceClient()
    .from('price_arm_assignments')
    .select('arm')
    .eq('visitor_id', visitorId)
    .maybeSingle();
  return (data as { arm: PriceArm } | null)?.arm ?? DEFAULT_PRICE_ARM;
}
