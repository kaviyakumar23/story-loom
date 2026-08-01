import { Icon } from '@/components/ui';
import { BRAND } from '@/lib/brand';
import { ProductPhoto } from './ProductPhoto';

/**
 * What the thing physically is.
 *
 * A page full of illustrations proves the artwork and nothing about the object:
 * how big it is, whether the cover is board or card, how many pages, what
 * happens if it arrives damaged. Those are the questions someone asks before
 * spending on a physical gift, and answering them with exact numbers is what
 * separates this from a print-on-demand paperback.
 */
export function ProductBlock({ price }: { price: string }) {
  return (
    <section className="dband" id="the-book">
      <div className="container grid-2" style={{ alignItems: 'center', gap: 56 }}>
        <div style={{ display: 'grid', gap: 14 }}>
          <ProductPhoto shot="cover" alt="The printed MoonBell hardcover, front cover" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <ProductPhoto shot="open" alt="A MoonBell hardcover open flat at an illustrated spread" sizes="(max-width: 860px) 45vw, 250px" />
            <ProductPhoto shot="packaging" alt="How a MoonBell book arrives, packaged for post" sizes="(max-width: 860px) 45vw, 250px" />
          </div>
        </div>

        <div>
          <span className="eyebrow"><Icon name="book" size={15} stroke="var(--brand)" /> The book itself</span>
          <h2 className="display d-h2" style={{ marginTop: 12 }}>A hardcover made for one child</h2>
          <p style={{ fontSize: 15.5, color: 'var(--ink-soft)', margin: '12px 0 20px', lineHeight: 1.6, maxWidth: 460 }}>
            Printed one at a time, checked by a person, and posted to you. Not a file to print at
            home — a real book that goes on a shelf and gets read until it falls apart.
          </p>

          <ul style={{ listStyle: 'none', margin: '0 0 22px', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {BRAND.product.includes.map((it) => (
              <li key={it} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', fontSize: 15.5, color: 'var(--ink)', lineHeight: 1.5 }}>
                <Icon name="check" size={18} stroke="var(--success)" style={{ flexShrink: 0, marginTop: 2 }} /> {it}
              </li>
            ))}
          </ul>

          {/* The exact numbers. Vagueness here is what a buyer reads as risk. */}
          <div className="spec-row">
            <span><strong>Size</strong>8×8 in square</span>
            <span><strong>Binding</strong>Casebound hardcover</span>
            <span><strong>Pages</strong>20 · 12 illustrated</span>
            <span><strong>Ages</strong>3–7</span>
            <span><strong>Price</strong>{price}, shipping included</span>
            <span><strong>Delivery</strong>{BRAND.product.deliveryWindow}</span>
          </div>

          <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 16, lineHeight: 1.6, maxWidth: 460 }}>
            If it arrives damaged, misprinted, or with the wrong details, we reprint and reship it —
            you don’t pay twice.
          </p>
        </div>
      </div>
    </section>
  );
}
