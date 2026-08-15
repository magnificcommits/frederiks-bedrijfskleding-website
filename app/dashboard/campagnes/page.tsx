import Link from 'next/link';
import { redirect } from 'next/navigation';
import Drawer from '@/components/dashboard/Drawer';
import { kmsAdmin, dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { listCampagnes, CAMPAGNE_TYPES } from '@/lib/kms/campagnes';
import EmptyState from '@/components/dashboard/EmptyState';
import { nieuweCampagneActie } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Campagnes', robots: { index: false, follow: false } };

const inputCls = 'veld';

const statusBadge: Record<string, string> = {
  concept: 'bg-ink-100 text-ink-600',
  actief: 'bg-green-100 text-green-800',
  gepauzeerd: 'bg-amber-100 text-amber-800',
  afgerond: 'bg-ink-100 text-ink-600',
};

const typeLabel: Record<string, string> = {
  cold: 'Koude acquisitie',
  nurture: 'Nurture',
  reengage: 'Heractivatie',
};

export default async function CampagnesPage() {
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

  const campagnes = await listCampagnes();

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <h1 className="dash-h1">Campagnes</h1>
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="knop-tekst">Terug naar dashboard</Link>
          <Drawer
            knop="Nieuwe campagne"
            titel="Nieuwe campagne"
            beschrijving="Geef de campagne een naam en kies een type. Stappen voeg je daarna toe."
            >
            <form action={nieuweCampagneActie} className="mt-4 flex flex-col gap-3">
                <div>
                  <label className="veld-label">Naam</label>
                  <input name="naam" required placeholder="Bijv. Koude acquisitie metaalbranche" className={inputCls} />
                </div>
                <div>
                  <label className="veld-label">Type</label>
                  <select name="type" className={inputCls} defaultValue="cold">
                    {CAMPAGNE_TYPES.map((t) => <option key={t} value={t}>{typeLabel[t] ?? t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="veld-label">Afzender naam</label>
                  <input name="van_naam" placeholder="Naam afzender" className={inputCls} />
                </div>
                <div>
                  <label className="veld-label">Afzender e-mail</label>
                  <input name="van_email" type="email" placeholder="afzender@frederiks.nl" className={inputCls} />
                </div>
                <button type="submit" className="self-start knop-donker">Campagne aanmaken</button>
            </form>
          </Drawer>
        </div>
      </div>
      <p className="mt-2 text-sm text-warm">E-mailcampagnes met stappen. Klik op een naam om de stappen te beheren en prospecten in te schrijven.</p>

        {campagnes.length === 0 ? (
          <EmptyState tekst="Nog geen campagnes. Maak er rechtsboven een aan." />
        ) : (
          <div className="panel overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Naam</th>
                  <th className="hidden sm:table-cell">Type</th>
                  <th>Status</th>
                  <th className="text-right">Inschrijvingen</th>
                  <th className="text-right">Verzonden</th>
                </tr>
              </thead>
              <tbody>
                {campagnes.map((c) => (
                  <tr key={c.id} className="border-b border-line">
                    <td>
                      <Link href={`/dashboard/campagnes/${c.id}`} className="font-semibold text-amber-700 hover:text-amber-800">{c.naam}</Link>
                    </td>
                    <td className="hidden text-warm sm:table-cell">{typeLabel[c.type] ?? c.type}</td>
                    <td>
                      <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge[c.status] ?? 'bg-ink-100 text-ink-600'}`}>{c.status}</span>
                    </td>
                    <td className="text-right text-ink-900">{c.aantalInschrijvingen}</td>
                    <td className="text-right text-ink-900">{c.aantalVerzonden}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </main>
  );
}
