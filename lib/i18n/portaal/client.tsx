'use client';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { maakVertaler, type Taal, type Vertaler } from './kern';
import { nl, type Woordenboek } from './nl';

/**
 * Vertalingen in client components. De portaal-layout zet <TaalProvider> neer met
 * alleen het woordenboek van de gekozen taal (geen vier talen in de bundel).
 * Buiten de provider (bijv. gedeelde componenten in het KMS) is het Nederlands.
 */
const VertalerContext = createContext<Vertaler>(maakVertaler('nl', nl));

export function TaalProvider({ taal, woordenboek, children }: { taal: Taal; woordenboek: Woordenboek; children: ReactNode }) {
  const waarde = useMemo(() => maakVertaler(taal, woordenboek), [taal, woordenboek]);
  return <VertalerContext.Provider value={waarde}>{children}</VertalerContext.Provider>;
}

export function useVertaler(): Vertaler {
  return useContext(VertalerContext);
}
