import { describe, expect, it } from 'vitest';
import { logoPlek, meetVorm, voorgrondMasker } from '@/lib/fotoVorm';

/** Teken rechthoeken (in pixels) als donkere vlakken op een witte achtergrond. */
function beeld(w: number, h: number, vlakken: [number, number, number, number][]) {
  const d = new Uint8ClampedArray(w * h * 4).fill(255);
  for (const [x0, y0, x1, y1] of vlakken)
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = 30; }
  return d;
}

describe('fotoVorm', () => {
  it('T-shirt: logo borst links staat rechts in beeld, op de romp en boven het midden', () => {
    // Romp 60-140, mouwen 30-170 tussen y 20 en 60, zoom op 190.
    const d = beeld(200, 200, [[60, 20, 140, 190], [30, 20, 170, 60]]);
    const v = meetVorm(voorgrondMasker(d, 200, 200), 200, 200, 'boven');
    const p = logoPlek(v, 'borst-links')!;
    expect(p.x * 200).toBeGreaterThan(100);
    expect(p.x * 200).toBeLessThan(140);
    expect(p.y * 200).toBeGreaterThan(30);
    expect(p.y * 200).toBeLessThan(80);
    const r = logoPlek(v, 'borst-rechts')!;
    expect(r.x * 200).toBeLessThan(100);
  });

  it('capuchon boven de schouders telt niet als schouderlijn', () => {
    // Capuchon 75-125 van y 10 tot 50, bodywarmer 50-150 van 50 tot 190.
    const d = beeld(200, 200, [[75, 10, 125, 50], [50, 50, 150, 190]]);
    const v = meetVorm(voorgrondMasker(d, 200, 200), 200, 200, 'mouwloos');
    expect(v.romp!.schouder * 200).toBeGreaterThan(40);
    expect(logoPlek(v, 'borst-links')!.y * 200).toBeGreaterThan(60);
  });

  it('broek: pijp links staat rechts in beeld', () => {
    const d = beeld(200, 200, [[60, 10, 140, 70], [60, 70, 96, 190], [104, 70, 140, 190]]);
    const v = meetVorm(voorgrondMasker(d, 200, 200), 200, 200, 'broek');
    expect(logoPlek(v, 'dijbeen-links')!.x * 200).toBeGreaterThan(104);
    expect(logoPlek(v, 'dijbeen-rechts')!.x * 200).toBeLessThan(96);
  });

  it('rug staat niet op een vooraanzicht', () => {
    const d = beeld(100, 100, [[20, 10, 80, 90]]);
    expect(logoPlek(meetVorm(voorgrondMasker(d, 100, 100), 100, 100, 'boven'), 'rug')).toBeNull();
  });
});
