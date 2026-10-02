/**
 * Deterministische toevalsgenerator voor het voorbeeldportaal.
 * Zelfde token = altijd dezelfde demo (zelfde namen, maten, bestellingen).
 */

/** FNV-1a 32-bit hash van een string. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export type Rng = {
  /** Getal in [0, 1). */
  next: () => number;
  /** Geheel getal in [min, max] (inclusief). */
  int: (min: number, max: number) => number;
  /** Willekeurig element uit een niet-lege lijst. */
  pick: <T>(lijst: readonly T[]) => T;
  /** Geschudde kopie van de lijst. */
  shuffle: <T>(lijst: readonly T[]) => T[];
};

/** Mulberry32 PRNG op basis van een seed-string. */
export function maakRng(seed: string): Rng {
  let a = hashString(seed) || 0x9e3779b9;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const pick = <T,>(lijst: readonly T[]): T => lijst[Math.floor(next() * lijst.length)] as T;
  const shuffle = <T,>(lijst: readonly T[]): T[] => {
    const kopie = [...lijst];
    for (let i = kopie.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [kopie[i], kopie[j]] = [kopie[j] as T, kopie[i] as T];
    }
    return kopie;
  };
  return { next, int, pick, shuffle };
}
