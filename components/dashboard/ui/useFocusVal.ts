'use client';
import { useEffect, useRef, type RefObject } from 'react';

const FOCUSBAAR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Houdt de toetsenbordfocus binnen een venster zolang het open is:
 * Tab en Shift+Tab lopen rond, Escape sluit, en bij sluiten gaat de focus terug
 * naar het element dat het venster opende. De pagina erachter scrolt niet mee.
 *
 * `beginFocus` kiest het element dat bij openen de focus krijgt (bijv. de
 * veilige knop in een bevestiging); zonder keuze het eerste focusbare element.
 */
export function useFocusVal(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onSluit: () => void,
  beginFocus?: RefObject<HTMLElement | null>,
) {
  const sluitRef = useRef(onSluit);
  sluitRef.current = onSluit;

  useEffect(() => {
    if (!open) return;
    const vorigeFocus = document.activeElement as HTMLElement | null;
    const scrollSlot = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusbaar = () => (ref.current ? Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSBAAR)) : []);
    const t = setTimeout(() => {
      (beginFocus?.current ?? focusbaar()[0] ?? ref.current)?.focus();
    }, 0);

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        sluitRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const rij = focusbaar();
      if (rij.length === 0) {
        e.preventDefault();
        return;
      }
      const eerste = rij[0];
      const laatste = rij[rij.length - 1];
      const binnen = ref.current?.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === eerste || !binnen)) {
        e.preventDefault();
        laatste.focus();
      } else if (!e.shiftKey && (document.activeElement === laatste || !binnen)) {
        e.preventDefault();
        eerste.focus();
      }
    }

    document.addEventListener('keydown', onKey, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = scrollSlot;
      vorigeFocus?.focus?.();
    };
    // ref en beginFocus zijn stabiele refs; alleen open bepaalt of de val actief is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}
