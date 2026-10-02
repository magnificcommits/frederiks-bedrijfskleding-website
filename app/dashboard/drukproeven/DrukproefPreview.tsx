'use client';

import { Garment } from '@/components/Garments';
import { kleuren } from '@/content/configurator';
import DrukproefCompositie, { type Formaat } from './DrukproefCompositie';
import { normaliseerOntwerp } from './ontwerp';

/**
 * Toont het voorbeeld van een drukproef.
 *
 * - Heeft de proef een ontwerp (logo's zelf geplaatst op de echte artikelfoto),
 *   dan tonen we de voor- en achterkant via DrukproefCompositie.
 * - Oude proeven zonder ontwerp werken zoals altijd: een eigen geüploade afbeelding,
 *   of anders het getekende kledingstuk met het logo erop (Garment).
 *
 * De extra props (ontwerp, achterAfbeeldingUrl) zijn optioneel, zodat bestaande
 * aanroepers (portaal, order) ongewijzigd blijven werken.
 */
export default function DrukproefPreview({
  afbeeldingUrl,
  type,
  kleur,
  logoUrl,
  positie,
  techniek,
  ontwerp,
  achterAfbeeldingUrl,
  formaat = 'normaal',
}: {
  afbeeldingUrl?: string | null;
  type: string;
  kleur: number;
  logoUrl?: string | null;
  positie: string;
  techniek: string;
  ontwerp?: unknown;
  achterAfbeeldingUrl?: string | null;
  formaat?: Formaat;
}) {
  const o = normaliseerOntwerp(ontwerp);
  if (o) {
    return <DrukproefCompositie ontwerp={o} voorUrl={afbeeldingUrl ?? null} achterUrl={achterAfbeeldingUrl ?? null} formaat={formaat} />;
  }

  if (afbeeldingUrl) {
    return (
      <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-lg bg-mist">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={afbeeldingUrl} alt="Eigen drukproef" className="h-full w-full object-contain" />
      </div>
    );
  }

  const k = kleuren[kleur] ?? kleuren[0];
  return (
    <div className="relative mx-auto aspect-square w-full">
      <Garment type={type} color={k.hex} light={k.licht} logo={logoUrl ?? null} pos={positie} techniek={techniek} />
    </div>
  );
}
