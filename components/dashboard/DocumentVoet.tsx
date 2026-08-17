import { bedrijf } from '@/content/bedrijf';

/**
 * Vaste voet onder factuur en offerte, naar het ontwerp dat Jessi aanleverde:
 * drie kolommen met adres, contact en fiscale gegevens, met daaronder een
 * donkere balk met de betaalvoorwaarde.
 *
 * Bewust opgebouwd uit tekst en geen ingesloten afbeelding. Een plaatje wordt
 * korrelig op papier, is niet te selecteren of te doorzoeken in een PDF, en
 * zou bij elke wijziging van het rekeningnummer opnieuw ontworpen moeten worden.
 */
export default function DocumentVoet({ toonVoorwaarde = true }: { toonVoorwaarde?: boolean }) {
  return (
    <footer className="mt-12 break-inside-avoid print:mt-8">
      <div className="grid gap-6 border-t border-line pt-6 text-sm sm:grid-cols-3">
        <div>
          <p className="font-semibold text-ink-900">{bedrijf.naam}</p>
          <p className="text-warm">{bedrijf.adres}</p>
          <p className="text-warm">
            {bedrijf.postcode} {bedrijf.plaats}
          </p>
        </div>
        <div className="text-warm">
          <p>{bedrijf.telefoon}</p>
          <p>{bedrijf.email}</p>
          <p>{bedrijf.website}</p>
        </div>
        <div className="text-warm">
          <p>IBAN: {bedrijf.iban}</p>
          <p>KvK: {bedrijf.kvk}</p>
          <p>Btw: {bedrijf.btw}</p>
        </div>
      </div>

      {toonVoorwaarde && (
        <div className="mt-6 rounded-md bg-ink-900 px-5 py-4 text-white print:rounded-none">
          <p className="text-xs font-bold uppercase tracking-wide">Opmerkingen en voorwaarden</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-100">{bedrijf.betaalvoorwaarde}</p>
        </div>
      )}
    </footer>
  );
}
