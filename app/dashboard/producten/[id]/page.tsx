import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { getProduct, listVarianten, listLeveranciers } from '@/lib/kms/producten';
import { getKleurenVanProduct, listKleurAfbeeldingen } from '@/lib/kms/afbeeldingen';
import { werkProduct, verwijderAfbeelding, schakelActief, voegVariantToe, werkVariant, verwijderVariant, zetKleurAfbeeldingActie, verwijderKleurAfbeeldingActie } from './actions';
import ConfirmSubmit from '@/components/ConfirmSubmit';
import AiBeschrijving from './AiBeschrijving';
import Tabs from '@/components/dashboard/Tabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Product', robots: { index: false, follow: false } };

const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n || 0);
const inputCls = 'veld';
const fileCls = 'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-mist file:px-3 file:py-1 file:text-xs file:font-semibold file:text-ink-700 hover:file:bg-line focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const { id } = await params;
  const sb = kmsAdmin();

  if (!sb) {
    return (
      <main className="container-smal py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="dash-h1">Leaddatabase nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen en draai de migraties in <code>supabase/migrations</code>.</p>
          <Link href="/dashboard/producten" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar producten</Link>
        </div>
      </main>
    );
  }

  const product = await getProduct(id);
  if (!product) {
    return (
      <main className="container-smal py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="dash-h1">Product niet gevonden</h1>
          <p className="mt-3 text-sm text-warm">Dit product bestaat niet of is verwijderd.</p>
          <Link href="/dashboard/producten" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar producten</Link>
        </div>
      </main>
    );
  }

  const [varianten, leveranciers, kleuren, kleurAfbeeldingen] = await Promise.all([
    listVarianten(id),
    listLeveranciers(),
    getKleurenVanProduct(id),
    listKleurAfbeeldingen(id),
  ]);
  const afbeeldingen = product.afbeeldingen ?? [];
  const afbVelden = afbeeldingen.length > 0 ? afbeeldingen : [''];
  // Prijsrange voor de rail: effectieve verkoopprijs = verkoopprijs + meerprijs.
  const effectief = varianten
    .map((v) => Number(v.verkoopprijs ?? 0) + Number(v.meerprijs ?? 0))
    .filter((n) => n > 0);
  const prijsVan = effectief.length ? Math.min(...effectief) : null;
  const prijsTot = effectief.length ? Math.max(...effectief) : null;

  return (
    <main className="container-app py-6">
      <div className="dash-kop justify-between gap-4">
        <h1 className="dash-h1">{product.naam}</h1>
        <Link href="/dashboard/producten" className="knop-tekst">Terug naar producten</Link>
      </div>

      {/* Kerngegevens links in een meelopende rail, de rest op tabbladen. */}
      <div className="mt-4 grid items-start gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-16">
          <div className="panel overflow-hidden">
            {afbeeldingen.length > 0 ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={afbeeldingen[0]} alt={product.naam} className="aspect-square w-full bg-mist object-contain" />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center bg-mist text-[12px] text-warm">Geen foto</div>
            )}
            <dl className="space-y-1.5 border-t border-line p-4 text-[13px]">
              <div className="flex justify-between gap-3"><dt className="text-warm">Merk</dt><dd className="text-ink-900">{product.merk || '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-warm">Categorie</dt><dd className="text-ink-900">{product.categorie || '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-warm">Varianten</dt><dd className="tabular-nums text-ink-900">{varianten.length}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-warm">Kleuren</dt><dd className="tabular-nums text-ink-900">{kleuren.length}</dd></div>
              {prijsVan != null && (
                <div className="flex justify-between gap-3 border-t border-line pt-1.5">
                  <dt className="text-warm">Verkoop</dt>
                  <dd className="tabular-nums text-ink-900">{prijsVan === prijsTot ? euro(prijsVan) : `${euro(prijsVan)} – ${euro(prijsTot!)}`}</dd>
                </div>
              )}
            </dl>
            <div className="flex items-center justify-between gap-3 border-t border-line p-4">
              <span className={product.actief ? 'badge-klaar' : 'badge-rust'}>{product.actief ? 'actief' : 'inactief'}</span>
              <form action={schakelActief}>
                <input type="hidden" name="productId" value={id} />
                <input type="hidden" name="actief" value={product.actief ? 'false' : 'true'} />
                <button type="submit" className="knop-stil">{product.actief ? 'Op inactief' : 'Op actief'}</button>
              </form>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <Tabs
            tabs={[
              {
                id: 'varianten',
                label: 'Varianten en prijzen',
                badge: varianten.length,
                content: (
                  <>
      <section className="mt-12">
        <p className="mt-1 text-sm text-warm">De effectieve verkoopprijs is verkoopprijs plus meerprijs.</p>
            {varianten.length === 0 ? (
              <p className="rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen varianten. Voeg er hieronder een toe.</p>
            ) : (
              <div className="panel overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Maat</th>
                      <th>Kleur</th>
                      <th>Inkoop</th>
                      <th>Verkoop</th>
                      <th>Meerprijs</th>
                      <th>Effectief</th>
                      <th>Voorraad</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {varianten.map((v) => (
                      <tr key={v.id} className="border-b border-line align-top">
                        <td colSpan={8}>
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
                            <ConfirmSubmit message="Deze variant verwijderen?" className="text-xs font-semibold text-red-700 hover:text-red-800">Verwijderen</ConfirmSubmit>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          <div className="panel p-4 mt-6">
            <h3 className="font-display text-base font-bold text-ink-900">Variant toevoegen</h3>
            <form action={voegVariantToe} className="mt-4 flex flex-col gap-3">
              <input type="hidden" name="productId" value={id} />
              <div>
                <label className="veld-label">Maat</label>
                <input name="maat" placeholder="Bijv. L" className={inputCls} />
              </div>
              <div>
                <label className="veld-label">Kleur</label>
                <input name="kleur" placeholder="Bijv. zwart" className={inputCls} />
              </div>
              <div>
                <label className="veld-label">EAN</label>
                <input name="ean" className={inputCls} />
              </div>
              <div>
                <label className="veld-label">Inkoopprijs (mag leeg)</label>
                <input name="inkoopprijs" inputMode="decimal" placeholder="bedrag" className={inputCls} />
              </div>
              <div>
                <label className="veld-label">Verkoopprijs (mag leeg)</label>
                <input name="verkoopprijs" inputMode="decimal" placeholder="bedrag" className={inputCls} />
              </div>
              <div>
                <label className="veld-label">Meerprijs</label>
                <input name="meerprijs" inputMode="decimal" defaultValue="0" className={inputCls} />
              </div>
              <div>
                <label className="veld-label">Voorraad</label>
                <input name="voorraad" inputMode="numeric" defaultValue="0" className={inputCls} />
              </div>
              <button type="submit" className="self-start knop-donker">Toevoegen</button>
            </form>
          </div>
      </section>
                  </>
                ),
              },
              {
                id: 'kleuren',
                label: 'Kleuren en foto\u2019s',
                badge: kleuren.length,
                content: (
                  <>
      {afbeeldingen.length > 0 && (
        <section className="mt-8">
          <div className="mt-4 flex flex-wrap gap-3">
            {afbeeldingen.map((url) => (
              <div key={url} className="flex w-40 flex-col gap-2 panel p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Productafbeelding" className="max-h-32 w-full rounded-md border border-line bg-white object-contain" />
                <form action={verwijderAfbeelding}>
                  <input type="hidden" name="productId" value={id} />
                  <input type="hidden" name="url" value={url} />
                  <ConfirmSubmit message="Deze afbeelding verwijderen?" className="w-full rounded-md border border-line px-2 py-1 text-xs font-semibold text-red-700 hover:bg-mist">Verwijderen</ConfirmSubmit>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}
      {kleuren.length > 0 && (
        <section className="mt-8">
          <p className="mt-1 text-sm text-warm">Per kleur is een voorkant-afbeelding voldoende. Upload een bestand of plak een URL.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {kleuren.map((kleur) => {
              const huidige = kleurAfbeeldingen[kleur];
              return (
                <div key={kleur} className="panel p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-display text-base font-bold text-ink-900">{kleur}</h3>
                    {huidige && (
                      <form action={verwijderKleurAfbeeldingActie}>
                        <input type="hidden" name="productId" value={id} />
                        <input type="hidden" name="kleur" value={kleur} />
                        <ConfirmSubmit message="Deze afbeelding verwijderen?" className="text-xs font-semibold text-red-700 hover:text-red-800">Verwijderen</ConfirmSubmit>
                      </form>
                    )}
                  </div>
                  {huidige ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={huidige} alt={`Afbeelding kleur ${kleur}`} className="mt-3 max-h-40 w-full rounded-md border border-line bg-white object-contain" />
                  ) : (
                    <p className="mt-3 rounded-md border border-line bg-mist px-3 py-4 text-center text-xs text-warm">Nog geen afbeelding voor deze kleur.</p>
                  )}
                  <form action={zetKleurAfbeeldingActie} className="mt-4 flex flex-col gap-3">
                    <input type="hidden" name="productId" value={id} />
                    <input type="hidden" name="kleur" value={kleur} />
                    <div>
                      <label className="veld-label">Afbeelding uploaden</label>
                      <input type="file" name="afbeelding_bestand" accept="image/*" className={fileCls} />
                    </div>
                    <div>
                      <label className="veld-label">Of plak een URL</label>
                      <input name="afbeelding_url" placeholder="https://..." className={inputCls} />
                    </div>
                    <button type="submit" className="self-start knop-donker">Opslaan</button>
                  </form>
                </div>
              );
            })}
          </div>
        </section>
      )}
                    {afbeeldingen.length === 0 && kleuren.length === 0 && (
                      <p className="rounded-lg border border-dashed border-line bg-mist px-5 py-6 text-center text-[13px] text-warm">Nog geen foto&apos;s. Voeg ze toe bij Omschrijving en gegevens.</p>
                    )}
                  </>
                ),
              },
              {
                id: 'gegevens',
                label: 'Omschrijving en gegevens',
                content: (
                  <>
      <section className="mt-8">
        <form action={werkProduct} className="mt-4 grid gap-4 panel p-4 sm:grid-cols-2">
          <input type="hidden" name="productId" value={id} />
          <div className="sm:col-span-2">
            <label className="veld-label">Naam</label>
            <input name="naam" required defaultValue={product.naam} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className="veld-label">Omschrijving</label>
            <textarea name="omschrijving" defaultValue={product.omschrijving ?? ''} rows={3} className={inputCls} />
          </div>
          <AiBeschrijving
            naam={product.naam ?? ''}
            merk={product.merk ?? ''}
            categorie={product.categorie ?? ''}
            materiaal={product.materiaal ?? ''}
            normeringen={product.normeringen ?? ''}
          />
          <div>
            <label className="veld-label">SKU</label>
            <input name="sku" defaultValue={product.sku ?? ''} className={inputCls} />
          </div>
          <div>
            <label className="veld-label">EAN</label>
            <input name="ean" defaultValue={product.ean ?? ''} className={inputCls} />
          </div>
          <div>
            <label className="veld-label">Artikelnr. leverancier</label>
            <input name="art_nr_leverancier" defaultValue={product.art_nr_leverancier ?? ''} className={inputCls} />
          </div>
          <div>
            <label className="veld-label">Merk</label>
            <input name="merk" defaultValue={product.merk ?? ''} className={inputCls} />
          </div>
          <div>
            <label className="veld-label">Categorie</label>
            <input name="categorie" defaultValue={product.categorie ?? ''} className={inputCls} />
          </div>
          <div>
            <label className="veld-label">Subcategorie</label>
            <input name="subcategorie" defaultValue={product.subcategorie ?? ''} className={inputCls} />
          </div>
          <div>
            <label className="veld-label">Geslacht</label>
            <input name="geslacht" defaultValue={product.geslacht ?? ''} placeholder="Bijv. uniseks, heren, dames" className={inputCls} />
          </div>
          <div>
            <label className="veld-label">Materiaal</label>
            <input name="materiaal" defaultValue={product.materiaal ?? ''} className={inputCls} />
          </div>
          <div>
            <label className="veld-label">Normeringen</label>
            <input name="normeringen" defaultValue={product.normeringen ?? ''} placeholder="Bijv. EN ISO 20471" className={inputCls} />
          </div>
          <div>
            <label className="veld-label">Btw (%)</label>
            <input name="btw" inputMode="decimal" defaultValue={String(product.btw ?? 21)} className={inputCls} />
          </div>
          <div>
            <label className="veld-label">Minimale voorraad</label>
            <input name="min_voorraad" inputMode="numeric" defaultValue={product.min_voorraad != null ? String(product.min_voorraad) : ''} placeholder="Laat leeg als niet van toepassing" className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className="veld-label">Wasinstructies</label>
            <textarea name="wasinstructies" defaultValue={product.wasinstructies ?? ''} rows={2} placeholder="Bijv. wassen op 40 graden, niet in de droger" className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className="veld-label">Leverancier</label>
            <select name="leverancier_id" defaultValue={product.leverancier_id ?? ''} className={inputCls}>
              <option value="">Geen leverancier</option>
              {leveranciers.map((l) => <option key={l.id} value={l.id}>{l.naam}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="veld-label">Afbeelding uploaden</label>
            <p className="mt-1 text-xs text-warm">Kies een bestand. Bij opslaan wordt het aan de afbeeldingen toegevoegd.</p>
            <input type="file" name="afbeelding_bestand" accept="image/*" className={fileCls} />
          </div>
          <div className="sm:col-span-2">
            <label className="veld-label">Afbeeldingen (URL per veld)</label>
            <p className="mt-1 text-xs text-warm">Plak hele URLs. Lege velden worden genegeerd. Voeg desnoods een extra regel toe en sla op.</p>
            <div className="mt-2 flex flex-col gap-2">
              {[...afbVelden, ''].map((url, i) => (
                <input key={i} name="afbeelding" defaultValue={url} placeholder="https://..." className={inputCls} />
              ))}
            </div>
          </div>
          <div className="sm:col-span-2 flex items-end">
            <button type="submit" className="knop-donker">Gegevens opslaan</button>
          </div>
        </form>
      </section>
                  </>
                ),
              },
            ]}
          />
        </div>
      </div>
    </main>
  );
}
