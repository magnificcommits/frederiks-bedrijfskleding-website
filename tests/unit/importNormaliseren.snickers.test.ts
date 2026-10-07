import { describe, it, expect } from 'vitest';
import { merkMaat, normaliseerImportVariant } from '@/lib/kms/importNormaliseren';

describe('Snickers-maatcodes', () => {
  it('vertaalt bovenkledingcodes naar de echte maat', () => {
    expect(merkMaat('Snickers Workwear', '3')).toBe('XS');
    expect(merkMaat('Snickers Workwear', '004')).toBe('S');
    expect(merkMaat('Snickers Workwear', '8')).toBe('2XL');
    expect(merkMaat('Snickers Workwear', '12')).toBe('6XL');
  });
  it('laat broekmaten en andere merken staan', () => {
    expect(merkMaat('Snickers Workwear', '52')).toBe('52');
    expect(merkMaat('Tricorp', '3')).toBe('3');
    expect(merkMaat(null, '5')).toBe('5');
  });
  it('bewaart de code als maat van de leverancier', () => {
    const v = normaliseerImportVariant('Zwart', '5', undefined, 'Snickers Workwear');
    expect(v.maat).toBe('M');
    expect(v.maatLeverancier).toBe('5');
  });
});
