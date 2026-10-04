'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Meldingen die na een actie in de URL staan (?ok=status, ?gemaild=1 …). Bij een
 * nieuwe zoekterm horen die niet meer bij wat je ziet, dus die gaan eruit.
 */
const MELDINGPARAMS = ['ok', 'fout', 'melding', 'gemaild', 'mailfout', 'aantal', 'gelukt', 'mislukt', 'over', 'rest'];

/**
 * Live zoekveld voor een lijst die server-side filtert op een URL-parameter.
 *
 * - Terwijl je typt wordt na ~250 ms de parameter in de URL bijgewerkt met
 *   `router.replace`. De server rendert de lijst opnieuw; de oude resultaten
 *   blijven staan tot de nieuwe binnen zijn (transition), met een spinnertje
 *   in het veld zolang dat duurt.
 * - Alle andere parameters (status, branche, sortering) blijven staan; de
 *   paginering gaat terug naar pagina 1.
 * - De tekst staat in lokale state en wordt niet door de server-render
 *   overschreven, dus focus en cursor blijven waar ze zijn. Verandert de URL
 *   van buitenaf (een chip "Alles wissen"), dan volgt het veld.
 * - Escape of de ×-knop maakt het veld leeg.
 * - Zonder JavaScript is het een gewoon GET-formulier: Enter verstuurt het,
 *   met de andere filters als verborgen velden.
 */
export default function LiveZoekveld({
  param = 'q',
  paginaParam = 'pagina',
  placeholder,
  label,
  ariaLabel,
  breedte = 'w-72',
  className = '',
  vertraging = 250,
  vergeet = MELDINGPARAMS,
  leegBehouden = false,
  vast,
  autoFocus = false,
}: {
  /** Naam van de zoekparameter in de URL. */
  param?: string;
  /** Naam van de paginaparameter; die wordt bij een nieuwe zoekterm gewist. */
  paginaParam?: string;
  placeholder: string;
  /** Zichtbaar label boven het veld. Zonder label krijgt het veld een aria-label. */
  label?: string;
  ariaLabel?: string;
  /** Tailwind-breedte van het formulier, bijv. `w-72` of `w-full`. */
  breedte?: string;
  /** Extra klassen op het invoerveld. */
  className?: string;
  /** Wachttijd in ms tussen de laatste toetsaanslag en de nieuwe zoekopdracht. */
  vertraging?: number;
  /** Parameters die bij een nieuwe zoekterm uit de URL verdwijnen. */
  vergeet?: string[];
  /** Een leeg veld als `?param=` laten staan in plaats van de parameter te wissen. */
  leegBehouden?: boolean;
  /** Parameters die altijd mee moeten, bijv. `{ tab: 'adressen' }`. */
  vast?: Record<string, string>;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const urlWaarde = sp.get(param) ?? '';
  const id = useId();
  const invoer = useRef<HTMLInputElement>(null);

  // Lokale state, beginwaarde uit de URL. Een server-render raakt dit niet aan.
  const [tekst, setTekst] = useState(urlWaarde);
  const [bezig, startTransition] = useTransition();
  // Laatste waarde die dit veld zelf naar de URL heeft gestuurd.
  const verstuurd = useRef(urlWaarde.trim());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function stopTimer() {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function zoek(waarde: string) {
    stopTimer();
    const schoon = waarde.trim();
    if (schoon === verstuurd.current) return;
    verstuurd.current = schoon;
    // Altijd uit de actuele URL: tussen typen en versturen kan een filter zijn veranderd.
    const p = new URLSearchParams(window.location.search);
    if (schoon || leegBehouden) p.set(param, schoon);
    else p.delete(param);
    p.delete(paginaParam);
    for (const k of vergeet) p.delete(k);
    for (const [k, v] of Object.entries(vast ?? {})) p.set(k, v);
    const qs = p.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  function wijzig(waarde: string) {
    setTekst(waarde);
    stopTimer();
    timer.current = setTimeout(() => {
      timer.current = null;
      zoek(waarde);
    }, vertraging);
  }

  function wis() {
    setTekst('');
    zoek('');
    invoer.current?.focus();
  }

  // De URL veranderde van buitenaf (chip, "Alles wissen", terugknop): veld volgt.
  // Niet terwijl je typt of terwijl onze eigen zoekopdracht nog loopt; dan kan
  // er een tussenstand binnenkomen die je getypte tekst zou terugzetten.
  useEffect(() => {
    if (urlWaarde.trim() === verstuurd.current) return;
    if (timer.current !== null || bezig) return;
    verstuurd.current = urlWaarde.trim();
    setTekst(urlWaarde);
  }, [urlWaarde, bezig]);

  useEffect(() => stopTimer, []);

  // Verborgen velden voor de versie zonder JavaScript: de andere filters reizen mee.
  const bewaren: [string, string][] = [
    ...[...sp.entries()].filter(([k]) => k !== param && k !== paginaParam && !vergeet.includes(k) && !(vast && k in vast)),
    ...Object.entries(vast ?? {}),
  ];

  return (
    <form
      method="get"
      role="search"
      className={/(^|\s)max-w-/.test(breedte) ? breedte : `${breedte} max-w-full`}
      onSubmit={(e) => {
        e.preventDefault();
        zoek(tekst);
      }}
    >
      {label && (
        <label htmlFor={id} className="veld-label">
          {label}
        </label>
      )}
      {bewaren.map(([k, v], i) => (
        <input key={`${k}-${i}`} type="hidden" name={k} value={v} />
      ))}
      <div className="relative">
        <input
          ref={invoer}
          id={id}
          type="search"
          name={param}
          value={tekst}
          onChange={(e) => wijzig(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && tekst) {
              e.preventDefault();
              wis();
            }
          }}
          placeholder={placeholder}
          aria-label={label ? undefined : ariaLabel ?? placeholder}
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          className={`veld pr-14 [&::-webkit-search-cancel-button]:appearance-none ${className}`}
        />
        <span className="absolute inset-y-0 right-1.5 flex items-center gap-1">
          {bezig && (
            <span
              className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-300 border-t-transparent"
              aria-hidden="true"
            />
          )}
          {tekst && (
            <button
              type="button"
              onClick={wis}
              className="flex h-6 w-6 items-center justify-center rounded text-[16px] leading-none text-warm hover:bg-mist hover:text-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              aria-label="Zoekveld leegmaken"
              title="Leegmaken (Esc)"
            >
              ×
            </button>
          )}
        </span>
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {bezig ? 'Zoekresultaten worden geladen' : ''}
      </span>
      {/* Voor Enter zonder JavaScript. Met JavaScript zoekt het veld al terwijl je typt. */}
      <button type="submit" tabIndex={-1} className="sr-only">
        Zoeken
      </button>
    </form>
  );
}
