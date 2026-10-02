'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Venster voor aanmaak- en bewerkformulieren in het dashboard.
 *
 * Op een computer opent het als een groot venster midden in beeld, op een
 * telefoon of smalle tablet als een scherm over de volle breedte. Zo is een
 * formulier altijd goed leesbaar en hoef je niet in een smal strookje te typen.
 *
 * Het venster wordt via een portal direct onder <body> gezet. Dat is nodig: de
 * paginakop (.dash-kop) gebruikt backdrop-blur, en een element met een filter
 * wordt in de browser het ankerpunt voor alles met `position: fixed` erin. Een
 * Drawer in die kop bleef daardoor opgesloten in de kop zelf, als een klein
 * scherm rechtsboven. Via de portal hangt het venster altijd aan het hele scherm.
 *
 * De inhoud (`children`) wordt server-side gerenderd en hier alleen getoond,
 * zodat de bestaande server actions ongewijzigd blijven werken.
 *
 * - `breedte`: Tailwind max-width voor het venster (standaard ruim: sm:max-w-2xl).
 * - `soort`: 'venster' (standaard, gecentreerd) of 'lade' (schuift van rechts in).
 * - `knopKlasse`: opmaak van de openknop (standaard knop-primair).
 */
export default function Drawer({
  knop,
  titel,
  beschrijving,
  breedte = 'sm:max-w-2xl',
  soort = 'venster',
  knopKlasse = 'knop-primair',
  children,
}: {
  knop: string;
  titel: string;
  beschrijving?: string;
  breedte?: string;
  soort?: 'venster' | 'lade';
  knopKlasse?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [gemount, setGemount] = useState(false);
  const paneel = useRef<HTMLDivElement>(null);
  const verzonden = useRef(false);
  // Opslaan duurt op de server een paar seconden. Zonder teken lijkt er dan niets te
  // gebeuren, dus tonen we een balk 'Bezig met opslaan' en zetten we de knoppen
  // van dat formulier uit (geen dubbele klik). Komt er een nieuwe pagina, dan gaat
  // het venster dicht; blijft die uit (bv. een foutmelding), dan na 12 s weer vrij.
  const [bezig, setBezig] = useState(false);
  const bezigKnoppen = useRef<HTMLButtonElement[]>([]);
  const bezigTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function stopBezig() {
    if (bezigTimer.current) clearTimeout(bezigTimer.current);
    bezigTimer.current = null;
    bezigKnoppen.current.forEach((k) => {
      k.disabled = false;
      k.removeAttribute('aria-busy');
    });
    bezigKnoppen.current = [];
    setBezig(false);
  }

  function startBezig(form: HTMLFormElement | null) {
    setBezig(true);
    if (bezigTimer.current) clearTimeout(bezigTimer.current);
    bezigTimer.current = setTimeout(stopBezig, 12_000);
    if (!form) return;
    // Pas na deze event-ronde uitzetten, anders kan de browser het versturen afbreken.
    setTimeout(() => {
      const knoppen = Array.from(form.querySelectorAll<HTMLButtonElement>('button[type="submit"], button:not([type])'));
      knoppen.forEach((k) => {
        k.disabled = true;
        k.setAttribute('aria-busy', 'true');
      });
      bezigKnoppen.current = knoppen;
    }, 0);
  }

  // Na het versturen van een formulier stuurt de server actie terug naar de
  // pagina; die komt met nieuwe inhoud binnen. Dan is het formulier klaar en
  // gaat het venster vanzelf dicht. Mislukt het versturen zonder nieuwe pagina,
  // dan blijft het venster open en is er niets kwijt.
  useEffect(() => {
    if (!verzonden.current) return;
    verzonden.current = false;
    stopBezig();
    setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children]);

  // Venster dicht (Sluiten, Escape): eventuele bezig-stand opruimen.
  useEffect(() => {
    if (!open) stopBezig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // createPortal kan pas na de eerste render in de browser: op de server bestaat
  // document.body niet.
  useEffect(() => setGemount(true), []);

  useEffect(() => {
    if (!open) return;
    const vorigeFocus = document.activeElement as HTMLElement | null;
    const scrollSlot = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Cursor in het eerste invoerveld, zodat je direct kunt typen.
    paneel.current
      ?.querySelector<HTMLElement>('input:not([type="hidden"]), select, textarea')
      ?.focus();

    function focusbaar(): HTMLElement[] {
      if (!paneel.current) return [];
      return Array.from(
        paneel.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      // Tab houden we binnen het venster: anders loop je door de lijst erachter.
      if (e.key !== 'Tab') return;
      const rij = focusbaar();
      if (rij.length === 0) return;
      const eerste = rij[0];
      const laatste = rij[rij.length - 1];
      if (e.shiftKey && document.activeElement === eerste) {
        e.preventDefault();
        laatste.focus();
      } else if (!e.shiftKey && document.activeElement === laatste) {
        e.preventDefault();
        eerste.focus();
      }
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = scrollSlot;
      vorigeFocus?.focus();
    };
  }, [open]);

  const isLade = soort === 'lade';

  // Grotere, beter leesbare velden binnen het venster, zonder de rest van het
  // dashboard aan te passen.
  const leesbaar =
    '[&_.veld]:px-3 [&_.veld]:py-2.5 [&_.veld]:text-[15px] [&_.veld-label]:text-xs [&_.veld-hint]:text-[13px] [&_label]:text-[14px]';

  const venster = (
    <div
      className={`fixed inset-0 z-[70] flex ${
        isLade ? 'justify-end' : 'items-stretch justify-center sm:items-center sm:p-6'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={titel}
    >
      <button type="button" aria-label="Sluiten" onClick={() => setOpen(false)} className="drawer-overlay" />
      <div
        ref={paneel}
        onSubmitCapture={(e) => {
          verzonden.current = true;
          startBezig(e.target instanceof HTMLFormElement ? e.target : null);
        }}
        aria-busy={bezig || undefined}
        className={
          isLade
            ? `drawer-paneel relative flex h-full w-full ${breedte} flex-col border-l border-line bg-white shadow-card`
            : `relative flex h-full w-full ${breedte} flex-col overflow-hidden bg-white shadow-card sm:h-auto sm:max-h-[90vh] sm:rounded-2xl sm:border sm:border-line`
        }
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-display text-lg font-bold text-ink-900 sm:text-xl">{titel}</h2>
            {beschrijving && <p className="mt-1 text-[14px] leading-snug text-warm">{beschrijving}</p>}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Sluiten"
            className="knop-stil shrink-0 px-3 py-2 text-sm"
          >
            Sluiten
          </button>
        </div>
        {bezig && (
          <div role="status" className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-5 py-2 text-[14px] font-medium text-amber-900 sm:px-6">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" aria-hidden="true" />
            Bezig met opslaan…
          </div>
        )}
        <div className={`flex-1 overflow-y-auto px-5 py-5 sm:px-6 ${leesbaar}`}>{children}</div>
      </div>
    </div>
  );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={knopKlasse}>
        {knop}
      </button>
      {open && gemount && createPortal(venster, document.body)}
    </>
  );
}
