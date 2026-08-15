'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Lade die vanaf rechts inschuift. Vervangt de aanmaakformulieren die
 * permanent naast de lijst stonden: de tabel krijgt daardoor de volle breedte
 * en het formulier krijgt de ruimte die het nodig heeft.
 *
 * De inhoud (`children`) wordt server-side gerenderd en hier alleen getoond,
 * zodat de bestaande server actions ongewijzigd blijven werken.
 */
export default function Drawer({
  knop,
  titel,
  beschrijving,
  breedte = 'sm:max-w-md',
  children,
}: {
  knop: string;
  titel: string;
  beschrijving?: string;
  breedte?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const paneel = useRef<HTMLDivElement>(null);

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
      // Tab houden we binnen de lade: anders loop je door de lijst erachter.
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

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="knop-primair">
        {knop}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={titel}>
          <button type="button" aria-label="Sluiten" onClick={() => setOpen(false)} className="drawer-overlay" />
          <div ref={paneel} className={`drawer-paneel relative flex h-full w-full ${breedte} flex-col border-l border-line bg-white`}>
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-3">
              <div>
                <h2 className="font-display text-base font-bold text-ink-900">{titel}</h2>
                {beschrijving && <p className="veld-hint mt-0.5">{beschrijving}</p>}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Sluiten"
                className="knop-tekst -mr-1 shrink-0 text-base"
              >
                Sluiten
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}
