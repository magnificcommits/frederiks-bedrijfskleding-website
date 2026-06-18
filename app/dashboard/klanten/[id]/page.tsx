import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env, isLeadsDbConfigured } from '@/lib/env';
import { getOrganisatie, getGebruikers, listItems, listBestellingen } from '@/lib/portaalAdmin';
import { listContactpersonen, listActiviteiten, getKlantVerkoop, ACTIVITEIT_SOORTEN } from '@/lib/kms/crm';
import { listLogos } from '@/lib/kms/logos';
import { werkOrganisatie, koppelGebruiker, voegItemToe, wisselItemActief, zetStatus, nieuwContact, verwijderContactActie, nieuweActiviteit, verwijderActiviteitActie, nieuwLogoActie, verwijderLogoActie } from './actions';
import ConfirmSubmit from '@/components/ConfirmSubmit';
import Tabs, { type TabDef } from '@/components/dashboard/Tabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Klant', robots: { index: false, follow: false } };
const DASH_COOKIE = 'fb_dash';

const bestelStatussen = ['aangevraagd', 'bevestigd', 'geleverd'] as const;

async function authed() {
  return Boolean(env.dashboardPassword) && (await cookies()).get(DASH_COOKIE)?.value === env.dashboardPassword.trim();
}

function fmt(d: string) {
  try { return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return d; }
}
function fmtDatum(d: string | null) {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}
const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n || 0);

const SOORT_LABEL: Record<string, string> = {
  notitie: 'Notitie', telefoon: 'Telefoon', bezoek: 'Bezoek', offerte: 'Offerte', mail: 'Mail',
};

const inputCls = 'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';
const fileCls = 'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-mist file:px-3 file:py-1 file:text-xs file:font-semibold file:text-ink-700 hover:file:bg-line focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';

