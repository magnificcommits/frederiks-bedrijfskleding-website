import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { isPortalConfigured } from '@/lib/env';
import { getPortaalUser, getMijnOrganisatie, getKledinglijn, getMatenMap, getVerbruik } from '@/lib/portaal/queries';
import { getMijnToegang, listTeam, type PortaalRol } from '@/lib/portaal/team';
import { formatEuro } from '@/lib/format';
import ConfirmSubmit from '@/components/ConfirmSubmit';
import PortaalNav from '../PortaalNav';
import MedewerkersLijst, { type MedewerkerRij } from './MedewerkersLijst';
import {
  nieuweMedewerker,
  verwijderMedewerkerAction,
  bewaarMaten,
  bewaarBudget,
  geefToegangAction,
  wijzigRolAction,
  trekToegangInAction,
} from './actions';

export const metadata: Metadata = { title: 'Medewerkers', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const veld =
  'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';
const selectMini =
  'mt-1 rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';

const rolLabel: Record<PortaalRol, string> = {
  beheerder: 'Beheerder',
  leidinggevende: 'Leidinggevende',
  medewerker: 'Medewerker',
};

const meldingen: Record<string, { soort: 'ok' | 'fout'; tekst: string }> = {
  toegevoegd: { soort: 'ok', tekst: 'De medewerker is toegevoegd.' },
  verwijderd: { soort: 'ok', tekst: 'De medewerker is verwijderd.' },
  budget: { soort: 'ok', tekst: 'Het budget is opgeslagen.' },
  maten: { soort: 'ok', tekst: 'De maten zijn opgeslagen.' },
  toegang: { soort: 'ok', tekst: 'De toegang is aangemaakt.' },
  rol: { soort: 'ok', tekst: 'De rol is gewijzigd.' },
  ingetrokken: { soort: 'ok', tekst: 'De toegang is ingetrokken.' },
  naam: { soort: 'fout', tekst: 'Vul minimaal een naam in.' },
  email: { soort: 'fout', tekst: 'Voor toegang is een e-mailadres nodig.' },
  opslaan: { soort: 'fout', tekst: 'Er ging iets mis bij het opslaan. Probeer het opnieuw.' },
};

export default async function Medewerkers({
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
  const magBeheren = toegang.rol === 'beheerder' || toegang.rol === 'leidinggevende';
  const magToegang = toegang.rol === 'beheerder';
  if (!magBeheren) {
    return (
      <main className="container-x py-12">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">Klantportaal</p>
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Medewerkers</h1>
        <PortaalNav rol={toegang.rol} actief="/portaal/medewerkers" />
        <div className="mt-8 max-w-xl rounded-2xl border border-line bg-white p-6 shadow-soft">
          <p className="text-sm text-warm">Alleen een beheerder of leidinggevende kan medewerkers beheren.</p>
          <Link href="/portaal" className="mt-4 inline-block text-sm font-semibold text-warm hover:text-ink-800">
            Terug naar het overzicht
          </Link>
        </div>
      </main>
    );
  }

  const sp = await searchParams;
  const melding = sp?.ok ? meldingen[sp.ok] : sp?.fout ? meldingen[sp.fout] : null;

  const [team, items, verbruik] = await Promise.all([listTeam(), getKledinglijn(), getVerbruik()]);
  const matenPer: Record<string, Record<string, string>> = Object.fromEntries(
    await Promise.all(team.map(async (m) => [m.medewerkerId, await getMatenMap(m.medewerkerId)] as const)),
  );

  const rijen: MedewerkerRij[] = team.map((m) => {
    const v = verbruik[m.medewerkerId] ?? 0;
    const restant = m.budget != null ? Number(m.budget) - v : null;
    const budgetRestantLabel = restant != null ? `Restant ${formatEuro(restant, 0)}` : '';
    const loginLabel = m.toegang
      ? `Kan inloggen — ${rolLabel[m.toegang.rol] ?? m.toegang.rol}`
      : 'Geen login';

    const detail = (
      <>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {magToegang && (
            <Link
              href={`/portaal/team/${m.medewerkerId}`}
              className="inline-block rounded-md border border-line bg-white px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-mist"
            >
              Instellingen
            </Link>
          )}
          <form action={verwijderMedewerkerAction}>
            <input type="hidden" name="id" value={m.medewerkerId} />
            <ConfirmSubmit
              message={`Weet je zeker dat je ${m.naam} wilt verwijderen? Maten en budget gaan verloren.`}
              className="py-1 text-xs font-semibold text-warm hover:text-amber-700"
            >
              Verwijderen
            </ConfirmSubmit>
          </form>
        </div>

        {/* Budget */}
        <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-line pt-4">
          <form action={bewaarBudget} className="flex items-end gap-2">
            <input type="hidden" name="medewerker_id" value={m.medewerkerId} />
            <div>
              <label className="block text-xs font-semibold text-warm">Jaarbudget</label>
              <input
                name="budget"
                defaultValue={m.budget ?? ''}
                inputMode="decimal"
                placeholder="bijv. 250"
                className="mt-1 w-28 rounded-md border border-line bg-white px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </div>
            <button className="rounded-md border border-line bg-white px-2.5 py-2 text-xs font-semibold text-ink-700 hover:bg-mist">
              Opslaan
            </button>
          </form>
          <div className="py-1 text-sm">
            <p className="text-warm">
              Verbruikt: <span className="font-semibold text-ink-900">{formatEuro(v, 0)}</span>
            </p>
            {restant != null && (
              <p className={`font-semibold ${restant < 0 ? 'text-amber-700' : 'text-ink-700'}`}>
                Restant: {formatEuro(restant, 0)}
              </p>
            )}
          </div>
        </div>

        {/* Maten */}
        {items.length > 0 && (
          <form action={bewaarMaten} className="mt-4 border-t border-line pt-4">
            <input type="hidden" name="medewerker_id" value={m.medewerkerId} />
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-warm">Maten</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((it) => (
                <div key={it.id}>
                  <label className="block text-xs font-semibold text-warm">{it.naam}</label>
                  <input
                    name={`maat_${it.id}`}
                    defaultValue={matenPer[m.medewerkerId]?.[it.id] ?? ''}
                    placeholder="maat"
                    className={veld}
                  />
                </div>
              ))}
            </div>
            <button className="mt-3 rounded-md bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-800">
              Maten opslaan
            </button>
          </form>
        )}

        {/* Toegang — alleen voor de beheerder */}
        {magToegang && (
          <div className="mt-4 border-t border-line pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-warm">Toegang tot het portaal</p>
            {m.toegang ? (
              <div className="flex flex-wrap items-end gap-3">
                <form action={wijzigRolAction} className="flex items-end gap-2">
                  <input type="hidden" name="email" value={m.toegang.email} />
                  <div>
                    <label className="block text-xs font-semibold text-warm">Rol</label>
                    <select name="rol" defaultValue={m.toegang.rol} className={selectMini}>
                      <option value="medewerker">Medewerker</option>
                      <option value="leidinggevende">Leidinggevende</option>
                      <option value="beheerder">Beheerder</option>
                    </select>
                  </div>
                  <button className="rounded-md border border-line bg-white px-2.5 py-2 text-xs font-semibold text-ink-700 hover:bg-mist">
                    Rol opslaan
                  </button>
                </form>
                <form action={trekToegangInAction}>
                  <input type="hidden" name="email" value={m.toegang.email} />
                  <ConfirmSubmit
                    message={`Toegang van ${m.naam} intrekken? De persoon en maten blijven bestaan, maar inloggen kan niet meer.`}
                    className="py-2 text-xs font-semibold text-warm hover:text-amber-700"
                  >
                    Toegang intrekken
                  </ConfirmSubmit>
                </form>
              </div>
            ) : m.email ? (
              <form action={geefToegangAction} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="medewerker_id" value={m.medewerkerId} />
                <input type="hidden" name="naam" value={m.naam} />
                <input type="hidden" name="email" value={m.email} />
                <div>
                  <label className="block text-xs font-semibold text-warm">Geef toegang als</label>
                  <select name="rol" defaultValue="medewerker" className={selectMini}>
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
                Geen e-mailadres bekend. Vul bij deze medewerker een e-mailadres in (via Instellingen) om
                toegang te kunnen geven.
              </p>
            )}
          </div>
        )}
      </>
    );

    return {
      id: m.medewerkerId,
      naam: m.naam,
      functie: m.functie ?? '',
      loginLabel,
      heeftLogin: Boolean(m.toegang),
      budgetRestantLabel,
      detail,
    };
  });

  return (
    <main className="container-x py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">Klantportaal</p>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">Medewerkers</h1>
        </div>
      </div>
      <PortaalNav rol={toegang.rol} actief="/portaal/medewerkers" />

      <p className="mt-6 max-w-2xl text-sm text-warm">
        Eén overzicht van alle personen in je bedrijf: hun maten, een eventueel kledingbudget en of ze kunnen
        inloggen in het portaal. Bij een herbestelling kies je een medewerker en zijn de maten al ingevuld.
        {magToegang
          ? ' Als beheerder geef je hier ook logins en rollen uit.'
          : ' Logins en rollen kan alleen een beheerder instellen.'}
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
        <div className="lg:col-span-2">
          <MedewerkersLijst rijen={rijen} />
        </div>

        <div>
          <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <h2 className="font-display text-lg font-extrabold text-ink-900">Medewerker toevoegen</h2>
            <p className="mt-1 text-xs text-warm">
              {magToegang
                ? 'Vul een e-mailadres in om de medewerker meteen te laten inloggen. Zonder e-mail leg je alleen de persoon vast.'
                : 'Leg de persoon, functie en een eventueel budget vast. Een login geven kan alleen de beheerder.'}
            </p>
            <form action={nieuweMedewerker} className="mt-4">
              <label className="block text-sm font-semibold text-ink-900">Naam</label>
              <input name="naam" required placeholder="Naam" className={veld} />
              <label className="mt-3 block text-sm font-semibold text-ink-900">Functie (optioneel)</label>
              <input name="functie" placeholder="bijv. monteur" className={veld} />
              <label className="mt-3 block text-sm font-semibold text-ink-900">Jaarbudget (optioneel)</label>
              <input name="budget" inputMode="decimal" placeholder="bijv. 250" className={veld} />
              {magToegang && (
                <>
                  <label className="mt-3 block text-sm font-semibold text-ink-900">E-mail (voor login, optioneel)</label>
                  <input name="email" type="email" placeholder="naam@bedrijf.nl" className={veld} />
                  <label className="mt-3 block text-sm font-semibold text-ink-900">Rol bij login</label>
                  <select name="rol" defaultValue="medewerker" className={veld}>
                    <option value="medewerker">Medewerker</option>
                    <option value="leidinggevende">Leidinggevende</option>
                    <option value="beheerder">Beheerder</option>
                  </select>
                </>
              )}
              <button className="btn-primary mt-4 w-full justify-center">Toevoegen</button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
