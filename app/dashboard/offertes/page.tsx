import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { listOffertes, getOfferte, offerteTotalen, OFFERTE_STATUSSEN } from '@/lib/kms/offertes';
import { listOrganisaties } from '@/lib/portaalAdmin';
import { formatEuro, formatDatum } from '@/lib/format';
import NavigateSelect from '@/components/dashboard/NavigateSelect';
import { maakOfferteActie } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Offertes', robots: { index: false, follow: false } };

const inputCls = 'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';

const statusBadge: Record<string, string> = {
  concept: 'bg-ink-100 text-ink-600',
  verstuurd: 'bg-amber-100 text-amber-800',
  geaccepteerd: 'bg-green-100 text-green-800',
  afgewezen: 'bg-red-100 text-red-800',
};

export default async function OffertesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
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

  const { status } = await searchParams;
  const [offertes, organisaties] = await Promise.all([listOffertes(status), listOrganisaties()]);

  // Totaal per offerte: regels ophalen per offerte zou N+1 zijn; we tonen het
  // totaal compact door de detail-helper alleen voor de lijst te benutten.
  const totalen = await Promise.all(
    offertes.map(async (o) => {
      const detail = await getOfferte(o.id);
      if (!detail) return { id: o.id, totaal: 0 };
      const { totaal } = offerteTotalen(detail.regels, detail.btw_pct);
      return { id: o.id, totaal };
    }),
  );
  const totaalMap = new Map(totalen.map((t) => [t.id, t.totaal]));

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Offertes</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
      </div>
      <p className="mt-2 text-sm text-warm">Offertes met hun status. Klik op een offertenummer om de regels te beheren en de offerte af te drukken.</p>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-semibold text-warm">Status</label>
          <NavigateSelect
            basePath="/dashboard/offertes"
            param="status"
            value={status ?? ''}
            placeholder="Alle statussen"
            className={inputCls}
            options={OFFERTE_STATUSSEN.map((s) => ({ value: s, label: s }))}
          />
        </div>
        {status && <Link href="/dashboard/offertes" className="text-sm font-semibold text-warm hover:text-ink-800">Wissen</Link>}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {offertes.length === 0 ? (
            <p className="rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Geen offertes gevonden. Maak er rechts een aan.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-warm">
                  <tr>
                    <th className="px-4 py-3">Nummer</th>
                    <th className="px-4 py-3">Klant</th>
                    <th className="px-4 py-3">Datum</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Totaal</th>
                  </tr>
                </thead>
                <tbody>
                  {offertes.map((o) => (
                    <tr key={o.id} className="border-b border-line">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/offertes/${o.id}`} className="font-semibold text-amber-700 hover:text-amber-800">
                          {o.offertenummer != null ? `#${o.offertenummer}` : 'concept'}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-ink-900">{o.organisatie_naam || '-'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-warm">{formatDatum(o.created_at) || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge[o.status] ?? 'bg-ink-100 text-ink-600'}`}>{o.status}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-ink-900">{formatEuro(totaalMap.get(o.id) ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="font-display text-lg font-bold text-ink-900">Nieuwe offerte</h2>
          <p className="mt-1 text-xs text-warm">Kies een klant en vul daarna de regels in op de offerte.</p>
          <form action={maakOfferteActie} className="mt-4 flex flex-col gap-3">
            <div>
              <label className="block text-xs font-semibold text-warm">Klant</label>
              <select name="organisatie_id" className={inputCls} defaultValue="">
                <option value="">Geen klant gekoppeld</option>
                {organisaties.map((o) => <option key={o.id} value={o.id}>{o.naam}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-warm">Contactpersoon</label>
              <input name="contactpersoon" placeholder="Naam contactpersoon" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-warm">Geldig tot</label>
              <input type="date" name="geldig_tot" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-warm">Notitie</label>
              <textarea name="notitie" rows={2} placeholder="Interne notitie of toelichting" className={inputCls} />
            </div>
            <button type="submit" className="self-start rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Offerte aanmaken</button>
          </form>
        </div>
      </div>
    </main>
  );
}
