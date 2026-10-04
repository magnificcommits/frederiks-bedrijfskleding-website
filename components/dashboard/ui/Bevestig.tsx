'use client';
import { useRef, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { useFocusVal } from './useFocusVal';

/**
 * Eigen bevestigingsvenster in plaats van window.confirm. Het browservenster
 * oogt als een foutmelding, is op een tablet klein en zegt niet wat er gebeurt.
 * Dit venster noemt de handeling op de knop ("Verwijderen" i.p.v. "OK"),
 * zet bij iets onomkeerbaars de focus op Annuleren en sluit met Escape.
 *
 * Gebruik in clientcode:  if (!(await bevestig({ titel: 'Regel verwijderen?' }))) return;
 * In een server-formulier: <ConfirmSubmit message="...">Verwijderen</ConfirmSubmit>
 */

export type BevestigOpties = {
  titel: string;
  /** Wat er precies gebeurt, en of het terug te draaien is. */
  tekst?: ReactNode;
  /** Label van de bevestigknop: het werkwoord van de handeling. */
  bevestigLabel?: string;
  annuleerLabel?: string;
  /** Rood en focus op Annuleren: voor verwijderen en andere onomkeerbare acties. */
  gevaar?: boolean;
};

type Taal = 'nl' | 'en' | 'de' | 'pl';
const STANDAARD: Record<Taal, { titel: string; doorgaan: string; annuleren: string }> = {
  nl: { titel: 'Weet je het zeker?', doorgaan: 'Doorgaan', annuleren: 'Annuleren' },
  en: { titel: 'Are you sure?', doorgaan: 'Continue', annuleren: 'Cancel' },
  de: { titel: 'Bist du sicher?', doorgaan: 'Weiter', annuleren: 'Abbrechen' },
  pl: { titel: 'Czy na pewno?', doorgaan: 'Dalej', annuleren: 'Anuluj' },
};

/** De taal van het stuk pagina waar de knop staat (het portaal zet lang op een wrapper). */
export function taalBij(el: Element | null | undefined): Taal {
  const lang = (el?.closest('[lang]')?.getAttribute('lang') ?? document.documentElement.lang ?? 'nl').slice(0, 2);
  return (['nl', 'en', 'de', 'pl'] as const).includes(lang as Taal) ? (lang as Taal) : 'nl';
}

export function standaardTeksten(taal: Taal) {
  return STANDAARD[taal];
}

const GEVAAR_WOORDEN = /verwijder|intrek|weghal|weg halen|uitzet|ontkoppel|non-actief|wissen|annuleer|delete|remove|revoke|lösch|entfern|usuń|wycofa/i;

/** Raadt of een vraag over iets onomkeerbaars gaat. */
export function lijktGevaarlijk(tekst: string): boolean {
  return GEVAAR_WOORDEN.test(tekst);
}

/**
 * Splitst een losse zin als "Logo X verwijderen? Op werkbonnen blijft de regel staan."
 * in een titel (de vraag) en een uitleg (de rest).
 */
export function splitsVraag(bericht: string): { titel: string; tekst?: string } {
  const m = bericht.match(/^(.{3,160}?\?)\s+([\s\S]+)$/);
  if (m) return { titel: m[1], tekst: m[2] };
  return { titel: bericht };
}

export function BevestigVenster({
  opties,
  taal = 'nl',
  onKeuze,
}: {
  opties: BevestigOpties;
  taal?: Taal;
  onKeuze: (ja: boolean) => void;
}) {
  const paneel = useRef<HTMLDivElement>(null);
  const annuleer = useRef<HTMLButtonElement>(null);
  const ja = useRef<HTMLButtonElement>(null);
  const std = STANDAARD[taal];
  useFocusVal(paneel, true, () => onKeuze(false), opties.gevaar ? annuleer : ja);

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => onKeuze(false)}
        className="drawer-overlay"
      />
      <div
        ref={paneel}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="bevestig-titel"
        aria-describedby={opties.tekst ? 'bevestig-tekst' : undefined}
        className="bevestig-paneel relative w-full max-w-md rounded-t-2xl border border-line bg-white p-5 shadow-card sm:rounded-xl"
      >
        <h2 id="bevestig-titel" className="font-display text-lg font-bold leading-snug text-ink-900">
          {opties.titel}
        </h2>
        {opties.tekst && (
          <div id="bevestig-tekst" className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-warm">
            {opties.tekst}
          </div>
        )}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button ref={annuleer} type="button" onClick={() => onKeuze(false)} className="knop-stil knop-groot">
            {opties.annuleerLabel ?? std.annuleren}
          </button>
          <button
            ref={ja}
            type="button"
            onClick={() => onKeuze(true)}
            className={`${opties.gevaar ? 'knop-gevaar' : 'knop-primair'} knop-groot`}
          >
            {opties.bevestigLabel ?? std.doorgaan}
          </button>
        </div>
      </div>
    </div>
  );
}

let open = false;

/**
 * Vraagt om bevestiging en geeft true terug bij "ja". Werkt overal in de
 * browser zonder provider: het venster krijgt een eigen plek onder <body>.
 */
export function bevestig(invoer: BevestigOpties | string, bron?: Element | null): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(false);
  const opties: BevestigOpties = typeof invoer === 'string' ? { ...splitsVraag(invoer), gevaar: lijktGevaarlijk(invoer) } : invoer;
  // Nooit twee vensters tegelijk (bijv. dubbelklik): de tweede vraag telt als nee.
  if (open) return Promise.resolve(false);
  open = true;
  const taal = taalBij(bron ?? document.activeElement);
  const houder = document.createElement('div');
  document.body.appendChild(houder);
  const root = createRoot(houder);
  return new Promise<boolean>((resolve) => {
    const klaar = (ja: boolean) => {
      open = false;
      // Eerst de focus terug laten gaan (cleanup van de focusval), dan opruimen.
      root.unmount();
      houder.remove();
      resolve(ja);
    };
    root.render(<BevestigVenster opties={opties} taal={taal} onKeuze={klaar} />);
  });
}
