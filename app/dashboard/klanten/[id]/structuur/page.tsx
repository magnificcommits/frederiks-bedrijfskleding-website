import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import {
  getInstellingen,
  listVestigingen,
  listAfdelingen,
  listManagers,
  ORGANISATIE_TYPES,
} from '@/lib/kms/structuur';
import {
  bewaarInstellingen,
  voegVestigingToe,
  verwijderVestigingActie,
  voegAfdelingToe,
  verwijderAfdelingActie,
  bewaarManagerScope,
} from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Inrichting', robots: { index: false, follow: false } };

const inputCls =
  'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';
const fileCls =
  'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-mist file:px-3 file:py-1 file:text-xs file:font-semibold file:text-ink-700 hover:file:bg-line focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';
const knopCls = 'rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800';
const wisCls = 'rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-mist';

function num(n: number | null | undefined): string {
  return n == null ? '' : String(n);
}

export default async function InrichtingPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const { id } = await params;

  const sb = kmsAdmin();
  if (!sb) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Leaddatabase nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet de Supabase-omgevingsvariabelen en draai de migraties.</p>
          <Link href={`/dashboard/klanten/${id}`} className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar klant</Link>
        </div>
      </main>
    );
  }

  const [inst, vestigingen, afdelingen, managers] = await Promise.all([
    getInstellingen(id),
    listVestigingen(id),
    listAfdelingen(id),
    listManagers(id),
  ]);

  if (!inst) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Klant niet gevonden</h1>
          <p className="mt-3 text-sm text-warm">Deze klant bestaat niet of is verwijderd.</p>
          <Link href="/dashboard/klanten" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar klanten</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">Inrichting</h1>
          <p className="mt-1 text-sm text-warm">{inst.naam || 'Organisatie'}</p>
        </div>
        <Link href={`/dashboard/klanten/${id}`} className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar klant</Link>
      </div>

      {/* Instellingen */}
      <section className="mt-8">
        <h2 className="font-display text-xl font-bold text-ink-900">Portaalinstellingen</h2>
        <form action={bewaarInstellingen} className="mt-4 grid gap-4 rounded-2xl border border-line bg-white p-6 shadow-soft sm:grid-cols-2">
          <input type="hidden" name="orgId" value={id} />

          <div>
            <label className="block text-xs font-semibold text-warm">Type organisatie</label>
            <select name="type" defaultValue={inst.type ?? 'bedrijf'} className={inputCls}>
              {ORGANISATIE_TYPES.map((t) => <option key={t} value={t}>{t === 'school' ? 'School' : 'Bedrijf'}</option>)}
            </select>
          </div>
          <div></div>

          <div>
            <label className="block text-xs font-semibold text-warm">Min. bestelbedrag (mag leeg)</label>
            <input name="min_bestelbedrag" inputMode="decimal" defaultValue={num(inst.min_bestelbedrag)} placeholder="bedrag" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-warm">Max. bestelbedrag (mag leeg)</label>
            <input name="max_bestelbedrag" inputMode="decimal" defaultValue={num(inst.max_bestelbedrag)} placeholder="bedrag" className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-warm">Verzendkosten (mag leeg)</label>
            <input name="verzendkosten" inputMode="decimal" defaultValue={num(inst.verzendkosten)} placeholder="bedrag" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-warm">Klantkorting (%)</label>
            <input name="korting_pct" inputMode="decimal" defaultValue={num(inst.korting_pct)} placeholder="bijv. 10" className={inputCls} />
            <p className="mt-1 text-xs text-warm">Dit percentage gaat in het portaal en op de factuur van de catalogusprijs af. Leeg of 0 is geen korting.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-warm">Bestelperiode van (optioneel)</label>
            <input name="bestelperiode_start" type="date" defaultValue={inst.bestelperiode_start ?? ''} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-warm">Bestelperiode tot (optioneel)</label>
            <input name="bestelperiode_eind" type="date" defaultValue={inst.bestelperiode_eind ?? ''} className={inputCls} />
          </div>

          <div className="sm:col-span-2">
            <p className="block text-xs font-semibold text-warm">Weergaveopties</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-warm">
                <input name="toon_kortingen" type="checkbox" defaultChecked={!!inst.toon_kortingen} className="h-4 w-4 rounded border-line text-ink-900 focus:ring-amber-200" />
                Kortingen tonen
              </label>
              <label className="flex items-center gap-2 text-sm text-warm">
                <input name="gebruik_referentienr" type="checkbox" defaultChecked={!!inst.gebruik_referentienr} className="h-4 w-4 rounded border-line text-ink-900 focus:ring-amber-200" />
                Referentienummer gebruiken
              </label>
              <label className="flex items-center gap-2 text-sm text-warm">
                <input name="opmerking_bij_bestelling" type="checkbox" defaultChecked={!!inst.opmerking_bij_bestelling} className="h-4 w-4 rounded border-line text-ink-900 focus:ring-amber-200" />
                Opmerking bij bestelling
              </label>
              <label className="flex items-center gap-2 text-sm text-warm">
                <input name="toon_voorraad" type="checkbox" defaultChecked={!!inst.toon_voorraad} className="h-4 w-4 rounded border-line text-ink-900 focus:ring-amber-200" />
                Voorraad tonen
              </label>
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-warm">Voorwaarden (tekst)</label>
            <textarea name="voorwaarden_tekst" rows={3} defaultValue={inst.voorwaarden_tekst ?? ''} placeholder="Voorwaarden die in het portaal worden getoond" className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-warm">Voorschriften (tekst)</label>
            <textarea name="voorschriften_tekst" rows={3} defaultValue={inst.voorschriften_tekst ?? ''} placeholder="Bijv. veiligheidsvoorschriften of kledingregels" className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-warm">Huisstijlkleur (hex)</label>
            <input name="huisstijl_kleur" defaultValue={inst.huisstijl_kleur ?? ''} placeholder="#1f2937" className={inputCls} />
          </div>
          <div></div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-warm">Portaal-logo</label>
            {inst.portaal_logo_url && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={inst.portaal_logo_url} alt="Portaal-logo" className="mt-1 max-h-20 w-auto rounded-md border border-line bg-white object-contain p-2" />
            )}
            <input type="file" name="portaal_logo_bestand" accept="image/*" className={fileCls} />
            <input name="portaal_logo_url" defaultValue={inst.portaal_logo_url ?? ''} placeholder="of plak een URL" className={`${inputCls} mt-2`} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-warm">Sfeerafbeelding URL</label>
            <input name="sfeerafbeelding_url" defaultValue={inst.sfeerafbeelding_url ?? ''} placeholder="https://..." className={inputCls} />
          </div>

          <div className="sm:col-span-2">
            <button type="submit" className={knopCls}>Instellingen opslaan</button>
          </div>
        </form>
      </section>

      {/* Vestigingen */}
      <section className="mt-12">
        <h2 className="font-display text-xl font-bold text-ink-900">Vestigingen</h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {vestigingen.length === 0 ? (
              <p className="rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen vestigingen.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-warm">
                    <tr>
                      <th className="px-4 py-3">Naam</th>
                      <th className="px-4 py-3">Leveradres</th>
                      <th className="px-4 py-3">Factuuradres</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {vestigingen.map((v) => (
                      <tr key={v.id} className="border-b border-line align-top">
                        <td className="px-4 py-3 font-semibold text-ink-900">{v.naam}</td>
                        <td className="px-4 py-3 text-warm">{[v.leveradres, [v.leverpostcode, v.leverplaats].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '-'}</td>
                        <td className="px-4 py-3 text-warm">{[v.factuuradres, [v.factuurpostcode, v.factuurplaats].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '-'}</td>
                        <td className="px-4 py-3 text-right">
                          <form action={verwijderVestigingActie}>
                            <input type="hidden" name="orgId" value={id} />
                            <input type="hidden" name="vestigingId" value={v.id} />
                            <button type="submit" className={wisCls}>Verwijderen</button>
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
            <h3 className="font-display text-base font-bold text-ink-900">Vestiging toevoegen</h3>
            <form action={voegVestigingToe} className="mt-4 flex flex-col gap-3">
              <input type="hidden" name="orgId" value={id} />
              <div>
                <label className="block text-xs font-semibold text-warm">Naam</label>
                <input name="naam" required placeholder="Bijv. Hoofdvestiging" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Leveradres</label>
                <input name="leveradres" placeholder="Straat en huisnummer" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input name="leverpostcode" placeholder="Postcode" className={inputCls} />
                <input name="leverplaats" placeholder="Plaats" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Factuuradres</label>
                <input name="factuuradres" placeholder="Straat en huisnummer" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input name="factuurpostcode" placeholder="Postcode" className={inputCls} />
                <input name="factuurplaats" placeholder="Plaats" className={inputCls} />
              </div>
              <button type="submit" className="self-start rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Toevoegen</button>
            </form>
          </div>
        </div>
      </section>

      {/* Afdelingen */}
      <section className="mt-12">
        <h2 className="font-display text-xl font-bold text-ink-900">Afdelingen</h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {afdelingen.length === 0 ? (
              <p className="rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen afdelingen.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-warm">
                    <tr>
                      <th className="px-4 py-3">Naam</th>
                      <th className="px-4 py-3">Kostenplaats</th>
                      <th className="px-4 py-3">Leidinggevende</th>
                      <th className="px-4 py-3">Vestiging</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {afdelingen.map((a) => (
                      <tr key={a.id} className="border-b border-line align-top">
                        <td className="px-4 py-3 font-semibold text-ink-900">{a.naam}</td>
                        <td className="px-4 py-3 text-warm">{a.kostenplaats || '-'}</td>
                        <td className="px-4 py-3 text-warm">{a.leidinggevende || '-'}</td>
                        <td className="px-4 py-3 text-warm">{a.vestiging_naam || '-'}</td>
                        <td className="px-4 py-3 text-right">
                          <form action={verwijderAfdelingActie}>
                            <input type="hidden" name="orgId" value={id} />
                            <input type="hidden" name="afdelingId" value={a.id} />
                            <button type="submit" className={wisCls}>Verwijderen</button>
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
            <h3 className="font-display text-base font-bold text-ink-900">Afdeling toevoegen</h3>
            <form action={voegAfdelingToe} className="mt-4 flex flex-col gap-3">
              <input type="hidden" name="orgId" value={id} />
              <div>
                <label className="block text-xs font-semibold text-warm">Naam</label>
                <input name="naam" required placeholder="Bijv. Productie" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Kostenplaats</label>
                <input name="kostenplaats" placeholder="Bijv. KP-100" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Leidinggevende</label>
                <input name="leidinggevende" placeholder="Naam" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Vestiging</label>
                <select name="vestiging_id" defaultValue="" className={inputCls}>
                  <option value="">Geen / hele organisatie</option>
                  {vestigingen.map((v) => <option key={v.id} value={v.id}>{v.naam}</option>)}
                </select>
              </div>
              <p className="text-xs font-semibold text-warm">Eigen adres (optioneel)</p>
              <div>
                <input name="leveradres" placeholder="Leveradres" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input name="leverpostcode" placeholder="Postcode" className={inputCls} />
                <input name="leverplaats" placeholder="Plaats" className={inputCls} />
              </div>
              <div>
                <input name="factuuradres" placeholder="Factuuradres" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input name="factuurpostcode" placeholder="Postcode" className={inputCls} />
                <input name="factuurplaats" placeholder="Plaats" className={inputCls} />
              </div>
              <button type="submit" className="self-start rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Toevoegen</button>
            </form>
          </div>
        </div>
      </section>

      {/* Managers en scope */}
      <section className="mt-12">
        <h2 className="font-display text-xl font-bold text-ink-900">Managers en scope</h2>
        <p className="mt-1 text-sm text-warm">Beperk leidinggevenden of beheerders tot een vestiging of afdeling, of geef ze de hele organisatie.</p>
        <div className="mt-4">
          {managers.length === 0 ? (
            <p className="rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen leidinggevenden of beheerders gekoppeld.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {managers.map((m) => {
                const huidigeScope = m.scope_afdeling_id ? `a:${m.scope_afdeling_id}` : m.scope_vestiging_id ? `v:${m.scope_vestiging_id}` : '';
                return (
                  <div key={m.id} className="rounded-2xl border border-line bg-white p-6 shadow-soft">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-ink-900">{m.naam || m.email || 'Onbekend'}</p>
                        <p className="text-xs text-warm">{m.email}{m.rol ? ` ${"·"} ${m.rol}` : ''}</p>
                      </div>
                      <form action={bewaarManagerScope} className="flex items-end gap-2">
                        <input type="hidden" name="orgId" value={id} />
                        <input type="hidden" name="gebruikerId" value={m.id} />
                        <div>
                          <label className="block text-xs font-semibold text-warm">Scope</label>
                          <select name="scope" defaultValue={huidigeScope} className={inputCls}>
                            <option value="">Hele organisatie</option>
                            {vestigingen.length > 0 && (
                              <optgroup label="Vestiging">
                                {vestigingen.map((v) => <option key={v.id} value={`v:${v.id}`}>{v.naam}</option>)}
                              </optgroup>
                            )}
                            {afdelingen.length > 0 && (
                              <optgroup label="Afdeling">
                                {afdelingen.map((a) => <option key={a.id} value={`a:${a.id}`}>{a.naam}{a.vestiging_naam ? ` (${a.vestiging_naam})` : ''}</option>)}
                              </optgroup>
                            )}
                          </select>
                        </div>
                        <button type="submit" className="rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Opslaan</button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
