'use client';
import { useEffect, useMemo, useState } from 'react';
import { LOGO_MIN_CM2, logoCheck } from '@/lib/fiscaal';
import type { Ontwerp } from './ontwerp';

/**
 * Telt het logo-oppervlak van alle plaatsingen op het kledingstuk op (voor en achter)
 * en laat zien of het aan de 70 cm²-regel voldoet. De hoogte volgt uit de verhouding
 * van het logobestand, de breedte uit het veld "Breedte in het echt".
 */
export function LogoOnbelast({ ontwerp }: { ontwerp: Ontwerp }) {
  const alle = useMemo(() => [...ontwerp.voor, ...ontwerp.achter], [ontwerp]);
  const urls = useMemo(() => [...new Set(alle.map((p) => p.logo_url))].join('\n'), [alle]);
  const [verhouding, setVerhouding] = useState<Record<string, number>>({});

  useEffect(() => {
    for (const url of urls.split('\n').filter(Boolean)) {
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth > 0) setVerhouding((v) => ({ ...v, [url]: img.naturalHeight / img.naturalWidth }));
      };
      img.src = url;
    }
  }, [urls]);

  const metMaat = alle.filter((p) => p.breedte_cm && verhouding[p.logo_url]);
  if (!alle.length) return null;
  if (!metMaat.length) {
    return <p className="text-xs text-warm">Vul de breedte in het echt in, dan zie je of het logo onbelast mag (minimaal {LOGO_MIN_CM2} cm²).</p>;
  }
  const cm2 = Math.round(metMaat.reduce((som, p) => som + (p.breedte_cm as number) ** 2 * verhouding[p.logo_url], 0));
  const { onbelast, tekort } = logoCheck(cm2);
  return (
    <p className={`rounded-md px-3 py-2 text-sm font-semibold ${onbelast ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
      {onbelast
        ? `Logo's samen ${cm2} cm²: de klant mag dit onbelast aan medewerkers geven.`
        : `Logo's samen ${cm2} cm²: nog ${tekort} cm² te klein voor onbelast verstrekken.`}
      {metMaat.length < alle.length && ' Niet alle logo’s hebben een maat.'}
    </p>
  );
}
