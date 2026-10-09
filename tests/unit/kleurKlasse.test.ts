import { describe, expect, it } from 'vitest';
import { kleurKlasse } from '@/lib/kms/kleurKlasse';

describe('kleurKlasse', () => {
  it.each([
    ['9504 - Navy\\Black', 'Marineblauw'],
    ['0404 - Black\\Black', 'Zwart'],
    ['0458 - Black\\Steel Grey', 'Zwart'],
    ['5804 - Steel Grey\\Black', 'Antraciet'],
    ['Marine/Zwart 1620', 'Marineblauw'],
    ['Grijs/Zwart 1120', 'Grijs'],
    ['BlackGrey', 'Zwart'],
    ['WhiteDarkgrey', 'Wit'],
    ['Wit 10', 'Wit'],
    ['Hi Viz Yellow / Navy', 'Hi-vis geel'],
    ['Hi-Vis Geel/Marineblauw', 'Hi-vis geel'],
    ['Fluorescent Orange Melange / Black', 'Hi-vis oranje'],
    ['3904 - Forest Green - Black (1)', 'Groen'],
    ['Olijf/Zwart 1520', 'Groen'],
    ['Charcoal', 'Antraciet'],
    ['Antraciet/Zwart 1220', 'Antraciet'],
    ['Navy - Korenblauw', 'Marineblauw'],
    ['Light Grey Melange / Black', 'Grijs'],
  ])('%s -> %s', (ruw, klasse) => {
    expect(kleurKlasse(ruw)).toBe(klasse);
  });

  it('onbekende kleuren vallen erbuiten', () => {
    expect(kleurKlasse('2500 - Lime')).toBeNull();
    expect(kleurKlasse('Wine')).toBeNull();
    expect(kleurKlasse('Royal Blue')).toBeNull();
  });
});
