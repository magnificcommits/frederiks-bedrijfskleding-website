import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env, isLeadsDbConfigured } from '@/lib/env';
import { getOrganisatie, getGebruikers, listItems, listBestellingen } from '@/lib/portaalAdmin';
import { koppelGebruiker, voegItemToe, wisselItemActief, zetStatus } from './actions';

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
const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n || 0);

const inputCls = 'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';

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

  const [gebruikers, items, bestellingen] = await Promise.all([
    getGebruikers(id),
    listItems(id),
    listBestellingen(id),
  ]);

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">{org.naam}</h1>
          <p className="mt-1 text-sm text-warm">{org.plaats || 'Geen plaats'}</p>
        </div>
        <Link href="/dashboard/klanten" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar klanten</Link>
      </div>

      <section className="mt-10">
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

      <section className="mt-12">
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
    </main>
  );
}
