'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { bronKanaalLabel } from '@/lib/leadHerkomst';
import { ongezieneWebleadsActie } from './actions';
import { LEAD_FOUT, LEAD_OK } from './onderdelen';

type Bericht = { tekst: string; soort: 'ok' | 'fout' | 'nieuw'; href?: string };

const ELKE_MS = 60_000;

/**
 * Toont de leads-specifieke meldingen (?ok=stap, ?fout=reden …). De algemene
 * Toast in de shell pakt de bekende codes (opgeslagen, status, toegevoegd); deze
 * alleen de rest, zodat er nooit twee meldingen tegelijk staan.
 *
 * Met `webleads` kijkt hij ook elke minuut of er een nieuwe webaanvraag is
 * binnengekomen die nog niemand heeft geopend, en meldt die met een link. Op de
 * leadsoverzichtspagina doet NieuweWebleads dat al (met een banner), daar dus zonder.
 */
export default function LeadMelding({ webleads }: { webleads?: { aantal: number } } = {}) {
  const sp = useSearchParams();
  const router = useRouter();
  const pad = usePathname();
  const ok = sp.get('ok');
  const fout = sp.get('fout');
  const [bericht, setBericht] = useState<Bericht | null>(null);
  const vorige = useRef(webleads?.aantal ?? 0);
  const kijken = !!webleads;

  useEffect(() => {
    const tekst = fout ? LEAD_FOUT[fout] : ok ? LEAD_OK[ok] : undefined;
    if (!tekst) return;
    setBericht({ tekst, soort: fout ? 'fout' : 'ok' });
    const p = new URLSearchParams(sp.toString());
    p.delete('ok');
    p.delete('fout');
    router.replace(p.toString() ? `${pad}?${p}` : pad, { scroll: false });
    const t = setTimeout(() => setBericht(null), fout ? 7000 : 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, fout]);

  useEffect(() => {
    if (!kijken) return;
    let weg: ReturnType<typeof setTimeout> | null = null;
    const kijk = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const stand = await ongezieneWebleadsActie();
        const nieuwste = stand.leads[0];
        if (stand.aantal > vorige.current && nieuwste) {
          const extra = stand.aantal - vorige.current - 1;
          setBericht({
            soort: 'nieuw',
            tekst: `Nieuwe webaanvraag: ${nieuwste.bedrijf || nieuwste.naam} (${bronKanaalLabel(nieuwste.bron_kanaal).toLowerCase()})${extra > 0 ? ` en nog ${extra}` : ''}`,
            href: `/dashboard/leads/${nieuwste.id}`,
          });
          if (weg) clearTimeout(weg);
          weg = setTimeout(() => setBericht((b) => (b?.soort === 'nieuw' ? null : b)), 30_000);
        }
        vorige.current = stand.aantal;
      } catch {
        /* geen verbinding: volgende keer opnieuw */
      }
    };
    const t = setInterval(kijk, ELKE_MS);
    document.addEventListener('visibilitychange', kijk);
    return () => {
      clearInterval(t);
      if (weg) clearTimeout(weg);
      document.removeEventListener('visibilitychange', kijk);
    };
  }, [kijken]);

  if (!bericht) return null;
  const kleur =
    bericht.soort === 'fout'
      ? 'border-red-200 bg-red-50 text-red-800'
      : bericht.soort === 'nieuw'
        ? 'border-amber-300 bg-amber-50 text-ink-900'
        : 'border-green-200 bg-green-50 text-green-800';
  return (
    <div className="fixed bottom-5 max-md:bottom-20 left-1/2 z-50 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 md:left-auto md:right-6 md:translate-x-0">
      <div
        role={bericht.soort === 'fout' ? 'alert' : 'status'}
        className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-semibold shadow-card ${kleur}`}
      >
        <span>{bericht.tekst}</span>
        {bericht.href && (
          <Link href={bericht.href} onClick={() => setBericht(null)} className="whitespace-nowrap text-amber-700 underline-offset-2 hover:underline">
            Openen
          </Link>
        )}
        <button type="button" onClick={() => setBericht(null)} aria-label="Sluiten" className="opacity-60 hover:opacity-100">
          ✕
        </button>
      </div>
    </div>
  );
}
