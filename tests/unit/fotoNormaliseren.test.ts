import { describe, expect, it } from 'vitest';
import { normaliseer } from '@/lib/kms/fotoNormaliseren';

const W = 40, H = 40;
function beeld(achtergrond: (x: number, y: number) => [number, number, number, number], product: [number, number, number, number]) {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = (y * W + x) * 4;
    const binnen = x >= 10 && x < 30 && y >= 5 && y < 35;
    const p = binnen ? product : achtergrond(x, y);
    d.set(p, k);
  }
  return d;
}
const px = (d: Uint8ClampedArray, x: number, y: number) => Array.from(d.slice((y * W + x) * 4, (y * W + x) * 4 + 4));

describe('fotoNormaliseren', () => {
  it('laat een grijze of gekleurde achtergrond bewust staan', () => {
    const r = normaliseer(beeld((x, y) => { const v = 150 + Math.round((x + y) / 4); return [v, v, v, 255]; }, [20, 20, 30, 255]), W, H);
    expect(r.methode).toBe('ongewijzigd');
    expect([r.x, r.y, r.w, r.h]).toEqual([0, 0, W, H]);
  });
  it('trekt een bijna-witte achtergrond op naar wit en laat wit textiel staan', () => {
    const r = normaliseer(beeld(() => [244, 244, 244, 255], [235, 235, 235, 255]), W, H);
    expect(r.methode).toBe('licht');
    expect(px(r.pixels, 1, 1)).toEqual([255, 255, 255, 255]);
    expect([r.x, r.y, r.w, r.h]).toEqual([10, 5, 20, 30]);
  });
  it('legt een transparante foto op wit', () => {
    const r = normaliseer(beeld(() => [0, 0, 0, 0], [200, 30, 30, 255]), W, H);
    expect(r.methode).toBe('transparant');
    expect(px(r.pixels, 1, 1)).toEqual([255, 255, 255, 255]);
    expect([r.x, r.y, r.w, r.h]).toEqual([10, 5, 20, 30]);
  });
  it('laat een effen vlak zonder product ongemoeid', () => {
    const r = normaliseer(beeld(() => [120, 120, 120, 255], [120, 120, 120, 255]), W, H);
    expect(r.methode).toBe('ongewijzigd');
  });
});