export default async function KlantPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await authed())) redirect('/dashboard');
  const { id } = await params;

  if (!isLeadsDbConfigured) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Leaddatabase nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen en draai de migraties in <code>supabase/migrations</code>.</p>
          <Link href="/dashboard/klanten" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar klanten</Link>
        </div>
      </main>
    );
  }

  const org = await getOrganisatie(id);
  if (!org) {
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

  const [gebruikers, items, bestellingen, contactpersonen, activiteiten, verkoop, logos] = await Promise.all([
    getGebruikers(id),
    listItems(id),
    listBestellingen(id),
    listContactpersonen(id),
    listActiviteiten(id),
    getKlantVerkoop(id),
    listLogos(id),
  ]);

  const vandaag = new Date(); vandaag.setHours(0, 0, 0, 0);
  const isOpvolgingDue = (d: string | null) => {
    if (!d) return false;
    const dd = new Date(d); dd.setHours(0, 0, 0, 0);
    return dd.getTime() <= vandaag.getTime();
  };

  const gegevensTab = (
    <>
      <section>
        <h2 className="font-display text-xl font-bold text-ink-900">Gegevens</h2>
        <form action={werkOrganisatie} className="mt-4 grid gap-4 rounded-2xl border border-line bg-white p-6 shadow-soft sm:grid-cols-2">
          <input type="hidden" name="orgId" value={id} />
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-warm">Bedrijfsnaam</label>
            <input name="naam" required defaultValue={org.naam} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-warm">Adres</label>
            <input name="adres" defaultValue={org.adres ?? ''} placeholder="Straat en huisnummer" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-warm">Postcode</label>
            <input name="postcode" defaultValue={org.postcode ?? ''} placeholder="0000 AA" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-warm">Plaats</label>
            <input name="plaats" defaultValue={org.plaats ?? ''} placeholder="Plaats" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-warm">Telefoon</label>
            <input name="telefoon" defaultValue={org.telefoon ?? ''} placeholder="06 12 34 56 78" className={inputCls} />
          </div>
          <div className="flex items-end">
            <button type="submit" className="rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Gegevens opslaan</button>
          </div>
        </form>
      </section>
    </>
  );

  const bestellingenSectie = (
    <section className="mt-12">
        <h2 className="font-display text-xl font-bold text-ink-900">Bestellingen</h2>
        {bestellingen.length === 0 ? (
          <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen herbestellingen.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {bestellingen.map((b) => (
              <div key={b.id} className="rounded-2xl border border-line bg-white p-5 shadow-soft">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{fmt(b.created_at)}</p>
                    <p className="text-sm text-warm">Aangevraagd door {b.aangevraagd_door || 'onbekend'}</p>
                    {(b.medewerker_naam || b.waarde != null) && (
                      <p className="text-sm text-warm">{b.medewerker_naam ? `Voor ${b.medewerker_naam}` : ''}{b.medewerker_naam && b.waarde != null ? ' · ' : ''}{b.waarde != null ? `waarde ${euro(Number(b.waarde))}` : ''}</p>
                    )}
                  </div>
                  <form action={zetStatus} className="flex items-center gap-2">
                    <input type="hidden" name="orgId" value={id} />
                    <input type="hidden" name="bestelId" value={b.id} />
                    <select name="status" defaultValue={b.status} className="rounded-md border border-line px-2 py-1 text-xs">
                      {bestelStatussen.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button type="submit" className="rounded-md bg-ink-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-ink-800">Opslaan</button>
                  </form>
                </div>
                <ul className="mt-3 divide-y divide-line border-t border-line text-sm">
                  {b.portaal_bestelregels.map((r) => (
                    <li key={r.id} className="flex items-center justify-between py-2">
                      <span className="text-ink-900">{r.item_naam}{r.maat ? ` · maat ${r.maat}` : ''}</span>
                      <span className="text-warm">{r.aantal}x</span>
                    </li>
                  ))}
                </ul>
                {b.notitie && <p className="mt-3 whitespace-pre-wrap rounded-md bg-mist px-3 py-2 text-xs text-warm">{b.notitie}</p>}
              </div>
            ))}
          </div>
        )}
    </section>
  );

  const verkoopTab = (
    <>
      <section>
        <h2 className="font-display text-xl font-bold text-ink-900">Verkoopoverzicht</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-wide text-warm">Orders</p>
            <p className="mt-1 font-display text-2xl font-extrabold text-ink-900">{verkoop.orders.length}</p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-wide text-warm">Facturen</p>
            <p className="mt-1 font-display text-2xl font-extrabold text-ink-900">{verkoop.facturen.length}</p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-wide text-warm">Omzet (betaald)</p>
            <p className="mt-1 font-display text-2xl font-extrabold text-ink-900">{euro(verkoop.omzetBetaald)}</p>
          </div>
        </div>
        {verkoop.herkomstLead && (
          <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-3 text-sm text-warm">
            Aangebracht via: <span className="font-semibold text-ink-900">{verkoop.herkomstLead.bron || 'onbekende bron'}</span>
          </p>
        )}
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="font-display text-base font-bold text-ink-900">Laatste orders</h3>
            {verkoop.orders.length === 0 ? (
              <p className="mt-3 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen orders.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white text-sm shadow-soft">
                {verkoop.orders.slice(0, 5).map((o) => (
                  <li key={o.id} className="flex items-center justify-between px-4 py-3">
                    <span className="text-ink-900">{o.ordernummer != null ? `#${o.ordernummer}` : 'order'} {"·"} {fmtDatum(o.besteldatum)}</span>
                    <span className="flex items-center gap-3 text-warm">
                      {o.bedrag != null && <span>{euro(Number(o.bedrag))}</span>}
                      <span className="inline-block rounded-full bg-mist px-2.5 py-1 text-xs font-semibold text-ink-700">{o.status}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-ink-900">Laatste facturen</h3>
            {verkoop.facturen.length === 0 ? (
              <p className="mt-3 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen facturen.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white text-sm shadow-soft">
                {verkoop.facturen.slice(0, 5).map((f) => (
                  <li key={f.id} className="flex items-center justify-between px-4 py-3">
                    <span className="text-ink-900">{f.factuurnummer || 'factuur'} {"·"} {fmtDatum(f.factuurdatum)}</span>
                    <span className="flex items-center gap-3 text-warm">
                      {f.bedrag_incl != null && <span>{euro(Number(f.bedrag_incl))}</span>}
                      <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${f.status === 'betaald' ? 'bg-green-100 text-green-800' : 'bg-mist text-ink-700'}`}>{f.status}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
      {bestellingenSectie}
    </>
  );

  const contactTab = (
    <>
      <section>
        <h2 className="font-display text-xl font-bold text-ink-900">Contactpersonen</h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {contactpersonen.length === 0 ? (
              <p className="rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen contactpersonen.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-warm">
                    <tr>
                      <th className="px-4 py-3">Naam</th>
                      <th className="px-4 py-3">Functie</th>
                      <th className="px-4 py-3">E-mail</th>
                      <th className="px-4 py-3">Telefoon</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {contactpersonen.map((c) => (
                      <tr key={c.id} className="border-b border-line align-top">
                        <td className="px-4 py-3 font-semibold text-ink-900">
                          {c.naam}
                          {c.hoofdcontact && <span className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">hoofdcontact</span>}
                        </td>
                        <td className="px-4 py-3 text-warm">{c.functie || '-'}</td>
                        <td className="px-4 py-3 text-warm">{c.email || '-'}</td>
                        <td className="px-4 py-3 text-warm">{[c.telefoon, c.mobiel].filter(Boolean).join(' · ') || '-'}</td>
                        <td className="px-4 py-3 text-right">
                          <form action={verwijderContactActie}>
                            <input type="hidden" name="orgId" value={id} />
                            <input type="hidden" name="contactId" value={c.id} />
                            <ConfirmSubmit message="Deze contactpersoon verwijderen?" className="rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-mist">Verwijderen</ConfirmSubmit>
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
            <h3 className="font-display text-base font-bold text-ink-900">Contactpersoon toevoegen</h3>
            <form action={nieuwContact} className="mt-4 flex flex-col gap-3">
              <input type="hidden" name="orgId" value={id} />
              <div>
                <label className="block text-xs font-semibold text-warm">Naam</label>
                <input name="naam" required placeholder="Naam" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Functie</label>
                <input name="functie" placeholder="Bijv. inkoop" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">E-mail</label>
                <input name="email" type="email" placeholder="naam@bedrijf.nl" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Telefoon</label>
                <input name="telefoon" placeholder="0314 12 34 56" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Mobiel</label>
                <input name="mobiel" placeholder="06 12 34 56 78" className={inputCls} />
              </div>
              <label className="flex items-center gap-2 text-sm text-warm">
                <input name="hoofdcontact" type="checkbox" className="h-4 w-4 rounded border-line text-ink-900 focus:ring-amber-200" />
                Hoofdcontact
              </label>
              <button type="submit" className="self-start rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Toevoegen</button>
            </form>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-xl font-bold text-ink-900">Activiteiten en opvolging</h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {activiteiten.length === 0 ? (
              <p className="rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen activiteiten vastgelegd.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {activiteiten.map((a) => {
                  const due = isOpvolgingDue(a.opvolgdatum);
                  return (
                    <li key={a.id} className={`rounded-2xl border p-5 shadow-soft ${due ? 'border-amber-300 bg-amber-50' : 'border-line bg-white'}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-ink-900">
                            <span className="mr-2 inline-block rounded-full bg-mist px-2.5 py-0.5 text-xs font-semibold text-ink-700">{SOORT_LABEL[a.soort] || a.soort}</span>
                            {fmtDatum(a.datum)}
                            {a.door && <span className="ml-2 font-normal text-warm">door {a.door}</span>}
                          </p>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-warm">{a.omschrijving}</p>
                          {a.opvolgdatum && (
                            <p className={`mt-2 text-xs font-semibold ${due ? 'text-amber-800' : 'text-warm'}`}>
                              Opvolgen op {fmtDatum(a.opvolgdatum)}{due ? ' (actie nodig)' : ''}
                            </p>
                          )}
                        </div>
                        <form action={verwijderActiviteitActie}>
                          <input type="hidden" name="orgId" value={id} />
                          <input type="hidden" name="activiteitId" value={a.id} />
                          <ConfirmSubmit message="Deze activiteit verwijderen?" className="rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-mist">Verwijderen</ConfirmSubmit>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <h3 className="font-display text-base font-bold text-ink-900">Activiteit toevoegen</h3>
            <form action={nieuweActiviteit} className="mt-4 flex flex-col gap-3">
              <input type="hidden" name="orgId" value={id} />
              <div>
                <label className="block text-xs font-semibold text-warm">Soort</label>
                <select name="soort" defaultValue="notitie" className={inputCls}>
                  {ACTIVITEIT_SOORTEN.map((s) => <option key={s} value={s}>{SOORT_LABEL[s]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Omschrijving</label>
                <textarea name="omschrijving" required rows={3} placeholder="Wat is er gebeurd of afgesproken?" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Datum (mag leeg = vandaag)</label>
                <input name="datum" type="date" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Opvolgdatum (optioneel)</label>
                <input name="opvolgdatum" type="date" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Door</label>
                <input name="door" placeholder="Naam medewerker" className={inputCls} />
              </div>
              <button type="submit" className="self-start rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Vastleggen</button>
            </form>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-xl font-bold text-ink-900">Gebruikers</h2>
        <p className="mt-1 text-sm text-warm">Een gekoppeld e-mailadres kan inloggen op <code>/portaal</code>.</p>
        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {gebruikers.length === 0 ? (
              <p className="rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen gebruikers gekoppeld.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-warm">
                    <tr><th className="px-4 py-3">E-mail</th><th className="px-4 py-3">Naam</th><th className="px-4 py-3">Rol</th></tr>
                  </thead>
                  <tbody>
                    {gebruikers.map((g) => (
                      <tr key={g.id} className="border-b border-line">
                        <td className="px-4 py-3 font-medium text-ink-900">{g.email}</td>
                        <td className="px-4 py-3 text-warm">{g.naam || '-'}</td>
                        <td className="px-4 py-3 text-warm">{g.rol}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <h3 className="font-display text-base font-bold text-ink-900">E-mail koppelen</h3>
            <form action={koppelGebruiker} className="mt-4 flex flex-col gap-3">
              <input type="hidden" name="orgId" value={id} />
              <div>
                <label className="block text-xs font-semibold text-warm">E-mail</label>
                <input name="email" type="email" required placeholder="naam@bedrijf.nl" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Naam</label>
                <input name="naam" placeholder="Naam" className={inputCls} />
              </div>
              <button type="submit" className="self-start rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Koppelen</button>
            </form>
          </div>
        </div>
      </section>
    </>
  );

  const kledinglijnTab = (
    <>
      <section>
        <h2 className="font-display text-xl font-bold text-ink-900">Kledinglijn</h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {items.length === 0 ? (
              <p className="rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen items in de kledinglijn.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-warm">
                    <tr>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3">Merk / kleur</th>
                      <th className="px-4 py-3">Logo</th>
                      <th className="px-4 py-3">Richtprijs</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.id} className="border-b border-line align-top">
                        <td className="px-4 py-3 font-semibold text-ink-900">{it.naam}</td>
                        <td className="px-4 py-3 text-warm">{[it.merk, it.kleur].filter(Boolean).join(' · ') || '-'}</td>
                        <td className="px-4 py-3 text-warm">{[it.logopositie, it.techniek].filter(Boolean).join(' · ') || '-'}</td>
                        <td className="px-4 py-3 text-warm">{it.richtprijs != null ? euro(Number(it.richtprijs)) : '-'}</td>
                        <td className="px-4 py-3">
                          <form action={wisselItemActief} className="flex items-center gap-2">
                            <input type="hidden" name="orgId" value={id} />
                            <input type="hidden" name="itemId" value={it.id} />
                            <input type="hidden" name="actief" value={it.actief ? 'false' : 'true'} />
                            <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${it.actief ? 'bg-green-100 text-green-800' : 'bg-ink-100 text-ink-500'}`}>{it.actief ? 'actief' : 'inactief'}</span>
                            <button type="submit" className="rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-mist">{it.actief ? 'Inactief' : 'Actief'}</button>
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
            <h3 className="font-display text-base font-bold text-ink-900">Item toevoegen</h3>
            <form action={voegItemToe} className="mt-4 flex flex-col gap-3">
              <input type="hidden" name="orgId" value={id} />
              <div>
                <label className="block text-xs font-semibold text-warm">Naam</label>
                <input name="naam" required placeholder="Bijv. Softshell jas" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Merk</label>
                <input name="merk" placeholder="Merk" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Kleur</label>
                <input name="kleur" placeholder="Kleur" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Logopositie</label>
                <input name="logopositie" placeholder="Bijv. borst links" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Techniek</label>
                <input name="techniek" placeholder="Bijv. borduren" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Richtprijs (mag leeg)</label>
                <input name="richtprijs" inputMode="decimal" placeholder="bedrag" className={inputCls} />
              </div>
              <button type="submit" className="self-start rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Toevoegen</button>
            </form>
          </div>
        </div>
      </section>
    </>
  );

  const logosTab = (
    <section>
      <h2 className="font-display text-xl font-bold text-ink-900">Logo&apos;s</h2>
      <p className="mt-1 text-sm text-warm">Per klant bewaar je hier de logo&apos;s met de bestanden voor bedrukken en borduren.</p>
      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {logos.length === 0 ? (
            <p className="rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen logo&apos;s voor deze klant. Voeg er rechts een toe.</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {logos.map((l) => (
                <li key={l.id} className="flex flex-col rounded-2xl border border-line bg-white p-4 shadow-soft">
                  <div className="flex h-32 items-center justify-center overflow-hidden rounded-xl border border-line bg-mist">
                    {l.logo_bestand_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.logo_bestand_url} alt={l.naam} className="max-h-full max-w-full object-contain" />
                    ) : (
                      <span className="text-xs text-warm">Geen preview</span>
                    )}
                  </div>
                  <p className="mt-3 font-semibold text-ink-900">{l.naam}</p>
                  {l.opmerkingen && <p className="mt-1 text-xs text-warm">{l.opmerkingen}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {l.logo_bestand_url && <a href={l.logo_bestand_url} target="_blank" rel="noreferrer" className="rounded-md border border-line px-2 py-0.5 text-xs font-semibold text-amber-700 hover:bg-mist">Logo</a>}
                    {l.vectorbestand_url && <a href={l.vectorbestand_url} target="_blank" rel="noreferrer" className="rounded-md border border-line px-2 py-0.5 text-xs font-semibold text-amber-700 hover:bg-mist">Vector</a>}
                    {l.borduurbestand_url && <a href={l.borduurbestand_url} target="_blank" rel="noreferrer" className="rounded-md border border-line px-2 py-0.5 text-xs font-semibold text-amber-700 hover:bg-mist">Borduur</a>}
                  </div>
                  <form action={verwijderLogoActie} className="mt-3">
                    <input type="hidden" name="orgId" value={id} />
                    <input type="hidden" name="logoId" value={l.id} />
                    <ConfirmSubmit message="Dit logo verwijderen?" className="rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-mist">Verwijderen</ConfirmSubmit>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h3 className="font-display text-base font-bold text-ink-900">Logo toevoegen</h3>
          <p className="mt-1 text-xs text-warm">Upload een bestand, of plak een URL als alternatief.</p>
          <form action={nieuwLogoActie} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="orgId" value={id} />
            <div>
              <label className="block text-xs font-semibold text-warm">Naam</label>
              <input name="naam" required placeholder="Bijv. Bedrijfslogo borst" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-warm">Logo-bestand</label>
              <input type="file" name="logo_bestand" accept="image/*" className={fileCls} />
              <input name="logo_bestand_url" placeholder="of plak een URL" className={`${inputCls} mt-2`} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-warm">Vectorbestand</label>
              <input type="file" name="vectorbestand" accept="image/*" className={fileCls} />
              <input name="vectorbestand_url" placeholder="of plak een URL" className={`${inputCls} mt-2`} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-warm">Borduurbestand</label>
              <input type="file" name="borduurbestand" accept="image/*" className={fileCls} />
              <input name="borduurbestand_url" placeholder="of plak een URL" className={`${inputCls} mt-2`} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-warm">Opmerkingen / positie / techniek</label>
              <textarea name="opmerkingen" rows={3} placeholder="Bijv. borst links, borduren, kleurcodes" className={inputCls} />
            </div>
            <button type="submit" className="self-start rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Logo opslaan</button>
          </form>
        </div>
      </div>
    </section>
  );

  const tabs: TabDef[] = [
    { id: 'gegevens', label: 'Gegevens', content: gegevensTab },
    { id: 'contact', label: 'Contact', content: contactTab, badge: contactpersonen.length || null },
    { id: 'verkoop', label: 'Verkoop', content: verkoopTab, badge: verkoop.orders.length || null },
    { id: 'kledinglijn', label: 'Kledinglijn', content: kledinglijnTab, badge: items.length || null },
    { id: 'logos', label: "Logo's", content: logosTab, badge: logos.length || null },
  ];

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">{org.naam}</h1>
          <p className="mt-1 text-sm text-warm">{org.plaats || 'Geen plaats'}</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/klanten/${id}/structuur`} className="text-sm font-semibold text-amber-700 hover:text-amber-800">Inrichting</Link>
          <Link href={`/dashboard/klanten/${id}/assortiment`} className="text-sm font-semibold text-amber-700 hover:text-amber-800">Assortiment</Link>
          <Link href="/dashboard/klanten" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar klanten</Link>
        </div>
      </div>

      <div className="mt-8">
        <Tabs tabs={tabs} />
      </div>
    </main>
  );
}
