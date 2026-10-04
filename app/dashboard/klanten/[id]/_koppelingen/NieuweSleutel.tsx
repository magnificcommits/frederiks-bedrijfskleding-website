'use client';
import { useActionState, useState } from 'react';
import VerzendKnop from '@/components/dashboard/VerzendKnop';
import { maakApiSleutelActie, type SleutelStaat } from './actions';

/**
 * Sleutel aanmaken. De volledige sleutel staat alleen in het antwoord van de actie en
 * verdwijnt zodra je de pagina verlaat; in de database staat alleen de hash.
 */
export default function NieuweSleutel({ orgId, magBeheren }: { orgId: string; magBeheren: boolean }) {
  const [staat, actie] = useActionState<SleutelStaat, FormData>(maakApiSleutelActie, null);
  const [gekopieerd, setGekopieerd] = useState(false);

  if (!magBeheren) {
    return <p className="text-[13px] text-warm">Alleen de eigenaar kan sleutels aanmaken of intrekken.</p>;
  }

  return (
    <div className="space-y-3">
      {staat?.sleutel && (
        <div className="rounded-md border border-green-300 bg-green-50 p-3" role="status">
          <p className="text-[13px] font-semibold text-green-900">Sleutel &ldquo;{staat.naam}&rdquo; aangemaakt. Kopieer hem nu: je ziet hem maar één keer.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded bg-white px-2 py-1.5 font-mono text-[12px] text-ink-900">{staat.sleutel}</code>
            <button
              type="button"
              className="knop-stil"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(staat.sleutel ?? '');
                  setGekopieerd(true);
                } catch {
                  setGekopieerd(false);
                }
              }}
            >
              {gekopieerd ? 'Gekopieerd' : 'Kopiëren'}
            </button>
          </div>
          <p className="mt-2 text-[12px] text-green-900">Stuur hem veilig naar de klant (bijvoorbeeld via een wachtwoordmanager), niet in een gewone mail.</p>
        </div>
      )}
      {staat?.fout && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] font-semibold text-ink-800" role="alert">{staat.fout}</p>
      )}
      <form action={actie} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <input type="hidden" name="organisatie_id" value={orgId} />
        <div>
          <label htmlFor="api-naam" className="veld-label">Naam van de sleutel</label>
          <input id="api-naam" name="naam" required maxLength={80} placeholder="Bijvoorbeeld: AFAS HR-koppeling" className="veld" />
        </div>
        <VerzendKnop className="knop-donker" bezigTekst="Aanmaken…">Sleutel aanmaken</VerzendKnop>
        <label className="flex items-center gap-2 text-[12px] text-ink-700 sm:col-span-2">
          <input type="checkbox" name="alleen_lezen" />
          Alleen lezen (de koppeling kan medewerkers opvragen, maar niets wijzigen)
        </label>
      </form>
    </div>
  );
}
