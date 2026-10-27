import { describe, expect, it } from 'vitest';
import { isDashRol, magazijnMagPad } from '@/lib/kms/rollen';

describe('magazijnMagPad', () => {
  it('laat het planbord, de drukproeven en de werkbon toe', () => {
    expect(magazijnMagPad('/dashboard/logos')).toBe(true);
    expect(magazijnMagPad('/dashboard/logos/abc')).toBe(true);
    expect(magazijnMagPad('/dashboard/drukproeven')).toBe(true);
    expect(magazijnMagPad('/dashboard/drukproeven/nieuw')).toBe(true);
    expect(magazijnMagPad('/dashboard/orders/2234e02b-11b1-46ba-8b25-88f8c2529490/werkbon')).toBe(true);
  });
  it('weert orders, klanten, facturen en instellingen', () => {
    expect(magazijnMagPad('/dashboard/orders')).toBe(false);
    expect(magazijnMagPad('/dashboard/orders/2234e02b-11b1-46ba-8b25-88f8c2529490')).toBe(false);
    expect(magazijnMagPad('/dashboard/klanten')).toBe(false);
    expect(magazijnMagPad('/dashboard/facturen')).toBe(false);
    expect(magazijnMagPad('/dashboard/instellingen')).toBe(false);
    expect(magazijnMagPad('/api/dashboard/search')).toBe(false);
    expect(magazijnMagPad('')).toBe(false);
  });
  it('de startpagina alleen om door te sturen, niet voor acties', () => {
    expect(magazijnMagPad('/dashboard')).toBe(true);
    expect(magazijnMagPad('/dashboard', true)).toBe(false);
    expect(magazijnMagPad('/dashboard/logos', true)).toBe(true);
  });
  it('kent de rollen', () => {
    expect(isDashRol('magazijn')).toBe(true);
    expect(isDashRol('baas')).toBe(false);
  });
});
