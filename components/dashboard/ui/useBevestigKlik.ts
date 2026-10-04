'use client';
import { useRef, type MouseEvent, type ReactNode } from 'react';
import { bevestig, lijktGevaarlijk, splitsVraag } from './Bevestig';

/** Haalt de zichtbare tekst uit knop-children, voor het label in het venster. */
function tekstVan(children: ReactNode): string | undefined {
  if (typeof children === 'string') return children.trim() || undefined;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) {
    const delen = children.map(tekstVan).filter(Boolean);
    return delen.length ? delen.join(' ') : undefined;
  }
  return undefined;
}

/**
 * Klikhandler voor een verzendknop die eerst om bevestiging vraagt. Na "ja"
 * klikken we de knop opnieuw, zodat het formulier precies zo verstuurd wordt
 * als zonder vraag (inclusief name/value en formAction van de knop).
 */
export function useBevestigKlik(
  vraag: string,
  opties: { children?: ReactNode; className?: string; titel?: string; bevestigLabel?: string } = {},
) {
  const doorlaten = useRef(false);
  return (e: MouseEvent<HTMLButtonElement>) => {
    if (doorlaten.current) {
      doorlaten.current = false;
      return;
    }
    e.preventDefault();
    const knop = e.currentTarget;
    const delen = opties.titel ? { titel: opties.titel, tekst: vraag } : splitsVraag(vraag);
    const gevaar = lijktGevaarlijk(vraag) || /\bred-|gevaar/.test(opties.className ?? '');
    // Een knop met alleen een kruisje of icoon geeft geen bruikbaar label.
    const knopTekst = tekstVan(opties.children);
    void bevestig(
      {
        ...delen,
        gevaar,
        bevestigLabel: opties.bevestigLabel ?? (knopTekst && knopTekst.length > 2 ? knopTekst : undefined),
      },
      knop,
    ).then((ja) => {
      if (!ja || !knop.isConnected) return;
      doorlaten.current = true;
      knop.click();
    });
  };
}
