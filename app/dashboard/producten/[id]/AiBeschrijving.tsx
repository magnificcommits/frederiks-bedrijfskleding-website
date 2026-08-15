'use client';

import { useActionState, useState } from 'react';
import { genereerBeschrijvingActie } from './actions';

type Props = {
  naam: string;
  merk: string;
  categorie: string;
  materiaal: string;
  normeringen: string;
};

const beginstand: { tekst?: string; error?: string } = {};

export default function AiBeschrijving({ naam, merk, categorie, materiaal, normeringen }: Props) {
  const [state, actie, bezig] = useActionState(genereerBeschrijvingActie, beginstand);
  const [gekopieerd, setGekopieerd] = useState(false);

  async function kopieer() {
    if (!state?.tekst) return;
    try {
      await navigator.clipboard.writeText(state.tekst);
      setGekopieerd(true);
      setTimeout(() => setGekopieerd(false), 2000);
    } catch {
      setGekopieerd(false);
    }
  }

  return (
    <div className="sm:col-span-2 rounded-xl border border-line bg-mist p-4">
      <form action={actie} className="flex flex-col gap-2">
        <input type="hidden" name="naam" value={naam} />
        <input type="hidden" name="merk" value={merk} />
        <input type="hidden" name="categorie" value={categorie} />
        <input type="hidden" name="materiaal" value={materiaal} />
        <input type="hidden" name="normeringen" value={normeringen} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-warm">
            Laat AI een eerste opzet maken op basis van de huidige productvelden. Bewerk de tekst zelf
            en plak hem in het omschrijving-veld hierboven.
          </p>
          <button
            type="submit"
            disabled={bezig}
            className="shrink-0 knop-donker disabled:opacity-60"
          >
            {bezig ? 'Bezig…' : 'Genereer beschrijving met AI'}
          </button>
        </div>
      </form>

      {state?.error && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
          {state.error}
        </p>
      )}

      {state?.tekst && (
        <div className="mt-3">
          <textarea
            readOnly
            value={state.tekst}
            rows={4}
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
          <button
            type="button"
            onClick={kopieer}
            className="mt-2 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-mist"
          >
            {gekopieerd ? 'Gekopieerd' : 'Kopieer'}
          </button>
        </div>
      )}
    </div>
  );
}
