'use client';

import { useEffect, useRef, useState } from 'react';
import { scoreActie, toelichtingActie } from '../actions';

type Props = {
  token: string;
  opgeslagenScore: number | null;
  /** Het cijfer waarop in de mail is geklikt. */
  gevraagdeScore: number | null;
  naam: string;
  bedrijf: string;
  tekst: string;
  toestemming: boolean;
  googleLink: string;
};

/**
 * Score opslaan (het cijfer uit de mail) en daarna optioneel een toelichting.
 * Het opslaan gebeurt in de browser na het laden van de pagina, niet bij het
 * openen van de link: virusscanners in mailprogramma's openen alle links in een
 * mail, en dan zou elke klant automatisch een 0 geven.
 */
export default function Beoordeling({ token, opgeslagenScore, gevraagdeScore, naam, bedrijf, tekst, toestemming, googleLink }: Props) {
  const [score, setScore] = useState<number | null>(gevraagdeScore ?? opgeslagenScore);
  const [scoreStatus, setScoreStatus] = useState<'idle' | 'bezig' | 'ok' | 'fout'>(
    gevraagdeScore === null && opgeslagenScore !== null ? 'ok' : 'idle',
  );
  const [tekstStatus, setTekstStatus] = useState<'idle' | 'bezig' | 'ok' | 'fout'>('idle');
  const gedaan = useRef(false);

  async function kies(n: number) {
    setScore(n);
    setScoreStatus('bezig');
    const res = await scoreActie(token, n).catch(() => ({ ok: false }));
    setScoreStatus(res.ok ? 'ok' : 'fout');
  }

  useEffect(() => {
    if (gedaan.current) return;
    gedaan.current = true;
    if (gevraagdeScore !== null && gevraagdeScore !== opgeslagenScore) void kies(gevraagdeScore);
    else if (gevraagdeScore !== null) setScoreStatus('ok');
    // Eén keer bij het laden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verstuurTekst(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setTekstStatus('bezig');
    const res = await toelichtingActie(token, {
      tekst: String(fd.get('tekst') ?? ''),
      toestemming: fd.get('toestemming') === 'on',
      naam: String(fd.get('naam') ?? ''),
      bedrijf: String(fd.get('bedrijf') ?? ''),
    }).catch(() => ({ ok: false }));
    setTekstStatus(res.ok ? 'ok' : 'fout');
  }

  const veld =
    'mt-1 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink-800 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';
  const opgeslagen = scoreStatus === 'ok' && score !== null;
  const hoog = score !== null && score >= 9;
  const laag = score !== null && score <= 6;

  return (
    <div className="space-y-6">
      <div className="card">
        <p className="font-semibold text-ink-900">Hoe tevreden ben je over Frederiks?</p>
        <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Cijfer van 0 tot 10">
          {Array.from({ length: 11 }, (_, n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={score === n}
              onClick={() => kies(n)}
              disabled={scoreStatus === 'bezig'}
              className={`h-10 w-10 rounded-md border text-sm font-bold tabular-nums transition ${
                score === n ? 'border-amber-500 bg-amber-500 text-ink-900' : 'border-line bg-white text-ink-800 hover:border-ink-300'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-1 flex max-w-[30rem] justify-between text-xs text-warm">
          <span>helemaal niet</span>
          <span>heel tevreden</span>
        </div>
        {scoreStatus === 'bezig' && <p className="mt-3 text-sm text-warm">Opslaan…</p>}
        {scoreStatus === 'fout' && (
          <p className="mt-3 text-sm text-amber-800" role="alert">
            Opslaan lukte niet. Klik nog een keer op je cijfer.
          </p>
        )}
        {opgeslagen && (
          <p className="mt-3 text-sm text-ink-800" role="status">
            {hoog
              ? `Een ${score}, daar word ik blij van. Dank je wel!`
              : laag
                ? `Een ${score}. Dat is niet goed genoeg en dat wil ik weten. Ik neem zelf contact met je op.`
                : `Een ${score}, bedankt. Wat zou er beter kunnen? Vertel het hieronder.`}
          </p>
        )}
      </div>

      {opgeslagen && hoog && googleLink && (
        <div className="kaart-nadruk">
          <p className="font-semibold text-ink-900">Wil je dit ook op Google zetten?</p>
          <p className="mt-1 text-sm text-warm">
            Andere bedrijven in de Achterhoek kiezen vaak op basis van Google-reviews. Een paar zinnen helpen ons echt verder.
          </p>
          <a href={googleLink} target="_blank" rel="noopener noreferrer" className="btn-primary mt-4">
            Review schrijven op Google
          </a>
        </div>
      )}

      {opgeslagen && (
        <div className="card">
          {tekstStatus === 'ok' ? (
            <p className="text-ink-800" role="status">
              Ontvangen, dank je wel. {laag ? 'Je hoort snel van me.' : ''}
            </p>
          ) : (
            <form onSubmit={verstuurTekst} className="grid gap-4">
              <div>
                <label htmlFor="tekst" className="block text-sm font-medium text-ink-800">
                  {laag ? 'Wat ging er mis?' : hoog ? 'Wat beviel je het meest? (mag ook kort)' : 'Wat kan er beter?'}
                </label>
                <textarea id="tekst" name="tekst" rows={4} defaultValue={tekst} className={veld} maxLength={2000} />
              </div>
              {!laag && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="naam" className="block text-sm font-medium text-ink-800">Naam</label>
                      <input id="naam" name="naam" defaultValue={naam} className={veld} autoComplete="name" />
                    </div>
                    <div>
                      <label htmlFor="bedrijf" className="block text-sm font-medium text-ink-800">Bedrijf</label>
                      <input id="bedrijf" name="bedrijf" defaultValue={bedrijf} className={veld} autoComplete="organization" />
                    </div>
                  </div>
                  <label className="flex items-start gap-3 text-sm text-warm">
                    <input type="checkbox" name="toestemming" defaultChecked={toestemming} className="mt-1 h-4 w-4 rounded border-line text-amber-500 focus:ring-amber-300" />
                    <span>Mijn reactie mag op de website van Frederiks, met mijn naam en bedrijfsnaam erbij.</span>
                  </label>
                </>
              )}
              {laag && (
                <>
                  <input type="hidden" name="naam" value={naam} />
                  <input type="hidden" name="bedrijf" value={bedrijf} />
                </>
              )}
              {tekstStatus === 'fout' && (
                <p className="text-sm text-amber-800" role="alert">
                  Versturen lukte niet. Probeer het nog eens.
                </p>
              )}
              <button type="submit" className="btn-primary justify-self-start" disabled={tekstStatus === 'bezig'}>
                {tekstStatus === 'bezig' ? 'Versturen…' : 'Versturen'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
