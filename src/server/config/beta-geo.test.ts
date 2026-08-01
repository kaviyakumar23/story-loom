import { describe, expect, it } from 'vitest';
import { isServiceable, metroForPincode } from './beta-geo';

/**
 * Where we say we deliver has to match where we can actually deliver. Promising
 * an address the courier cannot reach turns into a refund and an apology, and
 * this check runs before the payment window opens precisely so that never
 * happens at the worst possible moment.
 */
describe('delivery area', () => {
  it('serves the three beta metros', () => {
    expect(metroForPincode('560001')).toBe('bengaluru'); // Bengaluru GPO
    expect(metroForPincode('560103')).toBe('bengaluru'); // Bellandur
    expect(metroForPincode('400001')).toBe('mumbai'); // Fort
    expect(metroForPincode('400703')).toBe('mumbai'); // Navi Mumbai
    expect(metroForPincode('110001')).toBe('delhi_ncr'); // Connaught Place
    expect(metroForPincode('122001')).toBe('delhi_ncr'); // Gurugram
    expect(metroForPincode('201301')).toBe('delhi_ncr'); // Noida
  });

  // These are real Indian cities we would love to serve and cannot yet. Getting
  // this wrong in the permissive direction is the expensive mistake.
  it('refuses anywhere we cannot fulfil yet', () => {
    expect(metroForPincode('411001')).toBeNull(); // Pune
    expect(metroForPincode('600001')).toBeNull(); // Chennai
    expect(metroForPincode('700001')).toBeNull(); // Kolkata
    expect(metroForPincode('380001')).toBeNull(); // Ahmedabad
    expect(metroForPincode('500001')).toBeNull(); // Hyderabad
  });

  it('rejects anything that is not a real PIN code shape', () => {
    expect(metroForPincode('')).toBeNull();
    expect(metroForPincode('56001')).toBeNull(); // five digits
    expect(metroForPincode('5600012')).toBeNull(); // seven digits
    expect(metroForPincode('060001')).toBeNull(); // no PIN starts with 0
    expect(metroForPincode('abc123')).toBeNull();
  });

  it('tolerates the whitespace a real form produces', () => {
    expect(metroForPincode('  560001 ')).toBe('bengaluru');
    expect(isServiceable(' 400001')).toBe(true);
  });
});
