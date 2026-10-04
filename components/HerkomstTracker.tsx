'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { registreerPaginabezoek } from '@/lib/herkomst';
import { trackerSlaatOver } from '@/lib/leadHerkomst';

/**
 * Onzichtbaar: legt bij elke paginaweergave de herkomst en (na toestemming) het
 * bekeken pad vast. Zie lib/herkomst.ts voor wat er wel en niet wordt bewaard.
 */
export function HerkomstTracker() {
  const pad = usePathname();
  useEffect(() => {
    // Niet meetellen: KMS, portaal, technische routes en tokenpagina's (zie trackerSlaatOver).
    if (!pad || trackerSlaatOver(pad)) return;
    registreerPaginabezoek(pad);
  }, [pad]);
  return null;
}
