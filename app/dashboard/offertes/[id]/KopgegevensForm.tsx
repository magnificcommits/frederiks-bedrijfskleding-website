'use client';

import { useCallback } from 'react';
import type { OfferteKlant } from '@/lib/kms/offertes';
import KlantContactKiezer, { type KlantContactWijziging } from '../KlantContactKiezer';
import { useOfferteVoorbeeld } from './OfferteVoorbeeld';
import { werkOfferteActie } from './actions';

const groot = 'veld py-2.5 text-[15px]';

/** Btw zoals de server hem leest: komma als decimaalteken, leeg is 21. */
function btwUitTekst(raw: string): number {
  const schoon = raw.replace(/[^0-9.,-]/g, '').trim();
  if (schoon === '') return 21;
  const getal = Number(schoon.includes(',') ? schoon.replace(/\./g, '').replace(',', '.') : schoon);
  return Number.isFinite(getal) ? getal : 0;
}

/**
 * Kopgegevens van de offerte. Alles wat je hier typt of kiest, gaat meteen naar het
 * live voorbeeld; opslaan gaat nog steeds via de server action werkOfferteActie.
 */
export default function KopgegevensForm({
  offerteId,
  klanten,
  organisatieId,
  contactpersoon,
  contactId,
  geldigTot,
  btwPct,
  notitie,
}: {
  offerteId: string;
  klanten: OfferteKlant[];
  organisatieId: string;
  contactpersoon: string;
  contactId: string;
  geldigTot: string;
  btwPct: string;
  notitie: string;
}) {
  const { zetConcept } = useOfferteVoorbeeld();

  const opKiezer = useCallback(
    (w: KlantContactWijziging) => {
      zetConcept({
        organisatie_naam: w.klant?.naam ?? null,
        contactpersoon: w.contactNaam || null,
        contactEmail: w.contact?.email ?? null,
        contactId: w.contact?.id ?? null,
      });
    },
    [zetConcept],
  );

  function opInvoer(e: React.FormEvent<HTMLFormElement>) {
    const veld = e.target as HTMLInputElement | HTMLTextAreaElement;
    if (veld.name === 'geldig_tot') zetConcept({ geldig_tot: veld.value || null });
    else if (veld.name === 'btw_pct') zetConcept({ btw_pct: btwUitTekst(veld.value) });
    else if (veld.name === 'notitie') zetConcept({ notitie: veld.value });
  }

  return (
    <form action={werkOfferteActie} onInput={opInvoer} className="mt-4 space-y-5">
      <input type="hidden" name="offerteId" value={offerteId} />
      {/* key: na opslaan opnieuw opbouwen met de opgeslagen klant en contactpersoon. */}
      <KlantContactKiezer
        key={`${organisatieId}|${contactId}|${contactpersoon}`}
        klanten={klanten}
        beginKlantId={organisatieId}
        beginContact={contactpersoon}
        beginContactId={contactId}
        stelVoor={false}
        onWijzig={opKiezer}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="veld-label" htmlFor="kop-geldig">Geldig tot</label>
          <input id="kop-geldig" type="date" name="geldig_tot" defaultValue={geldigTot} className={groot} />
        </div>
        <div>
          <label className="veld-label" htmlFor="kop-btw">Btw %</label>
          <input id="kop-btw" name="btw_pct" inputMode="decimal" defaultValue={btwPct} className={groot} />
        </div>
      </div>
      <div>
        <label className="veld-label" htmlFor="kop-notitie">Notitie</label>
        <textarea id="kop-notitie" name="notitie" rows={4} defaultValue={notitie} placeholder="Toelichting voor de klant" className={groot} />
        <p className="veld-hint">Deze tekst staat onderaan de offerte die de klant krijgt.</p>
      </div>
      <div>
        <button type="submit" className="knop-donker">Kopgegevens opslaan</button>
      </div>
    </form>
  );
}
