import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { isPortalConfigured } from '@/lib/env';
import { getPortaalUser, getMijnOrganisatie } from '@/lib/portaal/queries';
import { getMijnToegang } from '@/lib/portaal/team';
import { getKlachtCategorieen, getMijnKlachten, getMijnOrders, type KlachtStatus, type KlachtSoort } from '@/lib/portaal/service';
import PortaalNav from '../PortaalNav';
import { reageerKlacht, vraagKlacht } from './actions';

export const metadata: Metadata = { title: 'Vragen en klachten', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const veld = 'mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink-900 focus:border-amber-500 focus:outline-none';
const datum = (s: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(s));
const moment = (s: string) =>
  new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(new Date(s));

const statusLabel: Record<KlachtStatus, string> = {
  open: 'Open',
  in_behandeling: 'In behandeling',
  afgehandeld: 'Afgehandeld',
};
const soortLabel: Record<KlachtSoort, string> = { vraag: 'Vraag', klacht: 'Klacht' };

function StatusBadge({ status }: { status: KlachtStatus }) {
  const label = statusLabel[status] ?? status;
  const toon =
    status === 'afgehandeld'
      ? 'border-green-300 bg-green-50 text-green-800'
      : status === 'in_behandeling'
        ? 'border-amber-300 bg-amber-50 text-amber-700'
        : 'border-line bg-cream text-warm';
  return <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${toon}`}>{label}</span>;
}

export default async function Klachten({ searchParams }: { searchParams: Promise<{ ok?: string; leeg?: string; fout?: string; gereageerd?: string }> }) {
  if (!isPortalConfigured) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Klantportaal nog niet actief</h1>
          <p className="mt-3 text-sm text-warm">Het portaal staat nog niet aan. Neem contact op met Frederiks Bedrijfskleding.</p>
        </div>
      </main>
    );
  }

  const user = await getPortaalUser();
  if (!user) redirect('/portaal/login');

  const org = await getMijnOrganisatie();
  if (!org) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Je account is nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Je bent ingelogd als {user.email}, maar dit adres hangt nog niet aan een bedrijf. Neem contact op met Frederiks Bedrijfskleding.</p>
        </div>
      </main>
    );
  }

  const sp = await searchParams;
  const [klachten, orders, toegang, categorieen] = await Promise.all([getMijnKlachten(), getMijnOrders(), getMijnToegang(), getKlachtCategorieen()]);

  return (
    <main className="container-x py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Klantportaal</p>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">Vragen en klachten</h1>
        </div>
      </div>
      <PortaalNav rol={toegang.rol} actief="/portaal/klachten" />

      <p className="mt-6 max-w-2xl text-sm text-warm">Stel een vraag of meld een klacht. Je kunt het koppelen aan een bestelling als dat helpt. We reageren zo snel mogelijk en je leest het antwoord hier terug.</p>

      {sp?.ok && (
        <div className="mt-6 rounded-xl border border-green-300 bg-green-50 p-4 text-sm text-green-800">
          Je bericht is verstuurd. We nemen het in behandeling en reageren zo snel mogelijk.
        </div>
      )}
      {sp?.gereageerd && (
        <div className="mt-6 rounded-xl border border-green-300 bg-green-50 p-4 text-sm text-green-800">
          Je reactie is verstuurd. We lezen mee en komen erop terug.
        </div>
      )}
      {sp?.leeg && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-ink-800">
          Vul kort je vraag of klacht in zodat we je kunnen helpen.
        </div>
      )}
      {sp?.fout && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-ink-800">
          Er ging iets mis bij het versturen. Probeer het zo nog eens of bel ons even.
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div>
          <div className="rounded-xl border border-line bg-white p-5 shadow-soft">
            <h2 className="font-display text-lg font-extrabold text-ink-900">Nieuw bericht</h2>
            <form action={vraagKlacht} className="mt-4">
              <label htmlFor="soort" className="block text-sm font-semibold text-ink-900">Soort</label>
              <select id="soort" name="soort" className={veld} defaultValue="vraag">
                <option value="vraag">Vraag</option>
                <option value="klacht">Klacht</option>
              </select>

              {categorieen.length > 0 && (
                <>
                  <label htmlFor="categorie" className="mt-4 block text-sm font-semibold text-ink-900">Waar gaat het over?</label>
                  <select id="categorie" name="categorie" className={veld} defaultValue="">
                    <option value="">Weet ik niet</option>
                    {categorieen.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </>
              )}

              <label htmlFor="order_id" className="mt-4 block text-sm font-semibold text-ink-900">Bestelling (optioneel)</label>
              <select id="order_id" name="order_id" className={veld} defaultValue="">
                <option value="">Geen specifieke bestelling</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>{o.ordernummer ? `Order ${o.ordernummer}` : 'Bestelling'}</option>
                ))}
              </select>

              <label htmlFor="omschrijving" className="mt-4 block text-sm font-semibold text-ink-900">Omschrijving</label>
              <textarea id="omschrijving" name="omschrijving" rows={4} required placeholder="Beschrijf je vraag of klacht zo concreet mogelijk." className={veld} />

              <button type="submit" className="btn-primary mt-4 w-full justify-center">Versturen</button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2">
          {klachten.length === 0 ? (
            <p className="text-sm text-warm">Je hebt nog geen vragen of klachten ingediend.</p>
          ) : (
            <div className="space-y-5">
              {klachten.map((k) => (
                <div key={k.id} className="rounded-xl border border-line bg-white p-6 shadow-soft">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-ink-900">
                      {soortLabel[k.soort] ?? k.soort}
                      {k.categorie ? ` · ${k.categorie}` : ''}
                      {k.ordernummer ? ` · order ${k.ordernummer}` : ''} {"·"} {datum(k.created_at)}
                    </p>
                    <StatusBadge status={k.status} />
                  </div>

                  <p className="mt-3 text-sm text-ink-800">{k.omschrijving}</p>

                  {k.berichten.length > 0 ? (
                    <ol className="mt-4 space-y-2">
                      {k.berichten.map((b) => (
                        <li
                          key={b.id}
                          className={`rounded-lg px-4 py-3 text-sm ${b.soort === 'klant' ? 'ml-6 border border-line bg-white text-ink-800' : 'mr-6 bg-cream text-ink-800'}`}
                        >
                          <p className="text-xs font-semibold text-warm">
                            {b.soort === 'klant' ? 'Jij' : 'Frederiks Bedrijfskleding'} {'·'} {moment(b.created_at)}
                          </p>
                          <p className="mt-1 whitespace-pre-line">{b.tekst}</p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    k.antwoord && (
                      <p className="mt-4 rounded-lg bg-cream px-4 py-3 text-sm text-warm"><span className="font-semibold text-ink-800">Antwoord:</span> {k.antwoord}</p>
                    )
                  )}

                  {k.berichten.length > 0 && (
                    <form action={reageerKlacht} className="mt-4">
                      <input type="hidden" name="klacht_id" value={k.id} />
                      <label htmlFor={`reactie-${k.id}`} className="block text-sm font-semibold text-ink-900">Reageren</label>
                      <textarea id={`reactie-${k.id}`} name="tekst" rows={2} required placeholder="Typ je reactie" className={veld} />
                      <button type="submit" className="btn-secondary mt-2">Reactie versturen</button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
