'use client';

import { useState, useTransition } from 'react';
import VerzendKnop from '@/components/dashboard/VerzendKnop';
import KlantZoeker, { type KlantOptie } from '../klachten/KlantZoeker';
import { ordersVoorKlantActie } from '../klachten/actions';
import { nieuwRetour } from './actions';

type OrderOptie = { id: string; ordernummer: number | null; besteldatum: string | null };

/** Handmatig een retour aanmelden (bijvoorbeeld aan de balie of na een telefoontje). */
export default function NieuwRetourFormulier({ klanten, redenen }: { klanten: KlantOptie[]; redenen: string[] }) {
  const [klant, setKlant] = useState<KlantOptie | null>(null);
  const [orders, setOrders] = useState<OrderOptie[]>([]);
  const [laden, start] = useTransition();

  return (
    <form action={nieuwRetour} className="mt-4 flex flex-col gap-4">
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
        <div>
          <label htmlFor="nr-reden" className="veld-label">Reden</label>
          <select id="nr-reden" name="reden_keuze" className="veld" defaultValue="">
            <option value="">Kies een reden</option>
            {redenen.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="nr-toel" className="veld-label">Toelichting</label>
        <textarea id="nr-toel" name="reden" rows={3} placeholder="Bijvoorbeeld: 2 broeken maat 52 terug, wil maat 54" className="veld" />
      </div>
      <VerzendKnop className="knop-donker self-start" bezigTekst="Opslaan…" disabled={!klant}>
        Retour aanmelden
      </VerzendKnop>
    </form>
  );
}
