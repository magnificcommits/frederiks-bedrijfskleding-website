'use client';

import { useEffect, useRef } from 'react';
import { bevestigActie } from './actions';

/**
 * Formulier met één knop dat zichzelf na het laden verstuurt. Zo bevestigt een
 * echte klik in de mail meteen, maar een virusscanner die alleen de link opent
 * (zonder JavaScript) schrijft niemand in. Zonder JavaScript werkt de knop gewoon.
 */
export default function AutoBevestig({ token, auto = true }: { token: string; auto?: boolean }) {
  const form = useRef<HTMLFormElement>(null);
  const verstuurd = useRef(false);
  useEffect(() => {
    if (!auto || verstuurd.current) return;
    verstuurd.current = true;
    form.current?.requestSubmit();
  }, [auto]);
  return (
    <form ref={form} action={bevestigActie} className="mt-6">
      <input type="hidden" name="t" value={token} />
      <button type="submit" className="btn-primary">Ja, schrijf me in</button>
    </form>
  );
}
