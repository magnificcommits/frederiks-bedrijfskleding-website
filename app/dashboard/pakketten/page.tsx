import Link from 'next/link';
import { redirect } from 'next/navigation';
import Drawer from '@/components/dashboard/Drawer';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { listOrganisaties, listPakketten } from '@/lib/kms/pakketten';
import { nieuwPakket } from './actions';
import NavigateSelect from '@/components/dashboard/NavigateSelect';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pakketten', robots: { index: false, follow: false } };

const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n || 0);
const inputCls = 'veld';

export default async function PakkettenPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
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

  const { org } = await searchParams;
  const orgs = await listOrganisaties();
  const gekozen = org && orgs.some((o) => o.id === org) ? org : '';
  const pakketten = gekozen ? await listPakketten(gekozen) : [];
  const gekozenNaam = orgs.find((o) => o.id === gekozen)?.naam ?? '';

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <h1 className="dash-h1">Pakketten</h1>
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="knop-tekst">Terug naar dashboard</Link>
          <Drawer
            knop="Nieuw pakket"
            titel="Nieuw pakket"
            beschrijving="Geef het pakket een naam en kies de soort. Na opslaan vul je de pakketprijs aan en koppel je de producten."
            >
            <form action={nieuwPakket} className="mt-4 flex flex-col gap-3">
              <input type="hidden" name="orgId" value={gekozen} />
              <div>
                <label className="veld-label">Naam</label>
                <input name="naam" required placeholder="Bijv. Startpakket monteur" className={inputCls} />
              </div>
              <div>
                <label className="veld-label">Soort</label>
                <select name="soort" defaultValue="regulier" className={inputCls}>
                  <option value="regulier">Regulier pakket</option>
                  <option value="start">Startpakket</option>
                </select>
              </div>
              <div>
                <label className="veld-label">Pakketprijs (mag leeg)</label>
                <input name="pakketprijs" inputMode="decimal" placeholder="bedrag" className={inputCls} />
              </div>
              <label className="flex items-center gap-2 text-sm text-ink-700">
                <input type="checkbox" name="buiten_budget" value="true" className="h-4 w-4 rounded border-line text-amber-600 focus:ring-amber-200" />
                Buiten budget
              </label>
              <button type="submit" className="self-start knop-donker">Pakket aanmaken</button>
            </form>
          </Drawer>
        </div>
      </div>
      <p className="mt-2 text-sm text-warm">Per klant stel je een startpakket en reguliere pakketten samen met een vaste pakketprijs. Kies een pakket om de inhoud te bewerken.</p>

      <section className="mt-8">
        <div className="flex flex-wrap items-end gap-3 panel p-4">
          <div className="min-w-[16rem]">
            <label className="veld-label">Klant</label>
            <div className="mt-1">
              <NavigateSelect options={orgs.map((o) => ({ value: o.id, label: o.naam }))} value={gekozen} basePath="/dashboard/pakketten" param="org" placeholder="Kies een klant" />
            </div>
          </div>
        </div>
      </section>

      {!gekozen ? (
        <p className="mt-8 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Kies eerst een klant om de pakketten te tonen.</p>
      ) : (
        <>
          <h2 className="font-display text-xl font-bold text-ink-900">Pakketten van {gekozenNaam}</h2>
          <p className="mt-2 rounded-xl border border-line bg-mist px-5 py-3 text-xs text-warm">Een startpakket moet eerst besteld worden voordat een medewerker losse artikelen kan nabestellen.</p>
          {pakketten.length === 0 ? (
            <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen pakketten voor deze klant. Voeg er rechtsboven een toe.</p>
          ) : (
            <div className="mt-4 overflow-x-auto panel">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Naam</th>
                    <th>Soort</th>
                    <th>Pakketprijs</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pakketten.map((p) => (
                    <tr key={p.id} className="border-b border-line">
                      <td>
                        <Link href={`/dashboard/pakketten/${p.id}`} className="font-semibold text-amber-700 hover:text-amber-800">{p.naam}</Link>
                        {p.buiten_budget && <span className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">buiten budget</span>}
                      </td>
                      <td>
                        <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${p.soort === 'start' ? 'bg-amber-100 text-amber-800' : 'bg-ink-100 text-ink-700'}`}>{p.soort === 'start' ? 'startpakket' : 'regulier'}</span>
                      </td>
                      <td className="text-warm">{p.pakketprijs != null ? euro(Number(p.pakketprijs)) : '-'}</td>
                      <td>
                        <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${p.actief ? 'bg-green-100 text-green-800' : 'bg-ink-100 text-ink-500'}`}>{p.actief ? 'actief' : 'inactief'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  );
}
