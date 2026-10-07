import { describe, expect, it } from 'vitest';
import { afronden, logoPrijs, pakketPrijsPerMedewerker, percentiel, prijsklasse, typeVanNaam, type PrijsData } from '@/lib/kms/prijsindicatie';

const staffel = [
  { techniek: 'borduren', formaat: 'S', vanaf_aantal: 1, stukprijs: 8.45 },
  { techniek: 'borduren', formaat: 'S', vanaf_aantal: 15, stukprijs: 7.45 },
  { techniek: 'borduren', formaat: 'L', vanaf_aantal: 1, stukprijs: 12.95 },
  { techniek: 'borduren', formaat: 'L', vanaf_aantal: 15, stukprijs: 11.95 },
];

describe('prijsindicatie', () => {
  it('herkent kledingtypes uit de naam', () => {
    expect(typeVanNaam('Classic Poloshirt')).toBe('polo');
    expect(typeVanNaam('Casper Knit Polo trui')).toBe('sweater');
    expect(typeVanNaam('AllroundWork, T-Shirt')).toBe('tshirt');
    expect(typeVanNaam('Werkbroek met holsterzakken')).toBe('werkbroek');
    expect(typeVanNaam('Korte werkbroek')).toBeNull();
  });
  it('rekent het percentiel', () => {
    expect(percentiel([10, 20, 30, 40, 50], 0.25)).toBe(20);
    expect(percentiel([], 0.25)).toBeNull();
  });
  it('kiest de juiste logostaffel', () => {
    expect(logoPrijs(staffel, 'borduren', 'S', 10)).toBe(8.45);
    expect(logoPrijs(staffel, 'borduren', 'S', 45)).toBe(7.45);
  });
  it('rekent de pakketprijs met korting en logo', () => {
    const d: PrijsData = { typePrijzen: { polo: 20, softshell: 80 }, staffel, korting: 25, teamAantal: 15 };
    // 3 polo's: 3 x (15 + 7,45) = 67,35; softshell rug: 1 x (60 + 11,95) = 71,95
    expect(pakketPrijsPerMedewerker([{ type: 'polo', per: 3, positie: 'borst-links' }, { type: 'softshell', per: 1, positie: 'rug' }], d)).toBeCloseTo(139.3, 5);
    expect(pakketPrijsPerMedewerker([{ type: 'winterjas', per: 1, positie: 'rug' }], d)).toBeNull();
  });
  it('rondt naar boven af op 5 euro en deelt in klassen in', () => {
    expect(afronden(139.3)).toBe(140);
    expect(afronden(140)).toBe(140);
    expect(prijsklasse(10, [20, 40])).toBe(1);
    expect(prijsklasse(30, [20, 40])).toBe(2);
    expect(prijsklasse(50, [20, 40])).toBe(3);
  });
});
