'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { bronKanaalLabel } from '@/lib/leadHerkomst';
import { allesGezienActie, ongezieneWebleadsActie } from './actions';

import type { OngezieneWeblead as Weblead } from '@/lib/kms/leads';
type Stand = { aantal: number; leads: Weblead[] };

const ELKE_MS = 60_000;

function geleden(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 1) return 'net binnen';
  if (min < 60) return `${min} min geleden`;
  const uur = Math.round(min / 60);
  if (uur < 24) return `${uur} uur geleden`;
  return `${Math.round(uur / 24)} dagen geleden`;
}

/**
 * Melding voor webaanvragen die nog niemand heeft geopend. Kijkt elke minuut
 * (en zodra het tabblad weer actief wordt) of er iets bij is gekomen; is dat zo,
 * dan ververst de pagina zodat de pijplijn en de lijst meteen kloppen.
 * Een lead openen haalt hem uit de melding.
 */
export default function NieuweWebleads({ begin }: { begin: Stand }) {
  const router = useRouter();
  const [stand, setStand] = useState<Stand>(begin);
  const [bezig, verwerk] = useTransition();
  const vorige = useRef(begin.aantal);

  const kijk = useCallback(async () => {
    try {
      const nieuw = (await ongezieneWebleadsActie()) as Stand;
      setStand(nieuw);
      if (nieuw.aantal > vorige.current) router.refresh();
      vorige.current = nieuw.aantal;
    } catch {
      /* geen verbinding: volgende keer opnieuw */
    }
  }, [router]);

  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') kijk();
    }, ELKE_MS);
    const opFocus = () => {
      if (document.visibilityState === 'visible') kijk();
    };
    document.addEventListener('visibilitychange', opFocus);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', opFocus);
    };
  }, [kijk]);

  // Aantal in de tabtitel, zodat je het ook ziet als je in een ander tabblad werkt.
  useEffect(() => {
    const basis = document.title.replace(/^\(\d+\)\s*/, '');
    document.title = stand.aantal ? `(${stand.aantal}) ${basis}` : basis;
  }, [stand.aantal]);

  if (!stand.aantal) return null;
  const meer = stand.aantal - stand.leads.length;

  return (
    <section role="status" aria-live="polite" className="mt-4 overflow-hidden rounded-xl border-2 border-amber-500 bg-white shadow-card" data-plek="nieuwe-leads">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-500 px-4 py-2.5">
        <p className="flex items-center gap-2 text-[14px] font-bold text-ink-900">
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ink-900 opacity-40" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-ink-900" />
          </span>
          {stand.aantal === 1 ? '1 nieuwe aanvraag wacht op je' : `${stand.aantal} nieuwe aanvragen wachten op je`}
        </p>
        <button
          type="button"
          disabled={bezig}
          onClick={() =>
            verwerk(async () => {
              await allesGezienActie();
              vorige.current = 0;
              setStand({ aantal: 0, leads: [] });
            })
          }
          className="text-[12px] font-semibold text-ink-900 underline-offset-2 hover:underline disabled:opacity-50"
        >
          Alles als gezien markeren
        </button>
      </div>
      <ul className="divide-y divide-line">
        {stand.leads.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <div className="min-w-0 grow">
              <p className="text-[15px] font-bold text-ink-900">
                {l.bedrijf || l.naam}
                <span className={`ml-2 rounded-full px-2 py-0.5 align-middle text-[11px] font-bold ${l.opnieuw ? 'bg-ink-900 text-white' : 'bg-amber-100 text-amber-900'}`}>
                  {l.opnieuw ? 'Opnieuw aangevraagd' : 'Nieuw'}
                </span>
              </p>
              <p className="text-[13px] text-warm">
                {[l.bedrijf ? l.naam : null, l.branche, l.aantal ? `${l.aantal}` : null, bronKanaalLabel(l.bron_kanaal), geleden(l.binnen)].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {l.telefoon && (
                <a href={`tel:${l.telefoon.replace(/[^\d+]/g, '')}`} className="knop-stil">Bel {l.telefoon}</a>
              )}
              <Link href={`/dashboard/leads/${l.id}`} className="knop-primair">Open lead</Link>
            </div>
          </li>
        ))}
      </ul>
      {meer > 0 && (
        <p className="border-t border-line px-4 py-2 text-[12px] text-warm">
          en nog {meer} andere. <Link href="/dashboard/leads" className="font-semibold underline">Alle leads</Link>
        </p>
      )}
    </section>
  );
}
