'use client';

import { useActionState, useEffect, useState } from 'react';
import { aiOpvolgmailActie } from './actions';

type Props = {
  naam: string;
  bedrijf: string;
  branche: string;
  bericht: string;
  status: string;
  /** Laatste tijdlijnregels, zodat de mail aansluit op wat er al besproken is. */
  context?: string;
  /** E-mailadres van de lead: dan kan het concept direct in een nieuwe mail. */
  email?: string | null;
  /** Meteen uitgeklapt tonen (detailpagina). */
  open?: boolean;
};

const beginstand: { tekst?: string; error?: string } = {};

export default function AiOpvolg({ naam, bedrijf, branche, bericht, status, context = '', email = null, open: beginOpen = false }: Props) {
  const [state, actie, bezig] = useActionState(aiOpvolgmailActie, beginstand);
  const [open, setOpen] = useState(beginOpen);
  const [tekst, setTekst] = useState('');
  const [gekopieerd, setGekopieerd] = useState(false);

  // Nieuw concept binnen: in het bewerkbare veld zetten.
  useEffect(() => {
    if (state?.tekst) setTekst(state.tekst);
  }, [state?.tekst]);

  async function kopieer() {
    if (!tekst) return;
    try {
      await navigator.clipboard.writeText(tekst);
      setGekopieerd(true);
      setTimeout(() => setGekopieerd(false), 2000);
    } catch {
      setGekopieerd(false);
    }
  }

  const onderwerp = `Je aanvraag bij Frederiks Bedrijfskleding${bedrijf ? ` (${bedrijf})` : ''}`;
  const mailHref = email && tekst ? `mailto:${email}?subject=${encodeURIComponent(onderwerp)}&body=${encodeURIComponent(tekst)}` : null;

  return (
    <div>
      {!beginOpen && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="knop-tekst -ml-2" aria-expanded={open}>
          {open ? 'Verberg AI-opvolgmail' : 'AI-opvolgmail'}
        </button>
      )}

      {open && (
        <div className={beginOpen ? '' : 'mt-2'}>
          <form action={actie}>
            <input type="hidden" name="naam" value={naam} />
            <input type="hidden" name="bedrijf" value={bedrijf} />
            <input type="hidden" name="branche" value={branche} />
            <input type="hidden" name="bericht" value={bericht} />
            <input type="hidden" name="status" value={status} />
            <input type="hidden" name="context" value={context} />
            <button type="submit" disabled={bezig} className="knop-stil w-full disabled:cursor-wait disabled:opacity-70">
              {bezig ? 'Concept schrijven…' : tekst ? 'Nieuw concept' : 'Schrijf concept-mail'}
            </button>
          </form>

          {state?.error && (
            <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-[12px] font-medium text-amber-800">{state.error}</p>
          )}

          {tekst && (
            <div className="mt-2">
              <label className="sr-only" htmlFor="ai-concept">Concept-mail</label>
              <textarea id="ai-concept" value={tekst} onChange={(e) => setTekst(e.target.value)} rows={9} className="veld leading-relaxed" />
              <div className="mt-1.5 flex flex-wrap gap-2">
                <button type="button" onClick={kopieer} className="knop-stil">
                  {gekopieerd ? 'Gekopieerd' : 'Kopieer'}
                </button>
                {mailHref && (
                  <a href={mailHref} className="knop-stil">Open in mail</a>
                )}
              </div>
              <p className="veld-hint">Lees het na voor je het verstuurt. Leg daarna op de tijdlijn vast dat je gemaild hebt.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
