import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { listOrganisaties, listLogos } from '@/lib/kms/logos';
import { nieuwLogo, verwijderLogoActie } from './actions';
import NavigateSelect from '@/components/dashboard/NavigateSelect';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Logobibliotheek', robots: { index: false, follow: false } };

const inputCls = 'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';
const fileCls = 'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-mist file:px-3 file:py-1 file:text-xs file:font-semibold file:text-ink-700 hover:file:bg-line focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';

function bestandLink(label: string, url: string | null) {
  if (!url) return null;
  return (
    <a key={label} href={url} target="_blank" rel="noreferrer" className="inline-block rounded-md border border-line px-2 py-0.5 text-xs font-semibold text-amber-700 hover:bg-mist">
      {label}
    </a>
  );
}

export default async function LogosPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const { org } = await searchParams;

  const orgs = await listOrganisaties();
  const gekozen = org && orgs.some((o) => o.id === org) ? org : '';
  const logos = gekozen ? await listLogos(gekozen) : [];
  const gekozenNaam = orgs.find((o) => o.id === gekozen)?.naam ?? '';

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Logobibliotheek</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
      </div>
      <p className="mt-2 text-sm text-warm">Per klant bewaar je hier de logo&apos;s met de bijbehorende bestanden voor bedrukken en borduren.</p>

      <section className="mt-8">
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-6 shadow-soft">
          <div className="min-w-[16rem]">
            <label className="block text-xs font-semibold text-warm">Klant</label>
            <div className="mt-1">
              <NavigateSelect options={orgs.map((o) => ({ value: o.id, label: o.naam }))} value={gekozen} basePath="/dashboard/logos" param="org" placeholder="Kies een klant" />
            </div>
          </div>
        </div>
      </section>

      {!gekozen ? (
        <p className="mt-8 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Kies eerst een klant om de logobibliotheek te tonen.</p>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="font-display text-xl font-bold text-ink-900">Logo&apos;s van {gekozenNaam}</h2>
            {logos.length === 0 ? (
              <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Nog geen logo&apos;s voor deze klant. Voeg er rechts een toe.</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-warm">
                    <tr>
                      <th className="px-4 py-3">Naam</th>
                      <th className="px-4 py-3">Bestanden</th>
                      <th className="px-4 py-3">Opmerkingen</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {logos.map((l) => {
                      const links = [
                        bestandLink('Logo', l.logo_bestand_url),
                        bestandLink('Vector', l.vectorbestand_url),
                        bestandLink('Borduur', l.borduurbestand_url),
                      ].filter(Boolean);
                      return (
                        <tr key={l.id} className="border-b border-line align-top">
                          <td className="px-4 py-3 font-semibold text-ink-900">{l.naam}</td>
                          <td className="px-4 py-3">
                            {links.length === 0 ? <span className="text-warm">-</span> : <div className="flex flex-wrap gap-1.5">{links}</div>}
                          </td>
                          <td className="px-4 py-3 text-warm">{l.opmerkingen || '-'}</td>
                          <td className="px-4 py-3">
                            <form action={verwijderLogoActie}>
                              <input type="hidden" name="orgId" value={gekozen} />
                              <input type="hidden" name="logoId" value={l.id} />
                              <button type="submit" className="rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-mist">Verwijderen</button>
                            </form>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <h2 className="font-display text-lg font-bold text-ink-900">Nieuw logo</h2>
            <p className="mt-1 text-xs text-warm">Upload de bestanden, of plak een URL als alternatief.</p>
            <form action={nieuwLogo} className="mt-4 flex flex-col gap-3">
              <input type="hidden" name="orgId" value={gekozen} />
              <div>
                <label className="block text-xs font-semibold text-warm">Naam</label>
                <input name="naam" required placeholder="Bijv. Bedrijfslogo borst" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Logo-bestand</label>
                <input type="file" name="logo_bestand" accept="image/*" className={fileCls} />
                <input name="logo_bestand_url" placeholder="of plak een URL" className={`${inputCls} mt-2`} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Vectorbestand</label>
                <input type="file" name="vectorbestand" accept="image/*" className={fileCls} />
                <input name="vectorbestand_url" placeholder="of plak een URL" className={`${inputCls} mt-2`} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Borduurbestand</label>
                <input type="file" name="borduurbestand" accept="image/*" className={fileCls} />
                <input name="borduurbestand_url" placeholder="of plak een URL" className={`${inputCls} mt-2`} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm">Opmerkingen</label>
                <textarea name="opmerkingen" rows={3} placeholder="Bijv. kleurcodes of plaatsing" className={inputCls} />
              </div>
              <button type="submit" className="self-start rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Logo opslaan</button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
