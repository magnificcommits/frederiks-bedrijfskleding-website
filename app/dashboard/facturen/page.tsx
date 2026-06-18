import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { listFacturen, listOrganisaties, listFactureerbareOrders, getBoekhouderEmail, FACTUUR_STATUSSEN } from '@/lib/kms/facturen';
import NavigateSelect from '@/components/dashboard/NavigateSelect';
import { factuurVanOrder, legeFactuur, zetBoekhouderEmailActie, mailFacturenActie } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Facturen', robots: { index: false, follow: false } };

const inputCls = 'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';
const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n || 0);
function fmt(d: string | null) {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

const statusBadge: Record<string, string> = {
  concept: 'bg-ink-100 text-ink-600',
  verzonden: 'bg-amber-100 text-amber-800',
  betaald: 'bg-green-100 text-green-800',
};

export default async function FacturenPage({ searchParams }: { searchParams: Promise<{ status?: string; order?: string; ok?: string; gemaild?: string; mailfout?: string }> }) {
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

  const { status, order, ok, gemaild, mailfout } = await searchParams;
  const [facturen, organisaties, factureerbaar, boekhouderEmail] = await Promise.all([
    listFacturen(status),
    listOrganisaties(),
    listFactureerbareOrders(),
    getBoekhouderEmail(),
  ]);
  const voorgeselecteerd = order && factureerbaar.some((o) => o.id === order) ? order : '';

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Facturen</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
      </div>
      <p className="mt-2 text-sm text-warm">Alle facturen met hun status. Klik op een factuurnummer om de regels te beheren en de factuur af te drukken.</p>

      {gemaild && (
        <p className="mt-4 rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-800">{gemaild} {Number(gemaild) === 1 ? 'factuur' : 'facturen'} gemaild naar de boekhouder.</p>
      )}
      {mailfout && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-800">{mailfout}</p>
      )}
      {ok === 'boekhouder' && (
        <p className="mt-4 rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-800">E-mailadres van de boekhouder opgeslagen.</p>
      )}

      <div className="mt-6 rounded-2xl border border-line bg-white p-6 shadow-soft">
        <h2 className="font-display text-lg font-bold text-ink-900">Boekhouder</h2>
        <p className="mt-1 text-xs text-warm">Facturen worden naar dit adres gemaild.</p>
        <form action={zetBoekhouderEmailActie} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[16rem] flex-1">
            <label className="block text-xs font-semibold text-warm">E-mailadres boekhouder</label>
            <input type="email" name="boekhouder_email" defaultValue={boekhouderEmail} placeholder="boekhouder@voorbeeld.nl" className={inputCls} />
          </div>
          <button type="submit" className="rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Opslaan</button>
        </form>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-semibold text-warm">Status</label>
          <NavigateSelect
            basePath="/dashboard/facturen"
            param="status"
            value={status ?? ''}
            placeholder="Alle statussen"
            className={inputCls}
            options={FACTUUR_STATUSSEN.map((s) => ({ value: s, label: s }))}
          />
        </div>
        {status && <Link href="/dashboard/facturen" className="text-sm font-semibold text-warm hover:text-ink-800">Wissen</Link>}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {facturen.length === 0 ? (
            <p className="rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Geen facturen gevonden. Maak er rechts een aan.</p>
          ) : (
            <form action={mailFacturenActie}>
              <div className="mb-3 flex justify-end">
                <button type="submit" className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">Mail geselecteerde naar boekhouder</button>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-warm">
                    <tr>
                      <th className="px-4 py-3"><span className="sr-only">Selecteren</span></th>
                      <th className="px-4 py-3">Nummer</th>
                      <th className="px-4 py-3">Klant</th>
                      <th className="px-4 py-3">Datum</th>
                      <th className="px-4 py-3">Bedrag incl.</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Boekhouder</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturen.map((f) => (
                      <tr key={f.id} className="border-b border-line">
                        <td className="px-4 py-3">
                          <input type="checkbox" name="factuur_ids" value={f.id} className="h-4 w-4 rounded border-line text-amber-600 focus:ring-amber-200" aria-label={`Selecteer factuur ${f.factuurnummer || 'concept'}`} />
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/dashboard/facturen/${f.id}`} className="font-semibold text-amber-700 hover:text-amber-800">{f.factuurnummer || 'concept'}</Link>
                        </td>
                        <td className="px-4 py-3 text-ink-900">{f.organisatie_naam || '-'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-warm">{fmt(f.factuurdatum)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-warm">{f.bedrag_incl != null ? euro(Number(f.bedrag_incl)) : '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge[f.status] ?? 'bg-ink-100 text-ink-600'}`}>{f.status}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {f.gemaild_op ? (
                            <span className="inline-block rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">Gemaild · {fmt(f.gemaild_op)}</span>
                          ) : (
                            <span className="text-xs text-warm">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </form>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <h2 className="font-display text-lg font-bold text-ink-900">Factuur van order</h2>
            <p className="mt-1 text-xs text-warm">Kies een order zonder factuur. De orderregels worden overgenomen als factuurregels.</p>
            {factureerbaar.length === 0 ? (
              <p className="mt-4 rounded-xl border border-line bg-mist px-4 py-3 text-xs text-warm">Geen orders zonder factuur beschikbaar.</p>
            ) : (
              <form action={factuurVanOrder} className="mt-4 flex flex-col gap-3">
                <div>
                  <label className="block text-xs font-semibold text-warm">Order</label>
                  <select name="order_id" required defaultValue={voorgeselecteerd} className={inputCls}>
                    <option value="">Kies een order</option>
                    {factureerbaar.map((o) => (
                      <option key={o.id} value={o.id}>#{o.ordernummer}{o.organisatie_naam ? ` · ${o.organisatie_naam}` : ''}{o.bedrag != null ? ` · ${euro(Number(o.bedrag))}` : ''}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="self-start rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Factuur aanmaken</button>
              </form>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
            <h2 className="font-display text-lg font-bold text-ink-900">Lege factuur</h2>
            <p className="mt-1 text-xs text-warm">Kies een klant en vul daarna zelf de regels in.</p>
            <form action={legeFactuur} className="mt-4 flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold text-warm">Klant</label>
                <select name="organisatie_id" required className={inputCls}>
                  <option value="">Kies een klant</option>
                  {organisaties.map((o) => <option key={o.id} value={o.id}>{o.naam}</option>)}
                </select>
              </div>
              <button type="submit" className="self-start rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Lege factuur aanmaken</button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
