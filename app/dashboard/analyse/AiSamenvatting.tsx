'use client';

import { useActionState } from 'react';
import { aiSamenvattingActie, type AiSamenvattingResultaat } from './actions';

const beginstand: AiSamenvattingResultaat = {};

/**
 * Knop die de cijfers van de gekozen periode laat samenvatten. Alleen de
 * periode gaat mee; de server rekent de cijfers zelf opnieuw uit.
 */
export default function AiSamenvatting({ params, periodeLabel }: { params: Record<string, string>; periodeLabel: string }) {
  const [state, actie, bezig] = useActionState(aiSamenvattingActie, beginstand);
  const verouderd = !!state?.periode && state.periode !== periodeLabel;

  return (
    <div>
      <form action={actie} className="flex flex-wrap items-center gap-3">
        {Object.entries(params).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <button type="submit" disabled={bezig} className="knop-donker">
          {bezig ? 'Even rekenen…' : state?.tekst ? 'Opnieuw samenvatten' : `Vat ${periodeLabel} samen`}
        </button>
        <span className="text-[12px] text-warm">Neemt verkoop, producten, klanten, funnel en operatie mee.</span>
      </form>

      {state?.error && (
        <p role="alert" className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-[13px] font-medium text-amber-800">{state.error}</p>
      )}

      {state?.tekst && (
        <div className="mt-3 rounded-md border border-line bg-mist px-4 py-3">
          {verouderd && <p className="mb-2 text-[12px] font-semibold text-amber-800">Dit gaat over {state.periode}. Klik opnieuw voor {periodeLabel}.</p>}
          <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-800">{state.tekst}</div>
        </div>
      )}
    </div>
  );
}
