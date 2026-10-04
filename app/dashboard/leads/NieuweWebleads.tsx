'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { bronKanaalLabel } from '@/lib/leadHerkomst';
import { allesGezienActie, ongezieneWebleadsActie } from './actions';

type Weblead = { id: string; naam: string; bedrijf: string | null; bron_kanaal: string | null; created_at: string };
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
    <section role="status" aria-live="polite" className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] font-semibold text-ink-900">
          {stand.aantal === 1 ? '1 nieuwe webaanvraag' : `${stand.aantal} nieuwe webaanvragen`} die nog niemand heeft geopend
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
          className="text-[12px] font-semibold text-warm underline-offset-2 hover:text-ink-900 hover:underline disabled:opacity-50"
        >
          Alles als gezien markeren
        </button>
      </div>
      <ul className="mt-2 grid gap-1">
        {stand.leads.map((l) => (
          <li key={l.id} className="text-[13px]">
            <Link href={`/dashboard/leads/${l.id}`} className="font-semibold text-ink-900 underline-offset-2 hover:text-amber-700 hover:underline">
              {l.bedrijf || l.naam}
            </Link>
            <span className="text-warm">
              {l.bedrijf ? ` · ${l.naam}` : ''} · {bronKanaalLabel(l.bron_kanaal)} · {geleden(l.created_at)}
            </span>
          </li>
        ))}
      </ul>
      {meer > 0 && <p className="mt-1 text-[12px] text-warm">en nog {meer} andere</p>}
    </section>
  );
}
