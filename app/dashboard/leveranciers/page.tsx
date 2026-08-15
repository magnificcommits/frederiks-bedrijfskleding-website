import Link from 'next/link';
import { redirect } from 'next/navigation';
import Drawer from '@/components/dashboard/Drawer';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { listLeveranciers } from '@/lib/kms/producten';
import { nieuweLeverancier } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Leveranciers', robots: { index: false, follow: false } };

const inputCls = 'veld';

export default async function LeveranciersPage() {
  if (!(await dashAuthed())) redirect('/dashboard');
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

  const leveranciers = await listLeveranciers();

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <h1 className="dash-h1">Leveranciers</h1>
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="knop-tekst">Terug naar dashboard</Link>
          <Drawer
            knop="Nieuwe leverancier"
            titel="Nieuwe leverancier"
          >
            <form action={nieuweLeverancier} className="mt-4 flex flex-col gap-3">
                <div>
                  <label className="veld-label">Naam</label>
                  <input name="naam" required placeholder="Bedrijfsnaam" className={inputCls} />
                </div>
                <div>
                  <label className="veld-label">Contactpersoon</label>
                  <input name="contactpersoon" placeholder="Voor- en achternaam" className={inputCls} />
                </div>
                <div>
                  <label className="veld-label">Telefoon</label>
                  <input name="telefoon" placeholder="06 12 34 56 78" className={inputCls} />
                </div>
                <div>
                  <label className="veld-label">E-mail</label>
                  <input name="email" type="email" placeholder="naam@leverancier.nl" className={inputCls} />
                </div>
                <div>
                  <label className="veld-label">Levertijd (dagen)</label>
                  <input name="levertijd_dagen" inputMode="numeric" placeholder="bijv. 5" className={inputCls} />
                </div>
                <div>
                  <label className="veld-label">Betaalcondities</label>
                  <input name="betaalcondities" placeholder="bijv. 30 dagen netto" className={inputCls} />
                </div>
                <div>
                  <label className="veld-label">Merken (komma-gescheiden)</label>
                  <input name="merken" placeholder="Merk A, Merk B" className={inputCls} />
                </div>
                <button type="submit" className="self-start knop-donker">Leverancier aanmaken</button>
            </form>
          </Drawer>
        </div>
      </div>
      <p className="mt-2 text-sm text-warm">De leveranciers die je aan producten koppelt.</p>

        {leveranciers.length === 0 ? (
          <p className="rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen leveranciers. Voeg er rechtsboven een toe.</p>
        ) : (
          <div className="panel overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Naam</th>
                  <th>Contactpersoon</th>
                  <th>Telefoon</th>
                  <th>E-mail</th>
                  <th>Levertijd</th>
                  <th>Merken</th>
                </tr>
              </thead>
              <tbody>
                {leveranciers.map((l) => (
                  <tr key={l.id} className="border-b border-line align-top">
                    <td className="font-semibold text-ink-900">{l.naam}</td>
                    <td className="text-warm">{l.contactpersoon || '-'}</td>
                    <td className="text-warm">{l.telefoon || '-'}</td>
                    <td className="text-warm">{l.email || '-'}</td>
                    <td className="text-warm">{l.levertijd_dagen != null ? `${l.levertijd_dagen} dgn` : '-'}</td>
                    <td className="text-warm">{(l.merken && l.merken.length > 0) ? l.merken.join(', ') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </main>
  );
}
