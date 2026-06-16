import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { listLeveranciers } from '@/lib/kms/producten';
import { nieuweLeverancier } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Leveranciers', robots: { index: false, follow: false } };

const inputCls = 'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';

export default async function LeveranciersPage() {
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

  const leveranciers = await listLeveranciers();

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Leveranciers</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
      </div>
      <p className="mt-2 text-sm text-warm">De leveranciers die je aan producten koppelt.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {leveranciers.length === 0 ? (
            <p className="rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen leveranciers. Voeg er rechts een toe.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-warm">
                  <tr>
                    <th className="px-4 py-3">Naam</th>
                    <th className="px-4 py-3">Contactpersoon</th>
                    <th className="px-4 py-3">Telefoon</th>
                    <th className="px-4 py-3">E-mail</th>
                    <th className="px-4 py-3">Levertijd</th>
                    <th className="px-4 py-3">Merken</th>
                  </tr>
                </thead>
                <tbody>
                  {leveranciers.map((l) => (
                    <tr key={l.id} className="border-b border-line align-top">
                      <td className="px-4 py-3 font-semibold text-ink-900">{l.naam}</td>
                      <td className="px-4 py-3 text-warm">{l.contactpersoon || '-'}</td>
                      <td className="px-4 py-3 text-warm">{l.telefoon || '-'}</td>
                      <td className="px-4 py-3 text-warm">{l.email || '-'}</td>
                      <td className="px-4 py-3 text-warm">{l.levertijd_dagen != null ? `${l.levertijd_dagen} dgn` : '-'}</td>
                      <td className="px-4 py-3 text-warm">{(l.merken && l.merken.length > 0) ? l.merken.join(', ') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="font-display text-lg font-bold text-ink-900">Nieuwe leverancier</h2>
          <form action={nieuweLeverancier} className="mt-4 flex flex-col gap-3">
            <div>
              <label className="block text-xs font-semibold text-warm">Naam</label>
              <input name="naam" required placeholder="Bedrijfsnaam" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-warm">Contactpersoon</label>
              <input name="contactpersoon" placeholder="Voor- en achternaam" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-warm">Telefoon</label>
              <input name="telefoon" placeholder="06 12 34 56 78" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-warm">E-mail</label>
              <input name="email" type="email" placeholder="naam@leverancier.nl" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-warm">Levertijd (dagen)</label>
              <input name="levertijd_dagen" inputMode="numeric" placeholder="bijv. 5" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-warm">Betaalcondities</label>
              <input name="betaalcondities" placeholder="bijv. 30 dagen netto" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-warm">Merken (komma-gescheiden)</label>
              <input name="merken" placeholder="Merk A, Merk B" className={inputCls} />
            </div>
            <button type="submit" className="self-start rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Leverancier aanmaken</button>
          </form>
        </div>
      </div>
    </main>
  );
}
