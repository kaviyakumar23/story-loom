import { Icon } from '@/components/ui';
import { PHOTO_LIKENESS_ENABLED } from '@/lib/photo-likeness';

/**
 * The four objections a parent has before they will spend three minutes on a
 * form, answered immediately under the hero.
 *
 * Every line is a promise the system actually keeps — the preview really is
 * free and locked, photos really are refused at the API, every book really is
 * read by a person before it prints, and damage really is replaced. Nothing
 * aspirational goes in this row.
 */
const ITEMS = [
  { icon: 'sparkles' as const, text: 'See it before you pay' },
  {
    icon: 'lock' as const,
    text: PHOTO_LIKENESS_ENABLED ? 'Photos optional, used once' : 'No child photos collected',
  },
  { icon: 'check' as const, text: 'Human-checked before printing' },
  { icon: 'shield' as const, text: 'Damaged in post? We replace it' },
];

export function TrustRow() {
  return (
    <section className="trust-row" aria-label="What we promise">
      <div className="container">
        <ul className="trust-row-list">
          {ITEMS.map((item) => (
            <li key={item.text}>
              <Icon name={item.icon} size={17} stroke="var(--brand)" />
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
