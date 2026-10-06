'use client';

import { useState, useTransition } from 'react';
import PersoonKiezer from '@/components/dashboard/PersoonKiezer';
import VerzendKnop from '@/components/dashboard/VerzendKnop';
import KlantZoeker, { type KlantOptie } from './KlantZoeker';
import ProductZoeker from './ProductZoeker';
import { nieuweKlacht, ordersVoorKlantActie, productenVanOrderActie } from './actions';
import type { ProductKeuze } from '@/lib/kms/service';

type OrderOptie = { id: string; ordernummer: number | null; besteldatum: string | null; status: string | null };

const datum = (s: string | null) =>
  s ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(s)) : '';

/**
 * Vraag of klacht vastleggen, meestal na een telefoontje. Klant zoeken in plaats
 * van kiezen uit 183 namen; daarna contactpersoon, order en artikel van die klant.
 */
export default function NieuweKlachtFormulier({
  klanten,
  categorieen,
  personen,
  standaardPersoon,
}: {
  klanten: KlantOptie[];
  categorieen: string[];
  personen: { id: string; naam: string }[];
  standaardPersoon: string | null;
}) {
  const [klant, setKlant] = useState<KlantOptie | null>(null);
  const [orders, setOrders] = useState<OrderOptie[]>([]);
  const [orderId, setOrderId] = useState('');
  const [suggesties, setSuggesties] = useState<ProductKeuze[]>([]);
  const [laden, start] = useTransition();

  function kiesKlant(k: KlantOptie | null) {
    setKlant(k);
    setOrderId('');
    setOrders([]);
    setSuggesties([]);
    if (k) start(async () => setOrders(await ordersVoorKlantActie(k.id)));
  }

  function kiesOrder(id: string) {
    setOrderId(id);
    setSuggesties([]);
    if (id) start(async () => setSuggesties(await productenVanOrderActie(id)));
  }

  return (
    <form action={nieuweKlacht} className="mt-4 flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
        <KlantZoeker klanten={klanten} verplicht onKies={kiesKlant} hint="Verplicht. Typ een paar letters van de naam of plaats." />
        <div>
          <span className="veld-label">Soort</span>
          <div className="flex gap-1 rounded-md border border-line bg-mist p-0.5">
            {(['vraag', 'klacht'] as const).map((s) => (
              <label key={s} className="flex-1 cursor-pointer">
                <input type="radio" name="soort" value={s} defaultChecked={s === 'klacht'} className="peer sr-only" />
                <span className="block rounded px-3 py-1.5 text-center text-[13px] font-semibold capitalize text-warm peer-checked:bg-white peer-checked:text-ink-900 peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-amber-300">
                  {s}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PersoonKiezer
          key={klant?.id ?? 'geen'}
          naam="contact"
          label="Contactpersoon"
          bron="klant"
          orgId={klant?.id ?? null}
          soorten={['contact', 'medewerker']}
          nieuw={klant ? ['contact'] : []}
          disabled={!klant}
          hint={klant ? 'Wie belde of mailde? Naar dit adres gaat het antwoord.' : 'Kies eerst een klant.'}
        />
        <div>
          <label htmlFor="nk-order" className="veld-label">Order</label>
          <select
            id="nk-order"
            name="order_id"
            value={orderId}
            onChange={(e) => kiesOrder(e.target.value)}
            disabled={!klant || laden}
            className="veld"
          >
            <option value="">{!klant ? 'Kies eerst een klant' : orders.length ? 'Geen specifieke order' : laden ? 'Orders laden…' : 'Geen orders gevonden'}</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                Order {o.ordernummer ?? '-'} {o.besteldatum ? `· ${datum(o.besteldatum)}` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="nk-cat" className="veld-label">Categorie</label>
          <select id="nk-cat" name="categorie" className="veld" defaultValue="">
            <option value="">Nog niet ingedeeld</option>
            {categorieen.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="nk-prio" className="veld-label">Prioriteit</label>
          <select id="nk-prio" name="prioriteit" className="veld" defaultValue="normaal">
            <option value="hoog">Hoog</option>
            <option value="normaal">Normaal</option>
            <option value="laag">Laag</option>
          </select>
        </div>
        <div>
          <label htmlFor="nk-bron" className="veld-label">Binnengekomen via</label>
          <select id="nk-bron" name="bron" className="veld" defaultValue="telefoon">
            <option value="telefoon">Telefoon</option>
            <option value="mail">Mail</option>
            <option value="balie">Balie of showroom</option>
            <option value="dashboard">Anders</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ProductZoeker key={orderId || 'los'} suggesties={suggesties} label="Artikel (optioneel)" />
        <div>
          <label htmlFor="nk-wie" className="veld-label">Toegewezen aan</label>
          <select id="nk-wie" name="toegewezen_aan" className="veld" defaultValue={standaardPersoon ?? ''}>
            <option value="">Niemand</option>
            {personen.map((p) => (
              <option key={p.id} value={p.id}>{p.naam}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="nk-oms" className="veld-label">Omschrijving</label>
        <textarea
          id="nk-oms"
          name="omschrijving"
          required
          rows={4}
          placeholder="Wat is er aan de hand? Bijvoorbeeld: 3 jassen in maat L geleverd, besteld was XL."
          className="veld"
        />
      </div>

      <VerzendKnop className="knop-donker self-start" bezigTekst="Opslaan…" disabled={!klant}>
        Vastleggen
      </VerzendKnop>
    </form>
  );
}
