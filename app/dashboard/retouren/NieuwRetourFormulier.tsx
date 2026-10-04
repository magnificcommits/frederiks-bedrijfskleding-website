'use client';

import { useState, useTransition } from 'react';
import VerzendKnop from '@/components/dashboard/VerzendKnop';
import KlantZoeker, { type KlantOptie } from '../klachten/KlantZoeker';
import { ordersVoorKlantActie } from '../klachten/actions';
import { nieuwRetour } from './actions';

type OrderOptie = { id: string; ordernummer: number | null; besteldatum: string | null };

const SOORTEN = [
  { id: 'retour', label: 'Retour' },
  { id: 'ruilen', label: 'Ruilen' },
  { id: 'reparatie', label: 'Reparatie' },
] as const;
const ONDERDELEN = [
  { id: 'naad', label: 'Naad of scheur' },
  { id: 'rits', label: 'Rits' },
  { id: 'knoop', label: 'Knoop of drukker' },
  { id: 'logo', label: 'Logo of bedrukking' },
  { id: 'reflectie', label: 'Reflectie' },
  { id: 'anders', label: 'Iets anders' },
];

/** Handmatig een retour aanmelden (bijvoorbeeld aan de balie of na een telefoontje). */
export default function NieuwRetourFormulier({ klanten, redenen }: { klanten: KlantOptie[]; redenen: string[] }) {
  const [klant, setKlant] = useState<KlantOptie | null>(null);
  const [orders, setOrders] = useState<OrderOptie[]>([]);
  const [laden, start] = useTransition();
  const [soort, setSoort] = useState<string>('retour');
  const reparatie = soort === 'reparatie';

  return (
    <form action={nieuwRetour} className="mt-4 flex flex-col gap-4">
      <fieldset>
        <legend className="veld-label">Soort</legend>
        <div className="grid grid-cols-3 gap-1 rounded-md border border-line bg-mist p-0.5">
          {SOORTEN.map((s) => (
            <label key={s.id} className="cursor-pointer">
              <input type="radio" name="soort" value={s.id} checked={soort === s.id} onChange={() => setSoort(s.id)} className="peer sr-only" />
              <span className="block rounded px-2 py-1.5 text-center text-[12px] font-semibold text-warm peer-checked:bg-white peer-checked:text-ink-900 peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-amber-300">
                {s.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <KlantZoeker
        klanten={klanten}
        verplicht
        onKies={(k) => {
          setKlant(k);
          setOrders([]);
          if (k) start(async () => setOrders(await ordersVoorKlantActie(k.id)));
        }}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="nr-order" className="veld-label">Order</label>
          <select id="nr-order" name="order_id" className="veld" disabled={!klant || laden} defaultValue="">
            <option value="">{!klant ? 'Kies eerst een klant' : laden ? 'Orders laden…' : 'Geen specifieke order'}</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>Order {o.ordernummer ?? '-'}</option>
            ))}
          </select>
        </div>
        {reparatie ? (
          <div>
            <label htmlFor="nr-onderdeel" className="veld-label">Wat is er kapot?</label>
            <select id="nr-onderdeel" name="onderdeel" className="veld" defaultValue="naad" required>
              {ONDERDELEN.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label htmlFor="nr-reden" className="veld-label">Reden</label>
            <select id="nr-reden" name="reden_keuze" className="veld" defaultValue="">
              <option value="">Kies een reden</option>
              {redenen.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      {reparatie && (
        <div>
          <label htmlFor="nr-kleding" className="veld-label">Kledingstuk</label>
          <input id="nr-kleding" name="kledingstuk" className="veld" placeholder="Bijvoorbeeld: 2 softshell jassen, maat L" />
        </div>
      )}
      <div>
        <label htmlFor="nr-toel" className="veld-label">Toelichting</label>
        <textarea
          id="nr-toel"
          name="reden"
          rows={3}
          placeholder={reparatie ? 'Bijvoorbeeld: rits van de jas loopt niet meer, aan de balie afgegeven' : 'Bijvoorbeeld: 2 broeken maat 52 terug, wil maat 54'}
          className="veld"
        />
      </div>
      <VerzendKnop className="knop-donker self-start" bezigTekst="Opslaan…" disabled={!klant}>
        {reparatie ? 'Reparatie aanmelden' : 'Retour aanmelden'}
      </VerzendKnop>
    </form>
  );
}
