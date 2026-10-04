'use client';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { TOAST_EVENT, type ToastDetail } from './ui/toast';

const OK_TEKSTEN: Record<string, string> = {
  opgeslagen: 'Opgeslagen.',
  status: 'Status bijgewerkt.',
  gemaild: 'E-mail verstuurd.',
  aangemaakt: 'Aangemaakt.',
  toegevoegd: 'Toegevoegd.',
  verwijderd: 'Verwijderd.',
  bijgewerkt: 'Bijgewerkt.',
  'uit-offerte': 'Order aangemaakt uit de offerte.',
  betaald: 'Gemarkeerd als betaald.',
  afgerond: 'Afgerond.',
  heropend: 'Weer geopend.',
  afgevinkt: 'Afgevinkt.',
  besteld: 'Gemarkeerd als besteld.',
  bijbesteld: 'Bijbesteld.',
};
const FOUT_TEKSTEN: Record<string, string> = {
  order: 'Kon geen order maken. Koppel eerst een klant.',
  mail: 'Vul een e-mailadres in.',
  'geen-toegang': 'Geen toegang. Dit onderdeel is alleen voor de eigenaar.',
  verzenden: 'Versturen is mislukt. De mail is niet verstuurd; controleer het adres of probeer het later opnieuw.',
  opslaan: 'Opslaan is niet gelukt. Er is niets gewijzigd; probeer het opnieuw.',
  verwijderen: 'Verwijderen is niet gelukt. Probeer het opnieuw.',
  'annuleren-gefactureerd': 'Deze order kan niet worden geannuleerd: er is al een factuur verstuurd. Maak eerst een creditfactuur.',
  'annuleren-uitgeleverd': 'Deze order kan niet worden geannuleerd: hij is al uitgeleverd. Boek een retour in plaats van te annuleren.',
  'annuleren-deels': 'Niet alle orders zijn geannuleerd. Orders met een verstuurde factuur of die al zijn uitgeleverd blijven staan.',
  'status-deels': 'Niet bij alle orders is de status bijgewerkt. Controleer de lijst en probeer de rest opnieuw.',
};

type Bericht = ToastDetail & { sleutel: number };

function ToastInner() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const ok = sp.get('ok');
  const fout = sp.get('fout');
  const [bericht, setBericht] = useState<Bericht | null>(null);
  const [bezig, setBezig] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resterend = useRef(0);
  const gestart = useRef(0);

  const stopTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const startTimer = useCallback(
    (ms: number) => {
      stopTimer();
      resterend.current = ms;
      gestart.current = Date.now();
      timer.current = setTimeout(() => setBericht(null), ms);
    },
    [stopTimer],
  );

  const laatZien = useCallback(
    (detail: ToastDetail) => {
      const duur = detail.duur ?? (detail.ongedaan ? 8000 : detail.soort === 'fout' ? 6000 : 3500);
      setBezig(false);
      setBericht({ ...detail, sleutel: Date.now() });
      startTimer(duur);
    },
    [startTimer],
  );

  // Meldingen uit clientcode (toon(...)).
  useEffect(() => {
    function onToast(e: Event) {
      const detail = (e as CustomEvent<ToastDetail>).detail;
      if (detail?.tekst) laatZien(detail);
    }
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, [laatZien]);

  // Meldingen uit de URL (?ok=... of ?fout=... na een server action).
  useEffect(() => {
    if (!ok && !fout) return;
    const tekst = fout ? FOUT_TEKSTEN[fout] : OK_TEKSTEN[ok as string];
    if (!tekst) return; // onbekende code: de pagina toont zelf eventueel een eigen melding
    laatZien({ tekst, soort: fout ? 'fout' : 'ok' });
    // ok/fout uit de URL halen zodat de melding niet terugkomt bij refresh of navigeren.
    const params = new URLSearchParams(sp.toString());
    params.delete('ok');
    params.delete('fout');
    const url = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(url, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, fout]);

  useEffect(() => stopTimer, [stopTimer]);

  // Wie met de muis op de melding staat of erin tabt, wil hem lezen: dan niet weghalen.
  function pauzeer() {
    if (!timer.current) return;
    stopTimer();
    resterend.current = Math.max(1500, resterend.current - (Date.now() - gestart.current));
  }
  function hervat() {
    if (bericht && !timer.current && !bezig) startTimer(resterend.current || 3000);
  }

  async function maakOngedaan() {
    if (!bericht?.ongedaan) return;
    setBezig(true);
    stopTimer();
    try {
      await bericht.ongedaan.actie();
      laatZien({ tekst: 'Ongedaan gemaakt.', soort: 'ok' });
    } catch {
      laatZien({ tekst: 'Ongedaan maken is niet gelukt.', soort: 'fout' });
    }
  }

  const fouts = bericht?.soort === 'fout';
  return (
    <div
      className="pointer-events-none fixed bottom-24 left-1/2 z-[95] w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 md:bottom-5 md:left-auto md:right-6 md:translate-x-0"
      role={fouts ? 'alert' : 'status'}
      aria-live={fouts ? 'assertive' : 'polite'}
    >
      {bericht && (
        <div
          key={bericht.sleutel}
          onMouseEnter={pauzeer}
          onMouseLeave={hervat}
          onFocus={pauzeer}
          onBlur={hervat}
          className={`pointer-events-auto flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-semibold shadow-card ${
            fouts ? 'border-red-200 bg-red-50 text-red-800' : 'border-ink-800 bg-ink-900 text-white'
          }`}
        >
          {!fouts && (
            <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500 text-[11px] text-ink-900">
              &#10003;
            </span>
          )}
          <span>{bericht.tekst}</span>
          {bericht.ongedaan && (
            <button
              type="button"
              onClick={maakOngedaan}
              disabled={bezig}
              className="-my-1 min-h-[36px] rounded-md px-2 font-bold text-amber-400 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-60"
            >
              {bezig ? 'Bezig…' : bericht.ongedaan.label ?? 'Ongedaan maken'}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              stopTimer();
              setBericht(null);
            }}
            aria-label="Melding sluiten"
            className={`-my-1 -mr-1 flex h-8 w-8 items-center justify-center rounded-md opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${fouts ? '' : 'text-white'}`}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      )}
    </div>
  );
}

/** Globale toast: leest ?ok / ?fout uit de URL en meldingen via toon(), en toont kort een melding. */
export default function Toast() {
  return (
    <Suspense fallback={null}>
      <ToastInner />
    </Suspense>
  );
}
