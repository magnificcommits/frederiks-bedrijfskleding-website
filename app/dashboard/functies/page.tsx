import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { listOrganisaties, listFuncties } from '@/lib/kms/functies';
import { nieuweFunctie, verwijderFunctieActie } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Functies', robots: { index: false, follow: false } };

const inputCls = 'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';

export default async function FunctiesPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
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
  const functies = gekozen ? await listFuncties(gekozen) : [];
  const gekozenNaam = orgs.find((o) => o.id === gekozen)?.naam ?? '';

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Functies</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
      </div>
      <p className="mt-2 text-sm text-warm">Per klant leg je functiegroepen vast met een vast kledingpakket. Kies een functie om de gekoppelde producten te beheren.</p>

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
        <p className="mt-8 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Kies eerst een klant om de functies te tonen.</p>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="font-display text-xl font-bold text-ink-900">Functies van {gekozenNaam}</h2>
            {functies.length === 0 ? (
              <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen functies voor deze klant. Voeg er rechts een toe.</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-warm">
                    <tr>
                      <th className="px-4 py-3">Naam</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {functies.map((f) => (
                      <tr key={f.id} className="border-b border-line">
                        <td className="px-4 py-3">
                          <Link href={`/dashboard/functies/${f.id}`} className="font-semibold text-amber-700 hover:text-amber-800">{f.naam}</Link>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <form action={verwijderFunctieActie}>
                            <input type="hidden" name="orgId" value={gekozen} />
                            <input type="hidden" name="functieId" value={f.id} />
                            <button type="submit" className="rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-mist">Verwijderen</button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <h2 className="font-display text-lg font-bold text-ink-900">Nieuwe functie</h2>
            <p className="mt-1 text-xs text-warm">Geef de functiegroep een naam. Na opslaan koppel je de producten van het kledingpakket.</p>
            <form action={nieuweFunctie} className="mt-4 flex flex-col gap-3">
              <input type="hidden" name="orgId" value={gekozen} />
              <div>
                <label className="block text-xs font-semibold text-warm">Naam</label>
                <input name="naam" required placeholder="Bijv. Monteur buitendienst" className={inputCls} />
              </div>
              <button type="submit" className="self-start rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Functie aanmaken</button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
