import Link from 'next/link';
import { Icon } from '@/components/ui';
import { BRAND } from '@/lib/brand';
import { SERVICEABLE_SUMMARY } from '@/server/config/beta-geo';

/**
 * One price, stated plainly.
 *
 * No struck-through anchor, no "was ₹1,999", no countdown. Those work by making
 * someone feel they will lose something by thinking about it, and what this beta
 * needs to learn is whether a parent will pay this price for this book — a
 * number that a discount frame would make unreadable.
 *
 * The delivery area is stated here rather than discovered at checkout. Finding
 * out we don't reach you after filling in a form is the worst possible moment.
 */
export function PriceBlock({ price }: { price: string }) {
  return (
    <section className="dband dband-soft" id="pricing">
      <div className="container-narrow" style={{ textAlign: 'center' }}>
        <h2 className="display d-h2">One book, one price</h2>
        <p className="d-lead" style={{ color: 'var(--ink-soft)', margin: '14px auto 0', maxWidth: 520 }}>
          You only pay once you have seen your child’s book and decided you want it printed.
        </p>

        <div className="price-card">
          <div className="display" style={{ fontSize: 54, lineHeight: 1, color: 'var(--brand)' }}>{price}</div>
          <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', marginTop: 10 }}>
            Shipping and taxes included · {BRAND.product.deliveryWindow.toLowerCase()}
          </p>

          <Link href="/create" className="btn btn-primary btn-block" style={{ marginTop: 22, padding: '17px 30px', fontSize: 17 }}>
            {BRAND.hero.primaryCta}
          </Link>
          <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 12 }}>{BRAND.hero.ctaMicrocopy}</p>
        </div>

        <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 22, lineHeight: 1.6, maxWidth: 520, marginInline: 'auto' }}>
          <Icon name="shield" size={15} stroke="var(--brand)" style={{ verticalAlign: '-2px' }} />{' '}
          We’re a small beta and we deliver to {SERVICEABLE_SUMMARY} for now. If you’re somewhere
          else, we’ll take your email and tell you the moment we reach you.
        </p>
      </div>
    </section>
  );
}
