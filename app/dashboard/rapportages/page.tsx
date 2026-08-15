import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import {
  kerncijfers,
  omzetPerKlant,
  omzetPerMerk,
  budgetPerMedewerker,
  verstrekkingenPerMedewerker,
  verbruikPerVestiging,
  verbruikPerAfdeling,
  verbruikPerFunctiegroep,
  kledingInBezitPerMedewerker,
  budgetmutatieHistorie,
} from '@/lib/kms/rapportages';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Rapportages', robots: { index: false, follow: false } };

const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n || 0);
const datumKort = (d: string | null) =>
  d ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d)) : '-';

export default async function RapportagesPage() {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const sb = kmsAdmin();

  if (!sb) {
    return (
      <main className="container-smal py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="dash-h1">Leaddatabase nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen en draai de migraties in <code>supabase/migrations</code>.</p>
          <Link href="/dashboard" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
        </div>
      </main>
    );
  }

  const [
    cijfers,
    perKlant,
    perMerk,
    budget,
    verstrekkingen,
    perVestiging,
    perAfdeling,
    perFunctie,
    inBezit,
    mutaties,
  ] = await Promise.all([
    kerncijfers(),
    omzetPerKlant(),
    omzetPerMerk(),
    budgetPerMedewerker(),
    verstrekkingenPerMedewerker(),
    verbruikPerVestiging(),
    verbruikPerAfdeling(),
    verbruikPerFunctiegroep(),
    kledingInBezitPerMedewerker(),
    budgetmutatieHistorie(),
  ]);

  const kpis = [
    { label: 'Open offertes', waarde: String(cijfers?.openOffertes ?? 0) },
    { label: 'Open offertewaarde', waarde: euro(cijfers?.openOffertewaarde ?? 0) },
    { label: 'Open orders', waarde: String(cijfers?.openOrders ?? 0) },
    { label: 'Omzet dit jaar', waarde: euro(cijfers?.omzetDitJaar ?? 0) },
  ];

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <h1 className="dash-h1">Rapportages</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
      </div>
      <p className="mt-2 text-sm text-warm">Cijfers over omzet, merken, budget, verstrekkingen en verbruik per vestiging, afdeling en functiegroep. Live berekend uit orders en facturen.</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-semibold text-warm">Exporteren naar Excel:</span>
        <a href="/dashboard/rapportages/export?rapport=omzet-klant" className="font-semibold text-amber-700 hover:text-amber-800">Omzet per klant</a>
        <a href="/dashboard/rapportages/export?rapport=omzet-merk" className="font-semibold text-amber-700 hover:text-amber-800">Omzet per merk</a>
        <a href="/dashboard/rapportages/export?rapport=budget-medewerker" className="font-semibold text-amber-700 hover:text-amber-800">Budget per medewerker</a>
        <a href="/dashboard/rapportages/export?rapport=verstrekkingen" className="font-semibold text-amber-700 hover:text-amber-800">Verstrekkingen</a>
        <a href="/dashboard/rapportages/export?rapport=verbruik-vestiging" className="font-semibold text-amber-700 hover:text-amber-800">Verbruik per vestiging</a>
        <a href="/dashboard/rapportages/export?rapport=verbruik-afdeling" className="font-semibold text-amber-700 hover:text-amber-800">Verbruik per afdeling</a>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="panel p-4">
            <p className="text-xs uppercase tracking-wide text-warm">{k.label}</p>
            <p className="mt-1 font-display text-2xl font-extrabold text-ink-900">{k.waarde}</p>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="font-display text-xl font-bold text-ink-900">Omzet per klant</h2>
        <p className="mt-1 text-sm text-warm">Som van betaalde facturen per organisatie.</p>
        {perKlant.length === 0 ? (
          <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen betaalde facturen.</p>
        ) : (
          <div className="mt-4 overflow-x-auto panel">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Klant</th>
                  <th className="text-right">Omzet</th>
                </tr>
              </thead>
              <tbody>
                {perKlant.map((r) => (
                  <tr key={r.naam} className="border-b border-line">
                    <td className="font-semibold text-ink-900">{r.naam}</td>
                    <td className="whitespace-nowrap text-right text-ink-900">{euro(r.bedrag)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-bold text-ink-900">Omzet per merk</h2>
        <p className="mt-1 text-sm text-warm">Uit orderregels van orders die geen concept zijn.</p>
        {perMerk.length === 0 ? (
          <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen orderregels om te tonen.</p>
        ) : (
          <div className="mt-4 overflow-x-auto panel">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Merk</th>
                  <th className="text-right">Omzet</th>
                </tr>
              </thead>
              <tbody>
                {perMerk.map((r) => (
                  <tr key={r.merk} className="border-b border-line">
                    <td className="font-semibold text-ink-900">{r.merk}</td>
                    <td className="whitespace-nowrap text-right text-ink-900">{euro(r.bedrag)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-bold text-ink-900">Budgetverbruik per medewerker</h2>
        <p className="mt-1 text-sm text-warm">Verbruik is de som van orderbedragen per medewerker.</p>
        {budget.length === 0 ? (
          <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen medewerkers met budget.</p>
        ) : (
          <div className="mt-4 overflow-x-auto panel">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Medewerker</th>
                  <th>Klant</th>
                  <th className="text-right">Budget</th>
                  <th className="text-right">Verbruik</th>
                  <th className="text-right">Percentage</th>
                </tr>
              </thead>
              <tbody>
                {budget.map((m) => (
                  <tr key={m.id} className="border-b border-line">
                    <td className="font-semibold text-ink-900">{m.naam}</td>
                    <td className="text-warm">{m.organisatie_naam || '-'}</td>
                    <td className="whitespace-nowrap text-right text-warm">{m.budget > 0 ? euro(m.budget) : '-'}</td>
                    <td className="whitespace-nowrap text-right text-warm">{euro(m.verbruik)}</td>
                    <td className="whitespace-nowrap text-right">
                      {m.budget > 0 ? (
                        <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${m.percentage >= 100 ? 'bg-amber-100 text-amber-800' : m.percentage >= 80 ? 'bg-amber-50 text-amber-700' : 'bg-green-100 text-green-800'}`}>{m.percentage}%</span>
                      ) : (
                        <span className="text-xs text-warm">geen budget</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-bold text-ink-900">Verstrekkingen per medewerker</h2>
        <p className="mt-1 text-sm text-warm">Totaal aantal verstrekte stuks uit alle orderregels van de medewerker.</p>
        {verstrekkingen.length === 0 ? (
          <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen verstrekkingen geregistreerd.</p>
        ) : (
          <div className="mt-4 overflow-x-auto panel">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Medewerker</th>
                  <th>Klant</th>
                  <th className="text-right">Aantal stuks</th>
                </tr>
              </thead>
              <tbody>
                {verstrekkingen.map((m) => (
                  <tr key={m.id} className="border-b border-line">
                    <td className="font-semibold text-ink-900">{m.naam}</td>
                    <td className="text-warm">{m.organisatie_naam || '-'}</td>
                    <td className="whitespace-nowrap text-right text-ink-900">{m.aantal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-bold text-ink-900">Verbruik per vestiging</h2>
        <p className="mt-1 text-sm text-warm">Som van orderbedragen per vestiging. Orders zonder vestiging staan apart.</p>
        {perVestiging.length === 0 ? (
          <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen orders om te tonen.</p>
        ) : (
          <div className="mt-4 overflow-x-auto panel">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Vestiging</th>
                  <th className="text-right">Aantal orders</th>
                  <th className="text-right">Verbruik</th>
                </tr>
              </thead>
              <tbody>
                {perVestiging.map((r) => (
                  <tr key={r.naam} className="border-b border-line">
                    <td className="font-semibold text-ink-900">{r.naam}</td>
                    <td className="whitespace-nowrap text-right text-warm">{r.aantalOrders}</td>
                    <td className="whitespace-nowrap text-right text-ink-900">{euro(r.bedrag)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-bold text-ink-900">Verbruik per afdeling</h2>
        <p className="mt-1 text-sm text-warm">Som van orderbedragen per afdeling. Orders zonder afdeling staan apart.</p>
        {perAfdeling.length === 0 ? (
          <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen orders om te tonen.</p>
        ) : (
          <div className="mt-4 overflow-x-auto panel">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Afdeling</th>
                  <th className="text-right">Aantal orders</th>
                  <th className="text-right">Verbruik</th>
                </tr>
              </thead>
              <tbody>
                {perAfdeling.map((r) => (
                  <tr key={r.naam} className="border-b border-line">
                    <td className="font-semibold text-ink-900">{r.naam}</td>
                    <td className="whitespace-nowrap text-right text-warm">{r.aantalOrders}</td>
                    <td className="whitespace-nowrap text-right text-ink-900">{euro(r.bedrag)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-bold text-ink-900">Verbruik per functiegroep</h2>
        <p className="mt-1 text-sm text-warm">Orderbedragen gekoppeld aan de functie(s) van de medewerker. Een order telt mee bij elke functie van die medewerker; medewerkers zonder functie staan apart.</p>
        {perFunctie.length === 0 ? (
          <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen orders om te tonen.</p>
        ) : (
          <div className="mt-4 overflow-x-auto panel">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Functiegroep</th>
                  <th className="text-right">Aantal orders</th>
                  <th className="text-right">Verbruik</th>
                </tr>
              </thead>
              <tbody>
                {perFunctie.map((r) => (
                  <tr key={r.naam} className="border-b border-line">
                    <td className="font-semibold text-ink-900">{r.naam}</td>
                    <td className="whitespace-nowrap text-right text-warm">{r.aantalOrders}</td>
                    <td className="whitespace-nowrap text-right text-ink-900">{euro(r.bedrag)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-bold text-ink-900">Kleding in bezit per medewerker</h2>
        <p className="mt-1 text-sm text-warm">Aantal geleverde stuks uit orders met status compleet geleverd of afgerond. Handig bij uitdiensttreding.</p>
        {inBezit.length === 0 ? (
          <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen geleverde verstrekkingen.</p>
        ) : (
          <div className="mt-4 overflow-x-auto panel">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Medewerker</th>
                  <th>Klant</th>
                  <th className="text-right">Stuks in bezit</th>
                </tr>
              </thead>
              <tbody>
                {inBezit.map((m) => (
                  <tr key={m.id} className="border-b border-line">
                    <td className="font-semibold text-ink-900">{m.naam}</td>
                    <td className="text-warm">{m.organisatie_naam || '-'}</td>
                    <td className="whitespace-nowrap text-right text-ink-900">{m.aantal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-bold text-ink-900">Budgetmutaties</h2>
        <p className="mt-1 text-sm text-warm">Alle budgetmutaties, nieuwste eerst, met saldo na de mutatie.</p>
        {mutaties.length === 0 ? (
          <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen budgetmutaties geregistreerd.</p>
        ) : (
          <div className="mt-4 overflow-x-auto panel">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Medewerker</th>
                  <th>Soort</th>
                  <th>Omschrijving</th>
                  <th className="text-right">Bedrag</th>
                  <th className="text-right">Saldo na</th>
                </tr>
              </thead>
              <tbody>
                {mutaties.map((m) => (
                  <tr key={m.id} className="border-b border-line">
                    <td className="whitespace-nowrap text-warm">{datumKort(m.datum)}</td>
                    <td className="font-semibold text-ink-900">{m.medewerker_naam}</td>
                    <td className="text-warm">{m.soort}</td>
                    <td className="text-warm">{m.omschrijving || '-'}</td>
                    <td className={`whitespace-nowrap px-4 py-3 text-right ${m.bedrag < 0 ? 'text-amber-700' : 'text-ink-900'}`}>{euro(m.bedrag)}</td>
                    <td className="whitespace-nowrap text-right text-ink-900">{euro(m.saldo_na)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
