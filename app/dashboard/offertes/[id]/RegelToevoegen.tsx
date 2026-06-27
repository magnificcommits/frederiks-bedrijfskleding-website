'use client';
import { useMemo, useState } from 'react';
import type { OfferteProductOptie } from '@/lib/kms/offertes';
import { voegRegelActie } from './actions';

const inputCls =
  'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';

function variantLabel(v: { maat: string | null; kleur: string | null }): string {
  return [v.maat ? `maat ${v.maat}` : '', v.kleur ? v.kleur : ''].filter(Boolean).join(', ');
}

function bouwOmschrijving(naam: string, v: { maat: string | null; kleur: string | null } | null): string {
  const extra = v ? variantLabel(v) : '';
  return extra ? `${naam}, ${extra}` : naam;
}

/**
 * Regel toevoegen aan een offerte met een productkiezer uit het assortiment van de klant.
 * Bij het kiezen van een product en variant vullen omschrijving en stukprijs zich automatisch,
 * maar alles blijft handmatig aanpasbaar. "Vrije regel" laat je zelf typen.
 */
export default function RegelToevoegen({
  offerteId,
  opties,
}: {
  offerteId: string;
  opties: OfferteProductOptie[];
}) {
  const [productId, setProductId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [omschrijving, setOmschrijving] = useState('');
  const [aantal, setAantal] = useState('1');
  const [stukprijs, setStukprijs] = useState('');
  const [korting, setKorting] = useState('0');
  const [inkoop, setInkoop] = useState('');
  const [handmatig, setHandmatig] = useState(false);

  const product = useMemo(
    () => opties.find((p) => p.product_id === productId) ?? null,
    [opties, productId],
  );

  function kiesVariant(vid: string, p: OfferteProductOptie | null = product) {
    setVariantId(vid);
    const v = p?.varianten.find((x) => x.id === vid) ?? null;
    if (p && v) {
      if (!handmatig) setOmschrijving(bouwOmschrijving(p.naam, v));
      if (v.verkoopprijs != null) setStukprijs(String(v.verkoopprijs));
      setInkoop(v.inkoop != null ? String(v.inkoop) : '');
    }
  }

  function kiesProduct(id: string) {
    setProductId(id);
    setVariantId('');
    const p = opties.find((o) => o.product_id === id) ?? null;
    if (p && !handmatig) setOmschrijving(bouwOmschrijving(p.naam, null));
    if (p && p.varianten.length === 1) kiesVariant(p.varianten[0].id, p);
  }

  const heeftOpties = opties.length > 0;

  return (
    <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
      <h3 className="font-display text-base font-bold text-ink-900">Regel toevoegen</h3>
      <p className="mt-1 text-xs text-warm">
        {heeftOpties
          ? 'Kies een product uit het assortiment van deze klant, of typ een vrije regel.'
          : 'Koppel een klant met een assortiment om producten te kiezen. Typ zolang een vrije regel.'}
      </p>
      <form action={voegRegelActie} className="mt-4 flex flex-col gap-3">
        <input type="hidden" name="offerteId" value={offerteId} />

        {heeftOpties && (
          <>
            <div>
              <label className="block text-xs font-semibold text-warm">Product</label>
              <select value={productId} onChange={(e) => kiesProduct(e.target.value)} className={inputCls}>
                <option value="">Vrije regel (zelf typen)</option>
                {opties.map((p) => (
                  <option key={p.product_id} value={p.product_id}>
                    {p.naam}
                    {p.merk ? ` (${p.merk})` : ''}
                  </option>
                ))}
              </select>
            </div>
            {product && product.varianten.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-warm">Maat en kleur</label>
                <select value={variantId} onChange={(e) => kiesVariant(e.target.value)} className={inputCls}>
                  <option value="">Kies maat en kleur</option>
                  {product.varianten.map((v) => (
                    <option key={v.id} value={v.id}>
                      {variantLabel(v) || 'standaard'}
                      {v.verkoopprijs != null ? ` (€ ${v.verkoopprijs})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        <div>
          <label className="block text-xs font-semibold text-warm">Omschrijving</label>
          <input
            name="omschrijving"
            required
            value={omschrijving}
            onChange={(e) => {
              setOmschrijving(e.target.value);
              setHandmatig(true);
            }}
            placeholder="Bijv. Softshell jas met logo"
            className={inputCls}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-warm">Aantal</label>
            <input name="aantal" inputMode="decimal" value={aantal} onChange={(e) => setAantal(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-warm">Stukprijs</label>
            <input name="stukprijs" inputMode="decimal" value={stukprijs} onChange={(e) => setStukprijs(e.target.value)} placeholder="bedrag" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-warm">Korting %</label>
            <input name="korting_pct" inputMode="decimal" value={korting} onChange={(e) => setKorting(e.target.value)} className={inputCls} />
          </div>
        </div>
        <input type="hidden" name="inkoop" value={inkoop} />
        <button
          type="submit"
          className="self-start rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800"
        >
          Toevoegen
        </button>
      </form>
    </div>
  );
}
