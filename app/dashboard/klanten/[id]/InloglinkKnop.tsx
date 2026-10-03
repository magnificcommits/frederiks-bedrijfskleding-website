'use client';

import { useState, useTransition } from 'react';
import { maakInloglinkActie } from './actions';

/**
 * "Inloglink maken" bij een portaalgebruiker: een eenmalige link waarmee je
 * zonder mail als deze gebruiker in het portaal komt. Handig om te testen wat een
 * medewerker ziet, of als een klant de inlogmail niet krijgt.
 */
export default function InloglinkKnop({ gebruikerId }: { gebruikerId: string }) {
  const [bezig, start] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [gekopieerd, setGekopieerd] = useState(false);

  function maak() {
    setFout(null);
    setGekopieerd(false);
    start(async () => {
      const r = await maakInloglinkActie(gebruikerId);
      if (r.ok) setLink(r.link);
      else setFout(r.fout);
    });
  }

  async function kopieer() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setGekopieerd(true);
    } catch {
      setGekopieerd(false);
    }
  }

  if (link) {
    return (
      <div className="flex max-w-md flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="veld py-1 text-[12px]" aria-label="Inloglink" />
          <button type="button" onClick={kopieer} className="knop-donker shrink-0">
            {gekopieerd ? 'Gekopieerd' : 'Kopieer'}
          </button>
        </div>
        <p className="text-[11px] text-warm">
          Plak hem in een incognitovenster, anders word je hier uitgelogd. Werkt één keer, binnen een uur.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button type="button" onClick={maak} disabled={bezig} className="knop-stil disabled:cursor-wait disabled:opacity-70">
        {bezig ? 'Link maken…' : 'Inloglink maken'}
      </button>
      {fout && <p className="text-[11px] text-red-700">{fout}</p>}
    </div>
  );
}
