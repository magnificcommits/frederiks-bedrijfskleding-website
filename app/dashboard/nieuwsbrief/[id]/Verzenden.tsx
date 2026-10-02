'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { probeerMisluktOpnieuw, startVersturen, verstuurBatch } from './actions';

type Stand = { verzonden: number; fouten: number; totaal: number; resterend: number };

const wacht = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * "Nu versturen" met bevestiging en voortgangsbalk.
 *
 * Na de bevestiging wordt de wachtrij gevuld (startVersturen) en daarna steeds
 * één batch van maximaal 50 adressen verstuurd (verstuurBatch), tot alles weg
 * is. Valt de verbinding weg of sluit Jessi het tabblad, dan kan ze later op
 * "Verder versturen" klikken; de cron pakt een stilgevallen verzending ook op.
 */
export default function Verzenden({
  id,
  aantal,
  status,
  stand: beginStand,
  mailKlaar,
  geenMailMelding,
  probleem,
}: {
  id: string;
  /** Aantal ontvangers volgens de opgeslagen doelgroep. */
  aantal: number;
  status: string;
  stand: Stand;
  mailKlaar: boolean;
  geenMailMelding: string;
  /** Reden waarom versturen nog niet kan (bv. geen onderwerp), of null. */
  probleem: string | null;
}) {
  const router = useRouter();
  const [fase, setFase] = useState<'rust' | 'bevestigen' | 'bezig' | 'klaar'>('rust');
  const [stand, setStand] = useState<Stand>(beginStand);
  const [melding, setMelding] = useState<string | null>(null);
  const stoppen = useRef(false);

  const loop = useCallback(async () => {
    setFase('bezig');
    setMelding(null);
    stoppen.current = false;
    let pogingen = 0;
    while (!stoppen.current) {
      let uit;
      try {
        uit = await verstuurBatch(id);
      } catch {
        pogingen++;
        if (pogingen > 5) {
          setMelding('De verbinding is weggevallen. Klik op Verder versturen om door te gaan; er wordt niemand dubbel gemaild.');
          setFase('rust');
          return;
        }
        await wacht(3000);
        continue;
      }
      setStand({ verzonden: uit.verzonden, fouten: uit.fouten, totaal: uit.totaal, resterend: uit.resterend });
      if (uit.klaar) {
        setFase('klaar');
        router.refresh();
        return;
      }
      if (uit.melding) {
        setMelding(uit.melding);
        if (!uit.opnieuwProberen) {
          setFase('rust');
          return;
        }
        pogingen++;
        if (pogingen > 10) {
          setFase('rust');
          return;
        }
        await wacht(4000);
        continue;
      }
      pogingen = 0;
      await wacht(400);
    }
    setFase('rust');
    setMelding('Gepauzeerd. Klik op Verder versturen om door te gaan.');
  }, [id, router]);

  // Waarschuwen bij wegklikken terwijl er nog verstuurd wordt.
  useEffect(() => {
    if (fase !== 'bezig') return;
    const waarschuw = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', waarschuw);
    return () => window.removeEventListener('beforeunload', waarschuw);
  }, [fase]);

  async function start() {
    setMelding(null);
    setFase('bezig');
    const uit = await startVersturen(id).catch(() => ({ ok: false as const, melding: 'Starten is mislukt. Probeer het nog een keer.' }));
    if (!uit.ok) {
      setMelding(uit.melding);
      setFase('rust');
      return;
    }
    setStand((s) => ({ ...s, totaal: uit.aantal, resterend: uit.aantal - s.verzonden - s.fouten }));
    await loop();
  }

  async function opnieuw() {
    setMelding(null);
    const uit = await probeerMisluktOpnieuw(id).catch(() => ({ ok: false as const, melding: 'Dat lukte niet. Probeer het nog een keer.' }));
    if (!uit.ok) {
      setMelding(uit.melding);
      return;
    }
    await loop();
  }

  const totaal = Math.max(stand.totaal, 1);
  const pct = Math.round(((stand.verzonden + stand.fouten) / totaal) * 100);

  if (!mailKlaar) {
    return <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700">{geenMailMelding}</p>;
  }

  const voortgang = (
    <div className="mt-3">
      <div className="h-4 w-full overflow-hidden rounded-full bg-mist" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-amber-600 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-[14px] text-ink-900">
        <span className="font-bold tabular-nums">{stand.verzonden}</span> van <span className="tabular-nums">{stand.totaal}</span> verstuurd
        {stand.fouten > 0 && (
          <>
            {' '}
            · <span className="font-semibold text-red-700">{stand.fouten} niet gelukt</span>
          </>
        )}
      </p>
    </div>
  );

  return (
    <div>
      {fase === 'rust' && status !== 'verzenden' && status !== 'verzonden' && (
        <>
          {probleem ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[14px] text-amber-800">{probleem}</p>
          ) : (
            <button type="button" className="knop-primair text-[15px]" onClick={() => setFase('bevestigen')} disabled={aantal === 0}>
              Nu versturen
            </button>
          )}
          {!probleem && aantal === 0 && <p className="veld-hint">Er zijn geen ontvangers in de gekozen doelgroep.</p>}
        </>
      )}

      {fase === 'bevestigen' && (
        <div className="rounded-xl border-2 border-amber-500 bg-amber-50 p-4">
          <p className="text-[16px] font-bold text-ink-900">
            Weet je het zeker? De nieuwsbrief gaat nu naar {aantal} {aantal === 1 ? 'ontvanger' : 'ontvangers'}.
          </p>
          <p className="mt-1 text-[14px] text-warm">Dit kun je niet terugdraaien. Laat dit scherm open tot het versturen klaar is.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="knop-primair text-[15px]" onClick={start}>
              Ja, verstuur naar {aantal} {aantal === 1 ? 'ontvanger' : 'ontvangers'}
            </button>
            <button type="button" className="knop-stil" onClick={() => setFase('rust')}>
              Annuleren
            </button>
          </div>
        </div>
      )}

      {fase === 'bezig' && (
        <div className="rounded-xl border border-line bg-white p-4">
          <p className="text-[15px] font-semibold text-ink-900">Bezig met versturen. Laat dit scherm open.</p>
          {voortgang}
          <button type="button" className="knop-tekst mt-2" onClick={() => (stoppen.current = true)}>
            Pauzeren
          </button>
        </div>
      )}

      {fase === 'rust' && status === 'verzenden' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-[15px] font-semibold text-ink-900">Het versturen is nog niet klaar.</p>
          {voortgang}
          <button type="button" className="knop-primair mt-3" onClick={loop}>
            Verder versturen
          </button>
        </div>
      )}

      {fase === 'klaar' && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-[15px] font-semibold text-green-800">Klaar. De nieuwsbrief is verstuurd.</p>
          {voortgang}
        </div>
      )}

      {fase === 'rust' && (status === 'verzonden' || status === 'mislukt') && stand.fouten > 0 && (
        <button type="button" className="knop-stil mt-3" onClick={opnieuw}>
          Probeer de {stand.fouten} mislukte {stand.fouten === 1 ? 'adres' : 'adressen'} opnieuw
        </button>
      )}

      {melding && (
        <p role="status" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-700">
          {melding}
        </p>
      )}
    </div>
  );
}
