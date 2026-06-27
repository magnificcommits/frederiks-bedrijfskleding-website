import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { listCampagnes, CAMPAGNE_TYPES } from '@/lib/kms/campagnes';
import EmptyState from '@/components/dashboard/EmptyState';
import { nieuweCampagneActie } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Campagnes', robots: { index: false, follow: false } };

const inputCls = 'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';

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

  const campagnes = await listCampagnes();

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Campagnes</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
      </div>
      <p className="mt-2 text-sm text-warm">E-mailcampagnes met stappen. Klik op een naam om de stappen te beheren en prospecten in te schrijven.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {campagnes.length === 0 ? (
            <EmptyState tekst="Nog geen campagnes. Maak er rechts een aan." />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-warm">
                  <tr>
                    <th className="px-4 py-3">Naam</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Inschrijvingen</th>
                    <th className="px-4 py-3 text-right">Verzonden</th>
                  </tr>
                </thead>
                <tbody>
                  {campagnes.map((c) => (
                    <tr key={c.id} className="border-b border-line">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/campagnes/${c.id}`} className="font-semibold text-amber-700 hover:text-amber-800">{c.naam}</Link>
                      </td>
                      <td className="px-4 py-3 hidden text-warm sm:table-cell">{typeLabel[c.type] ?? c.type}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge[c.status] ?? 'bg-ink-100 text-ink-600'}`}>{c.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-ink-900">{c.aantalInschrijvingen}</td>
                      <td className="px-4 py-3 text-right text-ink-900">{c.aantalVerzonden}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="font-display text-lg font-bold text-ink-900">Nieuwe campagne</h2>
          <p className="mt-1 text-xs text-warm">Geef de campagne een naam en kies een type. Stappen voeg je daarna toe.</p>
          <form action={nieuweCampagneActie} className="mt-4 flex flex-col gap-3">
            <div>
              <label className="block text-xs font-semibold text-warm">Naam</label>
              <input name="naam" required placeholder="Bijv. Koude acquisitie metaalbranche" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-warm">Type</label>
              <select name="type" className={inputCls} defaultValue="cold">
                {CAMPAGNE_TYPES.map((t) => <option key={t} value={t}>{typeLabel[t] ?? t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-warm">Afzender naam</label>
              <input name="van_naam" placeholder="Naam afzender" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-warm">Afzender e-mail</label>
              <input name="van_email" type="email" placeholder="afzender@frederiks.nl" className={inputCls} />
            </div>
            <button type="submit" className="self-start rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Campagne aanmaken</button>
          </form>
        </div>
      </div>
    </main>
  );
}
