import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import {
  kerncijfers,
  omzetPerKlant,
  omzetPerMerk,
  budgetPerMedewerker,
  verstrekkingenPerMedewerker,
} from '@/lib/kms/rapportages';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Rapportages', robots: { index: false, follow: false } };

const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n || 0);

export default async function RapportagesPage() {
  if (!(await dashAuthed())) redirect('/dashboard');
  const sb = kmsAdmin();

  if (!sb) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Leaddatabase nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen en draai de migraties in <code>supabase/migrations</code>.</p>
          <Link href="/dashboard" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
        </div>
      </main>
    );
  }

  const [cijfers, perKlant, perMerk, budget, verstrekkingen] = await Promise.all([
    kerncijfers(),
    omzetPerKlant(),
    omzetPerMerk(),
    budgetPerMedewerker(),
    verstrekkingenPerMedewerker(),
  ]);

  const kpis = [
    { label: 'Open offertes', waarde: String(cijfers?.openOffertes ?? 0) },
    { label: 'Open offertewaarde', waarde: euro(cijfers?.openOffertewaarde ?? 0) },
    { label: 'Open orders', waarde: String(cijfers?.openOrders ?? 0) },
    { label: 'Omzet dit jaar', waarde: euro(cijfers?.omzetDitJaar ?? 0) },
  ];

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Rapportages</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
      </div>
      <p className="mt-2 text-sm text-warm">Cijfers over omzet, merken, budget en verstrekkingen. Live berekend uit orders en facturen.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-line bg-white p-5 shadow-soft">
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
          <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-warm">
                <tr>
                  <th className="px-4 py-3">Klant</th>
                  <th className="px-4 py-3 text-right">Omzet</th>
                </tr>
              </thead>
              <tbody>
                {perKlant.map((r) => (
                  <tr key={r.naam} className="border-b border-line">
                    <td className="px-4 py-3 font-semibold text-ink-900">{r.naam}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-ink-900">{euro(r.bedrag)}</td>
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
          <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-warm">
                <tr>
                  <th className="px-4 py-3">Merk</th>
                  <th className="px-4 py-3 text-right">Omzet</th>
                </tr>
              </thead>
              <tbody>
                {perMerk.map((r) => (
                  <tr key={r.merk} className="border-b border-line">
                    <td className="px-4 py-3 font-semibold text-ink-900">{r.merk}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-ink-900">{euro(r.bedrag)}</td>
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
          <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-warm">
                <tr>
                  <th className="px-4 py-3">Medewerker</th>
                  <th className="px-4 py-3">Klant</th>
                  <th className="px-4 py-3 text-right">Budget</th>
                  <th className="px-4 py-3 text-right">Verbruik</th>
                  <th className="px-4 py-3 text-right">Percentage</th>
                </tr>
              </thead>
              <tbody>
                {budget.map((m) => (
                  <tr key={m.id} className="border-b border-line">
                    <td className="px-4 py-3 font-semibold text-ink-900">{m.naam}</td>
                    <td className="px-4 py-3 text-warm">{m.organisatie_naam || '-'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-warm">{m.budget > 0 ? euro(m.budget) : '-'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-warm">{euro(m.verbruik)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
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
          <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-warm">
                <tr>
                  <th className="px-4 py-3">Medewerker</th>
                  <th className="px-4 py-3">Klant</th>
                  <th className="px-4 py-3 text-right">Aantal stuks</th>
                </tr>
              </thead>
              <tbody>
                {verstrekkingen.map((m) => (
                  <tr key={m.id} className="border-b border-line">
                    <td className="px-4 py-3 font-semibold text-ink-900">{m.naam}</td>
                    <td className="px-4 py-3 text-warm">{m.organisatie_naam || '-'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-ink-900">{m.aantal}</td>
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
