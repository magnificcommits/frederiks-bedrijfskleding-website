import Link from 'next/link';
import { redirect } from 'next/navigation';
import Drawer from '@/components/dashboard/Drawer';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { listOrganisaties, listFuncties } from '@/lib/kms/functies';
import { nieuweFunctie, verwijderFunctieActie } from './actions';
import ConfirmSubmit from '@/components/ConfirmSubmit';
import NavigateSelect from '@/components/dashboard/NavigateSelect';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Functies', robots: { index: false, follow: false } };

const inputCls = 'veld';

export default async function FunctiesPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
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
  const functies = gekozen ? await listFuncties(gekozen) : [];
  const gekozenNaam = orgs.find((o) => o.id === gekozen)?.naam ?? '';

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex items-center justify-between gap-4">
        <h1 className="dash-h1">Functies</h1>
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="knop-tekst">Terug naar dashboard</Link>
          <Drawer
            knop="Nieuwe functie"
            titel="Nieuwe functie"
            beschrijving="Geef de functiegroep een naam. Na opslaan koppel je de producten van het kledingpakket."
            >
            <form action={nieuweFunctie} className="mt-4 flex flex-col gap-3">
              <input type="hidden" name="orgId" value={gekozen} />
              <div>
                <label className="veld-label">Naam</label>
                <input name="naam" required placeholder="Bijv. Monteur buitendienst" className={inputCls} />
              </div>
              <button type="submit" className="self-start knop-donker">Functie aanmaken</button>
            </form>
          </Drawer>
        </div>
      </div>
      <p className="mt-2 text-sm text-warm">Per klant leg je functiegroepen vast met een vast kledingpakket. Kies een functie om de gekoppelde producten te beheren.</p>

      <section className="mt-8">
        <div className="flex flex-wrap items-end gap-3 panel p-4">
          <div className="min-w-[20rem] flex-1 sm:max-w-md">
            <label className="veld-label">Klant</label>
            <NavigateSelect
              basePath="/dashboard/functies"
              param="org"
              value={gekozen}
              placeholder="Kies een klant"
              className={`${inputCls} w-full`}
              options={orgs.map((o) => ({ value: o.id, label: o.naam }))}
            />
          </div>
        </div>
      </section>

      {!gekozen ? (
        <p className="mt-8 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Kies eerst een klant om de functies te tonen.</p>
      ) : (
        <>
          <h2 className="font-display text-xl font-bold text-ink-900">Functies van {gekozenNaam}</h2>
          {functies.length === 0 ? (
            <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen functies voor deze klant. Voeg er rechtsboven een toe.</p>
          ) : (
            <div className="mt-4 overflow-x-auto panel">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Naam</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {functies.map((f) => (
                    <tr key={f.id} className="border-b border-line">
                      <td>
                        <Link href={`/dashboard/functies/${f.id}`} className="font-semibold text-amber-700 hover:text-amber-800">{f.naam}</Link>
                      </td>
                      <td className="text-right">
                        <form action={verwijderFunctieActie}>
                          <input type="hidden" name="orgId" value={gekozen} />
                          <input type="hidden" name="functieId" value={f.id} />
                          <ConfirmSubmit message="Deze functie verwijderen?" className="rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-mist">Verwijderen</ConfirmSubmit>
                        </form>
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
