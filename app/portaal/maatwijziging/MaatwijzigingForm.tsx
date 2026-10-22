'use client';
import { useState } from 'react';
import { vraagMaatwijzigingActie } from './actions';

type Artikel = { id: string; naam: string; huidig: string | null; maten: string[] };

/** Formulier maatwijziging: de maten volgen het gekozen artikel (alleen maten die er echt zijn). */
export default function MaatwijzigingForm({ artikelen, start }: { artikelen: Artikel[]; start?: string }) {
  const [productId, setProductId] = useState(artikelen.some((a) => a.id === start) ? (start as string) : '');
  const gekozen = artikelen.find((a) => a.id === productId) ?? null;
  return (
    <form action={vraagMaatwijzigingActie} className="mt-6 max-w-xl rounded-2xl border border-line bg-white p-5 shadow-soft">
      <label className="block text-sm font-semibold text-ink-900" htmlFor="mw-product">Artikel</label>
      <select id="mw-product" name="product_id" required value={productId} onChange={(e) => setProductId(e.target.value)} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm">
        <option value="">Kies een artikel</option>
        {artikelen.map((a) => (
          <option key={a.id} value={a.id}>{a.naam}{a.huidig ? ` (nu maat ${a.huidig})` : ''}</option>
        ))}
      </select>
      <label className="mt-4 block text-sm font-semibold text-ink-900" htmlFor="mw-maat">Gewenste maat</label>
      <select id="mw-maat" name="gewenste_maat" required disabled={!gekozen} key={productId} defaultValue="" className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm disabled:bg-mist">
        <option value="">{gekozen ? 'Kies een maat' : 'Kies eerst een artikel'}</option>
        {gekozen?.maten.filter((m) => m !== gekozen.huidig).map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <label className="mt-4 block text-sm font-semibold text-ink-900" htmlFor="mw-toelichting">Toelichting (optioneel)</label>
      <textarea id="mw-toelichting" name="toelichting" rows={3} maxLength={500} placeholder="Bijv. de broek zit te strak in de taille" className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" />
      <button type="submit" className="btn-primary mt-4">Verzoek versturen</button>
    </form>
  );
}
