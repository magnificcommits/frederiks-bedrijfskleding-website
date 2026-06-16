import Link from 'next/link';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { listOrders, ORDER_STATUSSEN } from '@/lib/kms/orders';
import { nieuweOrder } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Orders', robots: { index: false, follow: false } };

const inputCls = 'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';
const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n || 0);
function fmt(d: string | null) {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

const statusBadge: Record<string, string> = {
  concept: 'bg-ink-100 text-ink-600',
  offerte_verstuurd: 'bg-amber-100 text-amber-800',
  offerte_goedgekeurd: 'bg-amber-100 text-amber-800',
  nog_bestellen: 'bg-amber-100 text-amber-800',
  besteld: 'bg-ink-100 text-ink-700',
  deellevering: 'bg-ink-100 text-ink-700',
  compleet_geleverd: 'bg-green-100 text-green-800',
  afgerond: 'bg-green-100 text-green-800',
};
const goedkeurBadge: Record<string, string> = {
  niet_nodig: 'bg-ink-100 text-ink-500',
  wacht: 'bg-amber-100 text-amber-800',
  goedgekeurd: 'bg-green-100 text-green-800',
  afgewezen: 'bg-ink-100 text-ink-500',
};

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
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
  const [orders, { data: orgData }, { data: medewData }] = await Promise.all([
    listOrders(status),
    sb.from('organisaties').select('id, naam').order('naam'),
    sb.from('medewerkers').select('id, naam').order('naam'),
  ]);
  const organisaties = (orgData as { id: string; naam: string }[]) ?? [];
  const medewerkers = (medewData as { id: string; naam: string }[]) ?? [];

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Orders</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
      </div>
      <p className="mt-2 text-sm text-warm">Alle orders met hun status en goedkeuring. Klik op een ordernummer om de regels te beheren.</p>

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-semibold text-warm">Status</label>
          <select name="status" defaultValue={status ?? ''} className={inputCls}>
            <option value="">Alle statussen</option>
            {ORDER_STATUSSEN.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <button type="submit" className="rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Filteren</button>
        {status && <Link href="/dashboard/orders" className="text-sm font-semibold text-warm hover:text-ink-800">Wissen</Link>}
      </form>

      <div className="mt-6 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {orders.length === 0 ? (
            <p className="rounded-xl border border-line bg-mist px-5 py-4 text-sm text-warm">Geen orders gevonden. Maak er rechts een aan.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-warm">
                  <tr>
                    <th className="px-4 py-3">Nr.</th>
                    <th className="px-4 py-3">Klant</th>
                    <th className="px-4 py-3">Datum</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Bedrag</th>
                    <th className="px-4 py-3">Goedkeuring</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-b border-line">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/orders/${o.id}`} className="font-semibold text-amber-700 hover:text-amber-800">#{o.ordernummer}</Link>
                      </td>
                      <td className="px-4 py-3 text-ink-900">
                        {o.organisatie_naam || '-'}
                        {o.medewerker_naam && <span className="block text-xs text-warm">{o.medewerker_naam}</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-warm">{fmt(o.besteldatum)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge[o.status] ?? 'bg-ink-100 text-ink-600'}`}>{o.status.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-warm">{o.bedrag != null ? euro(Number(o.bedrag)) : '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${goedkeurBadge[o.goedkeuring_status] ?? 'bg-ink-100 text-ink-500'}`}>{o.goedkeuring_status.replace(/_/g, ' ')}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="font-display text-lg font-bold text-ink-900">Nieuwe order</h2>
          <p className="mt-1 text-xs text-warm">Kies de klant en eventueel de medewerker. Na opslaan ga je door naar de orderpagina voor de regels.</p>
          <form action={nieuweOrder} className="mt-4 flex flex-col gap-3">
            <div>
              <label className="block text-xs font-semibold text-warm">Klant</label>
              <select name="organisatie_id" required className={inputCls}>
                <option value="">Kies een klant</option>
                {organisaties.map((o) => <option key={o.id} value={o.id}>{o.naam}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-warm">Medewerker (optioneel)</label>
              <select name="medewerker_id" className={inputCls}>
                <option value="">Geen medewerker</option>
                {medewerkers.map((m) => <option key={m.id} value={m.id}>{m.naam}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-warm">Aangevraagd door (optioneel)</label>
              <input name="aangevraagd_door" placeholder="Naam" className={inputCls} />
            </div>
            <button type="submit" className="self-start rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Order aanmaken</button>
          </form>
        </div>
      </div>
    </main>
  );
}
