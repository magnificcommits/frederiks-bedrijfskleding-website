'use client';

import { Garment } from '@/components/Garments';
import { kleuren } from '@/content/configurator';

/**
 * Toont het voorbeeld van een drukproef. Als er een eigen afbeelding is geüpload,
 * laten we die zien. Anders renderen we het kledingstuk met het logo erop via Garment,
 * net als in de pakketconfigurator.
 */
export default function DrukproefPreview({
  afbeeldingUrl,
  type,
  kleur,
  logoUrl,
  positie,
  techniek,
}: {
  afbeeldingUrl?: string | null;
  type: string;
  kleur: number;
  logoUrl?: string | null;
  positie: string;
  techniek: string;
}) {
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
