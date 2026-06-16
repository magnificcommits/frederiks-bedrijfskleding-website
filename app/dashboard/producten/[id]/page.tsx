import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { getProduct, listVarianten, listLeveranciers } from '@/lib/kms/producten';
import { werkProduct, schakelActief, voegVariantToe, werkVariant, verwijderVariant } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Product', robots: { index: false, follow: false } };

const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n || 0);
const inputCls = 'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const { id } = await params;
  const sb = kmsAdmin();

  if (!sb) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Leaddatabase nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen en draai de migraties in <code>supabase/migrations</code>.</p>
          <Link href="/dashboard/producten" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar producten</Link>
        </div>
      </main>
    );
  }

  const product = await getProduct(id);
  if (!product) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Product niet gevonden</h1>
          <p className="mt-3 text-sm text-warm">Dit product bestaat niet of is verwijderd.</p>
          <Link href="/dashboard/producten" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar producten</Link>
        </div>
      </main>
    );
  }

  const [varianten, leveranciers] = await Promise.all([listVarianten(id), listLeveranciers()]);
  const afbeeldingen = product.afbeeldingen ?? [];
  const afbVelden = afbeeldingen.length > 0 ? afbeeldingen : [''];

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">{product.naam}</h1>
          <p className="mt-1 text-sm text-warm">{[product.merk, product.categorie].filter(Boolean).join(' · ') || 'Geen merk of categorie'}</p>
        </div>
        <Link href="/dashboard/producten" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar producten</Link>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${product.actief ? 'bg-green-100 text-green-800' : 'bg-ink-100 text-ink-500'}`}>{product.actief ? 'actief' : 'inactief'}</span>
        <form action={schakelActief}>
          <input type="hidden" name="productId" value={id} />
          <input type="hidden" name="actief" value={product.actief ? 'false' : 'true'} />
          <button type="submit" className="rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-mist">{product.actief ? 'Op inactief zetten' : 'Op actief zetten'}</button>
        </form>
      </div>

      <section className="mt-8">
        <h2 className="font-display text-xl font-bold text-ink-900">Gegevens</h2>
        <form action={werkProduct} className="mt-4 grid gap-4 rounded-2xl border border-line bg-white p-6 shadow-soft sm:grid-cols-2">
          <input type="hidden" name="productId" value={id} />
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-warm">Naam</label>
            <input name="naam" required defaultValue={product.naam} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-warm">Omschrijving</label>
            <textarea name="omschrijving" defaultValue={product.omschrijving ?? ''} rows={3} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-warm">SKU</label>
            <input name="sku" defaultValue={product.sku ?? ''} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-warm">EAN</label>
            <input name="ean" defaultValue={product.ean ?? ''} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-warm">Artikelnr. leverancier</label>
            <input name="art_nr_leverancier" defaultValue={product.art_nr_leverancier ?? ''} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-warm">Merk</label>
            <input name="merk" defaultValue={product.merk ?? ''} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-warm">Categorie</label>
            <input name="categorie" defaultValue={product.categorie ?? ''} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-warm">Subcategorie</label>
            <input name="subcategorie" defaultValue={product.subcategorie ?? ''} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-warm">Geslacht</label>
            <input name="geslacht" defaultValue={product.geslacht ?? ''} placeholder="Bijv. uniseks, heren, dames" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-warm">Materiaal</label>
            <input name="materiaal" defaultValue={product.materiaal ?? ''} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-warm">Normeringen</label>
            <input name="normeringen" defaultValue={product.normeringen ?? ''} placeholder="Bijv. EN ISO 20471" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-warm">Btw (%)</label>
            <input name="btw" inputMode="decimal" defaultValue={String(product.btw ?? 21)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-warm">Minimale voorraad</label>
            <input name="min_voorraad" inputMode="numeric" defaultValue={product.min_voorraad != null ? String(product.min_voorraad) : ''} placeholder="Laat leeg als niet van toepassing" className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-warm">Wasinstructies</label>
            <textarea name="wasinstructies" defaultValue={product.wasinstructies ?? ''} rows={2} placeholder="Bijv. wassen op 40 graden, niet in de droger" className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-warm">Leverancier</label>
            <select name="leverancier_id" defaultValue={product.leverancier_id ?? ''} className={inputCls}>
              <option value="">Geen leverancier</option>
              {leveranciers.map((l) => <option key={l.id} value={l.id}>{l.naam}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-warm">Afbeeldingen (URL per veld)</label>
            <p className="mt-1 text-xs text-warm">Plak hele URLs. Lege velden worden genegeerd. Voeg desnoods een extra regel toe en sla op.</p>
            <div className="mt-2 flex flex-col gap-2">
              {[...afbVelden, ''].map((url, i) => (
                <input key={i} name="afbeelding" defaultValue={url} placeholder="https://..." className={inputCls} />
              ))}
            </div>
          </div>
          <div className="sm:col-span-2 flex items-end">
            <button type="submit" className="rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Gegevens opslaan</button>
          </div>
        </form>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-xl font-bold text-ink-900">Varianten</h2>
        <p className="mt-1 text-sm text-warm">De effectieve verkoopprijs is verkoopprijs plus meerprijs.</p>
        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {varianten.length === 0 ? (
              <p className="rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen varianten. Voeg er rechts een toe.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-warm">
                    <tr>
                      <th className="px-3 py-3">Maat</th>
                      <th className="px-3 py-3">Kleur</th>
                      <th className="px-3 py-3">Inkoop</th>
                      <th className="px-3 py-3">Verkoop</th>
                      <th className="px-3 py-3">Meerprijs</th>
                      <th className="px-3 py-3">Effectief</th>
                      <th className="px-3 py-3">Voorraad</th>
                      <th className="px-3 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {varianten.map((v) => (
                      <tr key={v.id} className="border-b border-line align-top">
                        <td colSpan={8} className="px-3 py-3">
                          <form action={werkVariant} className="flex flex-wrap items-end gap-2">
                            <input type="hidden" name="productId" value={id} />
                            <input type="hidden" name="variantId" value={v.id} />
                            <div className="w-16">
                              <label className="block text-[10px] font-semibold uppercase text-warm">Maat</label>
                              <input name="maat" defaultValue={v.maat ?? ''} className={inputCls} />
                            </div>
                            <div className="w-20">
                              <label className="block text-[10px] font-semibold uppercase text-warm">Kleur</label>
                              <input name="kleur" defaultValue={v.kleur ?? ''} className={inputCls} />
                            </div>
                            <div className="w-20">
                              <label className="block text-[10px] font-semibold uppercase text-warm">Inkoop</label>
                              <input name="inkoopprijs" inputMode="decimal" defaultValue={v.inkoopprijs != null ? String(v.inkoopprijs) : ''} className={inputCls} />
                            </div>
                            <div className="w-20">
                              <label className="block text-[10px] font-semibold uppercase text-warm">Verkoop</label>
                              <input name="verkoopprijs" inputMode="decimal" defaultValue={v.verkoopprijs != null ? String(v.verkoopprijs) : ''} className={inputCls} />
                            </div>
                            <div className="w-20">
                              <label className="block text-[10px] font-semibold uppercase text-warm">Meerprijs</label>
                              <input name="meerprijs" inputMode="decimal" defaultValue={String(v.meerprijs ?? 0)} className={inputCls} />
                            </div>
                            <div className="w-20">
                              <label className="block text-[10px] font-semibold uppercase text-warm">Voorraad</label>
                              <input name="voorraad" inputMode="numeric" defaultValue={String(v.voorraad ?? 0)} className={inputCls} />
                            </div>
                            <div className="pb-1 text-xs text-warm">
                              <span className="block text-[10px] font-semibold uppercase">Effectief</span>
                              {euro(Number(v.verkoopprijs ?? 0) + Number(v.meerprijs ?? 0))}
                            </div>
                            <button type="submit" className="rounded-md bg-ink-900 px-3 py-2 text-xs font-semibold text-white hover:bg-ink-800">Opslaan</button>
                          </form>
                          <form action={verwijderVariant} className="mt-1">
                            <input type="hidden" name="productId" value={id} />
                            <input type="hidden" name="variantId" value={v.id} />
                            <button type="submit" className="text-xs font-semibold text-red-700 hover:text-red-800">Verwijderen</button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <h3 className="font-display text-base font-bold text-ink-900">Variant toevoegen</h3>
            <form action={voegVariantToe} className="mt-4 flex flex-col gap-3">
              <input type="hidden" name="productId" value={id} />
              <div>
                <label className="block text-xs font-semibold text-warm">Maat</label>
                <input name="maat" placeholder="Bijv. L" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Kleur</label>
                <input name="kleur" placeholder="Bijv. zwart" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">EAN</label>
                <input name="ean" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Inkoopprijs (mag leeg)</label>
                <input name="inkoopprijs" inputMode="decimal" placeholder="bedrag" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Verkoopprijs (mag leeg)</label>
                <input name="verkoopprijs" inputMode="decimal" placeholder="bedrag" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Meerprijs</label>
                <input name="meerprijs" inputMode="decimal" defaultValue="0" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Voorraad</label>
                <input name="voorraad" inputMode="numeric" defaultValue="0" className={inputCls} />
              </div>
              <button type="submit" className="self-start rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Toevoegen</button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
