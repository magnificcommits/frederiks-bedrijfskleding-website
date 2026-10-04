'use client';

import { useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import ZoekKeuze from '@/components/dashboard/ZoekKeuze';
import { zoekKlantenVoorFilter } from '@/lib/kms/filterActies';

/**
 * Eén klantzoeker bovenaan de passessiepagina. De keuze gaat in de URL
 * (?klant=), zodat de server de keuzekaarten voor die klant kan vullen en een
 * herlaadactie of terugknop de keuze bewaart.
 */
export default function KlantKiezer({ klantId, klantNaam }: { klantId: string; klantNaam: string | null }) {
  const router = useRouter();
  const pad = usePathname();
  const [bezig, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ZoekKeuze
        zoek={zoekKlantenVoorFilter}
        waarde={klantId}
        waardeLabel={klantNaam}
        placeholder="Zoek op naam, plaats of klantnummer"
        breedte="w-full max-w-md"
        autoFocus={!klantId}
        wisLabel="Andere klant kiezen"
        ariaLabel="Klant"
        onKies={(o) => {
          const p = new URLSearchParams(window.location.search);
          if (o) p.set('klant', o.waarde);
          else p.delete('klant');
          p.delete('fout');
          const qs = p.toString();
          startTransition(() => router.replace(qs ? `${pad}?${qs}` : pad, { scroll: false }));
        }}
      />
      {bezig && <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-300 border-t-transparent" aria-hidden="true" />}
    </div>
  );
}
