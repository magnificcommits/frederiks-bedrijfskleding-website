import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { isPortalConfigured } from '@/lib/env';
import { getPortaalUser, getMijnOrganisatie, getKledinglijn, getMedewerkers, getMatenMap, getVerbruik } from '@/lib/portaal/queries';
import { getMijnToegang } from '@/lib/portaal/team';
import PortaalNav from '../PortaalNav';
import { nieuweMedewerker, verwijderMedewerkerAction, bewaarMaten, bewaarBudget } from './actions';

export const metadata: Metadata = { title: 'Medewerkers', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const veld = 'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';
const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

export default async function Medewerkers({ searchParams }: { searchParams: Promise<{ bewaard?: string }> }) {
  if (!isPortalConfigured) {
    return (
      <main className="container-x py-20"><div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
        <h1 className="font-display text-2xl font-extrabold text-ink-900">Klantportaal nog niet actief</h1>
        <p className="mt-3 text-sm text-warm">Neem contact op met Frederiks Bedrijfskleding.</p>
      </div></main>
    );
  }
  const user = await getPortaalUser();
  if (!user) redirect('/portaal/login');
  const org = await getMijnOrganisatie();
  if (!org) {
    return (
      <main className="container-x py-20"><div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
        <h1 className="font-display text-2xl font-extrabold text-ink-900">Je account is nog niet gekoppeld</h1>
        <p className="mt-3 text-sm text-warm">Je bent ingelogd als {user.email}, maar dit adres hangt nog niet aan een bedrijf.</p>
      </div></main>
    );
  }

  const toegang = await getMijnToegang();
  const magBeheren = toegang.rol === 'beheerder' || toegang.rol === 'leidinggevende';
  if (!magBeheren) {
    return (
      <main className="container-x py-12">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">Klantportaal</p>
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Medewerkers en maten</h1>
        <PortaalNav rol={toegang.rol} actief="/portaal/medewerkers" />
        <div className="mt-8 max-w-xl rounded-2xl border border-line bg-white p-6 shadow-soft">
          <p className="text-sm text-warm">Alleen een beheerder of leidinggevende kan medewerkers en maten beheren.</p>
          <Link href="/portaal" className="mt-4 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar het overzicht</Link>
        </div>
      </main>
    );
  }

  const sp = await searchParams;
  const [items, medewerkers, verbruik] = await Promise.all([getKledinglijn(), getMedewerkers(), getVerbruik()]);
  const matenPer: Record<string, Record<string, string>> = Object.fromEntries(
    await Promise.all(medewerkers.map(async (m) => [m.id, await getMatenMap(m.id)] as const)),
  );

  return (
    <main className="container-x py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">Klantportaal</p>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">Medewerkers en maten</h1>
        </div>
      </div>
      <PortaalNav rol={toegang.rol} actief="/portaal/medewerkers" />
      <p className="mt-6 max-w-2xl text-sm text-warm">Leg je medewerkers, hun maten en een eventueel kledingbudget vast. Bij een herbestelling kies je een medewerker en zijn de maten al ingevuld.</p>

      {sp?.bewaard && <div className="mt-6 rounded-xl border border-green-300 bg-green-50 p-4 text-sm text-green-800">De maten zijn opgeslagen.</div>}

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {medewerkers.length === 0 ? (
            <p className="text-sm text-warm">Nog geen medewerkers toegevoegd. Voeg er rechts een toe.</p>
          ) : (
            <div className="space-y-5">
              {medewerkers.map((m) => {
                const v = verbruik[m.id] ?? 0;
                const restant = m.budget != null ? Number(m.budget) - v : null;
                return (
                  <div key={m.id} className="rounded-xl border border-line bg-white p-5 shadow-soft">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-ink-900">{m.naam}</p>
                        {m.functie && <p className="text-sm text-warm">{m.functie}</p>}
                      </div>
                      <form action={verwijderMedewerkerAction}>
                        <input type="hidden" name="id" value={m.id} />
                        <button className="text-xs font-semibold text-warm hover:text-amber-700">Verwijderen</button>
                      </form>
                    </div>

                    <div className="mt-3 flex flex-wrap items-end gap-4 border-t border-line pt-3">
                      <form action={bewaarBudget} className="flex items-end gap-2">
                        <input type="hidden" name="medewerker_id" value={m.id} />
                        <div>
                          <label className="block text-xs font-semibold text-warm">Jaarbudget</label>
                          <input name="budget" defaultValue={m.budget ?? ''} inputMode="decimal" placeholder="bijv. 250" className="mt-1 w-28 rounded-md border border-line px-3 py-2 text-sm" />
                        </div>
                        <button className="rounded-md border border-line px-2.5 py-2 text-xs font-semibold text-ink-700 hover:bg-mist">Opslaan</button>
                      </form>
                      <div className="text-sm">
                        <p className="text-warm">Verbruikt: <span className="font-semibold text-ink-900">{euro(v)}</span></p>
                        {restant != null && <p className={`font-semibold ${restant < 0 ? 'text-amber-700' : 'text-ink-700'}`}>Restant: {euro(restant)}</p>}
                      </div>
                    </div>

                    {items.length > 0 && (
                      <form action={bewaarMaten} className="mt-4 border-t border-line pt-4">
                        <input type="hidden" name="medewerker_id" value={m.id} />
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-warm">Maten</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {items.map((it) => (
                            <div key={it.id}>
                              <label className="block text-xs font-semibold text-warm">{it.naam}</label>
                              <input name={`maat_${it.id}`} defaultValue={matenPer[m.id]?.[it.id] ?? ''} placeholder="maat" className={veld} />
                            </div>
                          ))}
                        </div>
                        <button className="mt-3 rounded-md bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-800">Maten opslaan</button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className="rounded-xl border border-line bg-white p-5 shadow-soft">
            <h2 className="font-display text-lg font-extrabold text-ink-900">Medewerker toevoegen</h2>
            <form action={nieuweMedewerker} className="mt-4">
              <label className="block text-sm font-semibold text-ink-900">Naam</label>
              <input name="naam" required placeholder="Naam" className={veld} />
              <label className="mt-3 block text-sm font-semibold text-ink-900">Functie (optioneel)</label>
              <input name="functie" placeholder="bijv. monteur" className={veld} />
              <button className="btn-primary mt-4 w-full justify-center">Toevoegen</button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
