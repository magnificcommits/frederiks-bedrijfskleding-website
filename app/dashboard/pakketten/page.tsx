import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { listOrganisaties, listPakketten } from '@/lib/kms/pakketten';
import { nieuwPakket } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pakketten', robots: { index: false, follow: false } };

const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n || 0);
const inputCls = 'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';

export default async function PakkettenPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
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

  const { org } = await searchParams;
  const orgs = await listOrganisaties();
  const gekozen = org && orgs.some((o) => o.id === org) ? org : '';
  const pakketten = gekozen ? await listPakketten(gekozen) : [];
  const gekozenNaam = orgs.find((o) => o.id === gekozen)?.naam ?? '';

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Pakketten</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
      </div>
      <p className="mt-2 text-sm text-warm">Per klant stel je een startpakket en reguliere pakketten samen met een vaste pakketprijs. Kies een pakket om de inhoud te bewerken.</p>

      <section className="mt-8">
        <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-6 shadow-soft">
          <div className="min-w-[16rem]">
            <label className="block text-xs font-semibold text-warm">Klant</label>
            <select name="org" defaultValue={gekozen} className={inputCls}>
              <option value="">Kies een klant</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.naam}</option>)}
            </select>
          </div>
          <button type="submit" className="rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Tonen</button>
        </form>
      </section>

      {!gekozen ? (
        <p className="mt-8 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Kies eerst een klant om de pakketten te tonen.</p>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="font-display text-xl font-bold text-ink-900">Pakketten van {gekozenNaam}</h2>
            <p className="mt-2 rounded-xl border border-line bg-mist px-5 py-3 text-xs text-warm">Een startpakket moet eerst besteld worden voordat een medewerker losse artikelen kan nabestellen.</p>
            {pakketten.length === 0 ? (
              <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen pakketten voor deze klant. Voeg er rechts een toe.</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-warm">
                    <tr>
                      <th className="px-4 py-3">Naam</th>
                      <th className="px-4 py-3">Soort</th>
                      <th className="px-4 py-3">Pakketprijs</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pakketten.map((p) => (
                      <tr key={p.id} className="border-b border-line">
                        <td className="px-4 py-3">
                          <Link href={`/dashboard/pakketten/${p.id}`} className="font-semibold text-amber-700 hover:text-amber-800">{p.naam}</Link>
                          {p.buiten_budget && <span className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">buiten budget</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${p.soort === 'start' ? 'bg-amber-100 text-amber-800' : 'bg-ink-100 text-ink-700'}`}>{p.soort === 'start' ? 'startpakket' : 'regulier'}</span>
                        </td>
                        <td className="px-4 py-3 text-warm">{p.pakketprijs != null ? euro(Number(p.pakketprijs)) : '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${p.actief ? 'bg-green-100 text-green-800' : 'bg-ink-100 text-ink-500'}`}>{p.actief ? 'actief' : 'inactief'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <h2 className="font-display text-lg font-bold text-ink-900">Nieuw pakket</h2>
            <p className="mt-1 text-xs text-warm">Geef het pakket een naam en kies de soort. Na opslaan vul je de pakketprijs aan en koppel je de producten.</p>
            <form action={nieuwPakket} className="mt-4 flex flex-col gap-3">
              <input type="hidden" name="orgId" value={gekozen} />
              <div>
                <label className="block text-xs font-semibold text-warm">Naam</label>
                <input name="naam" required placeholder="Bijv. Startpakket monteur" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Soort</label>
                <select name="soort" defaultValue="regulier" className={inputCls}>
                  <option value="regulier">Regulier pakket</option>
                  <option value="start">Startpakket</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Pakketprijs (mag leeg)</label>
                <input name="pakketprijs" inputMode="decimal" placeholder="bedrag" className={inputCls} />
              </div>
              <label className="flex items-center gap-2 text-sm text-ink-700">
                <input type="checkbox" name="buiten_budget" value="true" className="h-4 w-4 rounded border-line text-amber-600 focus:ring-amber-200" />
                Buiten budget
              </label>
              <button type="submit" className="self-start rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Pakket aanmaken</button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
