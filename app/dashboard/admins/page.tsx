import type { Metadata } from 'next';
import { dashAuthed, getHuidigeAdmin } from '@/lib/kms/adminClient';
import { listAdmins } from '@/lib/kms/adminGebruikers';
import { adminToevoegen, adminActiefZetten, adminRolWijzigen } from './actions';

export const metadata: Metadata = { title: 'Beheerders', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

type SP = { fout?: string };

const rolLabel: Record<string, string> = {
  eigenaar: 'Eigenaar',
  medewerker: 'Medewerker',
  lezer: 'Lezer',
};

export default async function AdminsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const authed = await dashAuthed();
  if (!authed) {
    return (
      <main className="container-x py-12">
        <p className="text-sm text-warm">Log in om deze pagina te bekijken.</p>
      </main>
    );
  }

  const huidige = await getHuidigeAdmin();
  // Wachtwoord-login zonder admin-account telt als eigenaar.
  const isEigenaar = !huidige || huidige.rol === 'eigenaar';
  if (!isEigenaar) {
    return (
      <main className="container-x py-12">
        <h1 className="font-display text-2xl font-extrabold text-ink-900">Beheerders</h1>
        <p className="mt-3 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">Geen toegang. Alleen een eigenaar kan beheerders aanpassen.</p>
      </main>
    );
  }

  const admins = await listAdmins();

  return (
    <main className="container-x py-8">
      <h1 className="font-display text-2xl font-extrabold text-ink-900">Beheerders</h1>
      <p className="mt-0.5 text-sm text-warm">Wie kan inloggen met een eigen account, en met welke rechten.</p>

      {sp?.fout === 'toegang' && (
        <p className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">Geen toegang voor die actie.</p>
      )}
      {sp?.fout === 'opslaan' && (
        <p className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">Opslaan mislukt. Bestaat dit e-mailadres al?</p>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-line bg-white p-4 shadow-soft">
          <h2 className="font-display text-base font-bold text-ink-900">Beheerders</h2>
          {admins.length === 0 ? (
            <p className="mt-2 text-sm text-warm">Nog geen beheerders.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-400">
                    <th className="py-2 pr-3">E-mail</th>
                    <th className="py-2 pr-3">Naam</th>
                    <th className="py-2 pr-3">Rol</th>
                    <th className="py-2 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {admins.map((a) => (
                    <tr key={a.id} className="align-middle">
                      <td className="py-2 pr-3 font-medium text-ink-900">{a.email}</td>
                      <td className="py-2 pr-3 text-ink-700">{a.naam ?? '—'}</td>
                      <td className="py-2 pr-3">
                        <form action={adminRolWijzigen} className="flex items-center gap-2">
                          <input type="hidden" name="id" value={a.id} />
                          <select name="rol" defaultValue={a.rol} className="rounded-md border border-line bg-white px-2 py-1 text-sm">
                            <option value="eigenaar">Eigenaar</option>
                            <option value="medewerker">Medewerker</option>
                            <option value="lezer">Lezer</option>
                          </select>
                          <button type="submit" className="rounded-md border border-line px-2 py-1 text-xs font-semibold text-ink-700 hover:bg-mist">Opslaan</button>
                        </form>
                      </td>
                      <td className="py-2 pr-3">
                        <form action={adminActiefZetten} className="flex items-center gap-2">
                          <input type="hidden" name="id" value={a.id} />
                          <input type="hidden" name="actief" value={a.actief ? 'false' : 'true'} />
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${a.actief ? 'bg-green-100 text-green-800' : 'bg-ink-100 text-ink-500'}`}>
                            {a.actief ? 'Actief' : 'Inactief'}
                          </span>
                          <button type="submit" className="rounded-md border border-line px-2 py-1 text-xs font-semibold text-ink-700 hover:bg-mist">
                            {a.actief ? 'Deactiveren' : 'Activeren'}
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-line bg-white p-4 shadow-soft">
          <h2 className="font-display text-base font-bold text-ink-900">Beheerder toevoegen</h2>
          <form action={adminToevoegen} className="mt-3 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-ink-600">E-mail</label>
              <input type="email" name="email" required placeholder="naam@frederiks.nl"
                className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-600">Naam</label>
              <input type="text" name="naam" placeholder="Voor- en achternaam"
                className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-600">Rol</label>
              <select name="rol" defaultValue="medewerker" className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm">
                <option value="eigenaar">Eigenaar</option>
                <option value="medewerker">Medewerker</option>
                <option value="lezer">Lezer</option>
              </select>
            </div>
            <button type="submit" className="btn-primary w-full">Toevoegen</button>
          </form>
          <p className="mt-3 text-xs text-warm">Een beheerder logt in via &apos;Inloggen met e-maillink&apos;. Toegang geldt pas als het e-mailadres hier staat en actief is. Huidige rollen: {Object.values(rolLabel).join(', ')}.</p>
        </div>
      </div>
    </main>
  );
}
