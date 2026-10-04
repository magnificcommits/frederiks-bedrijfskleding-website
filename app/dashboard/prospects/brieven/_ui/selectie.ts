'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Selectie met vinkjes zoals in een mailprogramma: klik selecteert één rij,
 * shift-klik selecteert of deselecteert alles tussen de vorige klik en deze.
 * `zichtbaar` is de huidige volgorde op het scherm; de selectie blijft bewaard
 * als een filter rijen verbergt.
 */
export function useShiftSelectie(begin: Iterable<string> = []) {
  const [gekozen, setGekozen] = useState<Set<string>>(() => new Set(begin));
  const laatste = useRef<string | null>(null);

  const klik = useCallback((id: string, zichtbaar: string[], shift: boolean) => {
    setGekozen((oud) => {
      const nieuw = new Set(oud);
      const aan = !oud.has(id);
      const van = laatste.current ? zichtbaar.indexOf(laatste.current) : -1;
      const tot = zichtbaar.indexOf(id);
      if (shift && van !== -1 && tot !== -1) {
        const [a, b] = van < tot ? [van, tot] : [tot, van];
        for (const x of zichtbaar.slice(a, b + 1)) {
          if (aan) nieuw.add(x);
          else nieuw.delete(x);
        }
      } else if (aan) nieuw.add(id);
      else nieuw.delete(id);
      return nieuw;
    });
    laatste.current = id;
  }, []);

  const zet = useCallback((lijst: string[], aan: boolean) => {
    setGekozen((oud) => {
      const nieuw = new Set(oud);
      for (const x of lijst) {
        if (aan) nieuw.add(x);
        else nieuw.delete(x);
      }
      return nieuw;
    });
  }, []);

  const leeg = useCallback(() => setGekozen(new Set()), []);

  return { gekozen, klik, zet, leeg };
}
