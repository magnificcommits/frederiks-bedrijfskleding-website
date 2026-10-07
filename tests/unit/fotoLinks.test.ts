import { describe, expect, it } from 'vitest';
import { leesFotoLinks, veiligeFotoUrl } from '@/lib/kms/fotoLinks';

describe('fotoLinks', () => {
  it('leest regels met en zonder kleur', () => {
    const { regels, fouten } = leesFotoLinks(
      '# kop\nX3387 ; NAVY ; https://cdn.example.com/x3387-navy.jpg\n6244;https://snickers.example.com/6244.jpg\n\nWK303CC\tFluorescent Orange\thttps://wk.example.com/a.png',
    );
    expect(fouten).toEqual([]);
    expect(regels).toEqual([
      { regel: 2, artNr: 'X3387', kleur: 'NAVY', url: 'https://cdn.example.com/x3387-navy.jpg' },
      { regel: 3, artNr: '6244', kleur: '', url: 'https://snickers.example.com/6244.jpg' },
      { regel: 5, artNr: 'WK303CC', kleur: 'Fluorescent Orange', url: 'https://wk.example.com/a.png' },
    ]);
  });
  it('meldt kapotte regels', () => {
    const { regels, fouten } = leesFotoLinks('alleen tekst\nX1 ; NAVY ; http://onveilig.example.com/a.jpg');
    expect(regels).toEqual([]);
    expect(fouten.map((f) => f.regel)).toEqual([1, 2]);
  });
  it('weigert interne adressen', () => {
    expect(veiligeFotoUrl('https://127.0.0.1/a.jpg')).toBeNull();
    expect(veiligeFotoUrl('https://localhost/a.jpg')).toBeNull();
    expect(veiligeFotoUrl('https://[::1]/a.jpg')).toBeNull();
    expect(veiligeFotoUrl('https://intranet/a.jpg')).toBeNull();
    expect(veiligeFotoUrl('https://user:pw@cdn.example.com/a.jpg')).toBeNull();
    expect(veiligeFotoUrl('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
  });
});
