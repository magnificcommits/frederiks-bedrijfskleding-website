'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { genereerActie, aiStatusActie, type AiResultaat } from './actions';

const soorten: { waarde: string; label: string }[] = [
  { waarde: 'kennisbank', label: 'Kennisbankartikel' },
  { waarde: 'product', label: 'Productbeschrijving' },
  { waarde: 'email', label: 'Klant-e-mail' },
  { waarde: 'rapportage', label: 'Rapportage-samenvatting' },
];

const beginstand: AiResultaat = {};

export default function AiAssistentPage() {
  const router = useRouter();
  const [aiAan, setAiAan] = useState<boolean | null>(null);
  const [state, actie, bezig] = useActionState(genereerActie, beginstand);

  // Auth- en configuratiestatus server-side ophalen. Niet ingelogd -> terug
  // naar het dashboard. De AI-key blijft volledig server-side.
  useEffect(() => {
    let actief = true;
    aiStatusActie().then((s) => {
      if (!actief) return;
      if (!s.authed) {
        router.replace('/dashboard');
        return;
      }
      setAiAan(s.aiAan);
    });
    return () => {
      actief = false;
    };
  }, [router]);

  return (
    <main className="container-x py-8">
      <h1 className="font-display text-2xl font-extrabold text-ink-900">AI-assistent</h1>
      <p className="mt-0.5 max-w-2xl text-sm text-warm">
        Laat de assistent een eerste opzet maken: een kennisbankartikel, een productbeschrijving,
        een klant-e-mail of een korte rapportage-samenvatting. Kies een soort, geef een onderwerp of
        instructie en bewerk de tekst daarna zelf.
      </p>

      {aiAan === false && (
        <p className="mt-4 max-w-2xl rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
          AI staat nog uit — zet <code>OPENAI_API_KEY</code> in Vercel om dit te activeren. Je kunt
          het formulier alvast bekijken.
        </p>
      )}

      <form action={actie} className="mt-6 max-w-2xl space-y-4">
        <div>
          <label htmlFor="soort" className="block text-sm font-semibold text-ink-800">
            Soort tekst
          </label>
          <select
            id="soort"
            name="soort"
            defaultValue="kennisbank"
            className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
          >
            {soorten.map((s) => (
              <option key={s.waarde} value={s.waarde}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="onderwerp" className="block text-sm font-semibold text-ink-800">
            Onderwerp of instructie
          </label>
          <textarea
            id="onderwerp"
            name="onderwerp"
            rows={5}
            placeholder="Bijv. een artikel over het kiezen van de juiste veiligheidsschoen-categorie, of een productbeschrijving voor een gevoerde softshell jas."
            className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
        </div>

        <button type="submit" disabled={bezig} className="btn-primary disabled:opacity-60">
          {bezig ? 'Bezig met genereren…' : 'Genereer'}
        </button>
      </form>

      {state?.error && (
        <p className="mt-5 max-w-2xl rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
          {state.error}
        </p>
      )}

      {state?.tekst && (
        <section className="mt-5 max-w-2xl rounded-xl border border-line bg-white p-4 shadow-soft">
          <h2 className="font-display text-base font-bold text-ink-900">Resultaat</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-800">
            {state.tekst}
          </p>
        </section>
      )}
    </main>
  );
}
