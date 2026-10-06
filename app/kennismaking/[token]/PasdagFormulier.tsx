'use client';
import { useActionState } from 'react';
import { pasdagAanvraagActie, type PasdagStaat } from './actions';

const beginstand: PasdagStaat = { ok: false, fout: null };

const veld =
  'mt-1 w-full rounded-lg border border-line bg-white px-4 py-3 text-base text-ink-900 shadow-sm placeholder:text-ink-300 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';
const label = 'block text-sm font-semibold text-ink-900';

/** Formulier "Plan een gratis pasdag". Grote velden: de meeste bezoekers zitten op hun telefoon. */
export default function PasdagFormulier({ token, bedrijf, voornaamJessi }: { token: string; bedrijf: string; voornaamJessi: string }) {
  const [staat, actie, bezig] = useActionState(pasdagAanvraagActie, beginstand);

  if (staat.ok) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6" role="status">
        <p className="font-display text-xl font-extrabold text-ink-900">Top, je aanvraag is binnen.</p>
        <p className="mt-2 text-warm">{voornaamJessi} belt je snel om een dag te prikken voor {bedrijf}. Heb je een e-mailadres ingevuld, dan staat er ook een bevestiging in je mail.</p>
      </div>
    );
  }

  return (
    <form action={actie} className="grid gap-4 rounded-xl border border-line bg-white p-5 shadow-card sm:p-6">
      <input type="hidden" name="token" value={token} />
      {/* Honeypot: verborgen voor mensen. */}
      <div className="hidden" aria-hidden="true">
        <label>Website <input type="text" name="bedrijfswebsite" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <div>
        <label htmlFor="pd-naam" className={label}>Je naam</label>
        <input id="pd-naam" name="naam" required minLength={2} maxLength={120} autoComplete="name" className={veld} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="pd-tel" className={label}>Telefoon</label>
          <input id="pd-tel" name="telefoon" type="tel" inputMode="tel" maxLength={40} autoComplete="tel" className={veld} />
        </div>
        <div>
          <label htmlFor="pd-mail" className={label}>E-mail</label>
          <input id="pd-mail" name="email" type="email" maxLength={160} autoComplete="email" className={veld} />
        </div>
      </div>
      <p className="-mt-2 text-xs text-warm">Telefoon of e-mail is genoeg.</p>
      <div>
        <label htmlFor="pd-aantal" className={label}>Hoeveel medewerkers?</label>
        <input id="pd-aantal" name="aantal" inputMode="numeric" maxLength={40} placeholder="Bijv. 12" className={veld} />
      </div>
      <div>
        <label htmlFor="pd-opm" className={label}>Voorkeur voor een dag of iets anders kwijt?</label>
        <textarea id="pd-opm" name="opmerking" rows={3} maxLength={2000} placeholder="Bijv. liefst een dinsdagochtend, we beginnen om 7 uur" className={veld} />
      </div>

      {staat.fout && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-800" role="alert">{staat.fout}</p>}

      <button type="submit" disabled={bezig} className="btn-primary w-full sm:w-auto sm:justify-self-start">
        {bezig ? 'Even geduld…' : 'Plan een gratis pasdag'}
      </button>
      <p className="text-xs text-warm">We gebruiken je gegevens alleen om de pasdag te plannen.</p>
    </form>
  );
}
