import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { isPortalConfigured } from '@/lib/env';
import { getPortaalUser, getMijnOrganisatie } from '@/lib/portaal/queries';
import { getMijnToegang, listTeam } from '@/lib/portaal/team';
import PortaalNav from '../PortaalNav';
import {
  nieuwTeamlid,
  geefToegangAction,
  wijzigRolAction,
  trekToegangInAction,
  zetBudgetAction,
} from './actions';

export const metadata: Metadata = { title: 'Team en toegang', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const veld =
  'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';
const euro = (n: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

const rolLabel: Record<string, string> = {
  beheerder: 'Beheerder',
  leidinggevende: 'Leidinggevende',
  medewerker: 'Medewerker',
};

const meldingen: Record<string, { soort: 'ok' | 'fout'; tekst: string }> = {
  toegevoegd: { soort: 'ok', tekst: 'De medewerker is toegevoegd.' },
  toegang: { soort: 'ok', tekst: 'De toegang is aangemaakt.' },
  rol: { soort: 'ok', tekst: 'De rol is gewijzigd.' },
  ingetrokken: { soort: 'ok', tekst: 'De toegang is ingetrokken.' },
  budget: { soort: 'ok', tekst: 'Het budget is opgeslagen.' },
  naam: { soort: 'fout', tekst: 'Vul minimaal een naam in.' },
  email: { soort: 'fout', tekst: 'Voor toegang is een e-mailadres nodig.' },
  opslaan: { soort: 'fout', tekst: 'Er ging iets mis bij het opslaan. Probeer het opnieuw.' },
};

export default async function TeamPagina({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; fout?: string }>;
}) {
  if (!isPortalConfigured) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Klantportaal nog niet actief</h1>
          <p className="mt-3 text-sm text-warm">Neem contact op met Frederiks Bedrijfskleding.</p>
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
          <p className="mt-3 text-sm text-warm">Je bent ingelogd als {user.email}, maar dit adres hangt nog niet aan een bedrijf.</p>
        </div>
      </main>
    );
  }

  const toegang = await getMijnToegang();

  if (toegang.rol !== 'beheerder') {
    return (
      <main className="container-x py-12">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">Klantportaal</p>
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Team en toegang</h1>
        <PortaalNav rol={toegang.rol} actief="/portaal/team" />
        <div className="mt-8 max-w-xl rounded-2xl border border-line bg-white p-6 shadow-soft">
          <p className="text-sm text-warm">
            Alleen een beheerder kan medewerkers en toegang beheren. Vraag je beheerder om je rechten als je hier
            iets moet aanpassen.
          </p>
          <Link href="/portaal" className="mt-4 inline-block text-sm font-semibold text-warm hover:text-ink-800">
            Terug naar het overzicht
          </Link>
        </div>
      </main>
    );
  }

  const sp = await searchParams;
  const melding = sp?.ok ? meldingen[sp.ok] : sp?.fout ? meldingen[sp.fout] : null;
  const team = await listTeam();

  return (
    <main className="container-x py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">Klantportaal</p>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">Team en toegang</h1>
        </div>
      </div>
      <PortaalNav rol={toegang.rol} actief="/portaal/team" />

      <p className="mt-6 max-w-2xl text-sm text-warm">
        Geef je eigen medewerkers toegang tot het portaal met een rol. Een leidinggevende kan bestellingen
        goedkeuren, een medewerker bestelt en ziet alleen zijn eigen bestellingen. Met een budget per medewerker
        houd je grip op de uitgaven.
      </p>

      {melding && (
        <div
          className={`mt-6 rounded-xl border p-4 text-sm ${
            melding.soort === 'ok'
              ? 'border-green-300 bg-green-50 text-green-800'
              : 'border-amber-300 bg-amber-50 text-ink-800'
          }`}
        >
          {melding.tekst}
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          {team.length === 0 ? (
            <p className="text-sm text-warm">Nog geen medewerkers. Voeg er rechts een toe.</p>
          ) : (
            team.map((m) => (
              <div key={m.medewerkerId} className="rounded-2xl border border-line bg-white p-6 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-ink-900">{m.naam}</p>
                    <p className="mt-0.5 text-sm text-warm">
                      {[m.functie, m.email].filter(Boolean).join(' · ') || 'Geen contactgegevens'}
                    </p>
                  </div>
                  {m.toegang ? (
                    <span className="inline-block rounded-full border border-green-300 bg-green-50 px-3 py-1 text-xs font-semibold text-green-800">
                      {rolLabel[m.toegang.rol] ?? m.toegang.rol}
                    </span>
                  ) : (
                    <span className="inline-block rounded-full border border-line bg-cream px-3 py-1 text-xs font-semibold text-warm">
                      Geen toegang
                    </span>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-line pt-4">
                  <form action={zetBudgetAction} className="flex items-end gap-2">
                    <input type="hidden" name="medewerker_id" value={m.medewerkerId} />
                    <div>
                      <label className="block text-xs font-semibold text-warm">Jaarbudget</label>
                      <input
                        name="budget"
                        defaultValue={m.budget ?? ''}
                        inputMode="decimal"
                        placeholder="bijv. 250"
                        className="mt-1 w-28 rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
                      />
                    </div>
                    <button className="rounded-md border border-line px-2.5 py-2 text-xs font-semibold text-ink-700 hover:bg-mist">
                      Opslaan
                    </button>
                  </form>
                  {m.budget != null && (
                    <p className="py-2 text-sm text-warm">
                      Budget: <span className="font-semibold text-ink-900">{euro(Number(m.budget))}</span>
                    </p>
                  )}
                </div>

                <div className="mt-4 border-t border-line pt-4">
                  {m.toegang ? (
                    <div className="flex flex-wrap items-end gap-3">
                      <form action={wijzigRolAction} className="flex items-end gap-2">
                        <input type="hidden" name="email" value={m.toegang.email} />
                        <div>
                          <label className="block text-xs font-semibold text-warm">Rol</label>
                          <select name="rol" defaultValue={m.toegang.rol} className="mt-1 rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200">
                            <option value="medewerker">Medewerker</option>
                            <option value="leidinggevende">Leidinggevende</option>
                            <option value="beheerder">Beheerder</option>
                          </select>
                        </div>
                        <button className="rounded-md border border-line px-2.5 py-2 text-xs font-semibold text-ink-700 hover:bg-mist">
                          Rol opslaan
                        </button>
                      </form>
                      <form action={trekToegangInAction}>
                        <input type="hidden" name="email" value={m.toegang.email} />
                        <button className="py-2 text-xs font-semibold text-warm hover:text-amber-700">
                          Toegang intrekken
                        </button>
                      </form>
                    </div>
                  ) : m.email ? (
                    <form action={geefToegangAction} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="medewerker_id" value={m.medewerkerId} />
                      <input type="hidden" name="naam" value={m.naam} />
                      <input type="hidden" name="email" value={m.email} />
                      <div>
                        <label className="block text-xs font-semibold text-warm">Geef toegang als</label>
                        <select name="rol" defaultValue="medewerker" className="mt-1 rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200">
                          <option value="medewerker">Medewerker</option>
                          <option value="leidinggevende">Leidinggevende</option>
                          <option value="beheerder">Beheerder</option>
                        </select>
                      </div>
                      <button className="rounded-md bg-ink-900 px-3 py-2 text-xs font-semibold text-white hover:bg-ink-800">
                        Toegang geven
                      </button>
                    </form>
                  ) : (
                    <p className="text-xs text-warm">
                      Geen e-mailadres bekend. Vul bij deze medewerker een e-mailadres in om toegang te kunnen geven.
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div>
          <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <h2 className="font-display text-lg font-extrabold text-ink-900">Medewerker toevoegen</h2>
            <p className="mt-1 text-xs text-warm">
              Vul een e-mailadres in om de medewerker meteen toegang te geven. Zonder e-mail wordt alleen de
              medewerker vastgelegd.
            </p>
            <form action={nieuwTeamlid} className="mt-4">
              <label className="block text-sm font-semibold text-ink-900">Naam</label>
              <input name="naam" required placeholder="Naam" className={veld} />
              <label className="mt-3 block text-sm font-semibold text-ink-900">E-mail (voor login)</label>
              <input name="email" type="email" placeholder="naam@bedrijf.nl" className={veld} />
              <label className="mt-3 block text-sm font-semibold text-ink-900">Functie (optioneel)</label>
              <input name="functie" placeholder="bijv. monteur" className={veld} />
              <label className="mt-3 block text-sm font-semibold text-ink-900">Rol</label>
              <select name="rol" defaultValue="medewerker" className={veld}>
                <option value="medewerker">Medewerker</option>
                <option value="leidinggevende">Leidinggevende</option>
              </select>
              <label className="mt-3 block text-sm font-semibold text-ink-900">Jaarbudget (optioneel)</label>
              <input name="budget" inputMode="decimal" placeholder="bijv. 250" className={veld} />
              <button className="btn-primary mt-4 w-full justify-center">Toevoegen</button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
