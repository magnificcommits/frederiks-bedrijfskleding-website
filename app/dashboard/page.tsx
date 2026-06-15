import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { env, isLeadsDbConfigured } from '@/lib/env';
import { getLeads } from '@/lib/supabase';
import { login, logout, saveLeadEdit } from './actions';

export const metadata: Metadata = { title: 'Leads', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
const DASH_COOKIE = 'fb_dash';

const statusen = ['nieuw', 'offerte', 'geaccordeerd', 'afgewezen'] as const;
const badge: Record<string, string> = {
  nieuw: 'bg-amber-100 text-amber-800',
  offerte: 'bg-ink-100 text-ink-700',
  geaccordeerd: 'bg-green-100 text-green-800',
  afgewezen: 'bg-ink-100 text-ink-500',
};
const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
function fmt(d: string) {
  try { return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

type SP = { fout?: string; status?: string; q?: string; bron?: string };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const authed = Boolean(env.dashboardPassword) && (await cookies()).get(DASH_COOKIE)?.value === env.dashboardPassword.trim();

  if (!authed) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-sm rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Lead-dashboard</h1>
          <p className="mt-2 text-sm text-warm">Log in om de aanvragen te bekijken.</p>
          {!env.dashboardPassword && (
            <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Nog niet ingesteld. Zet <code>DASHBOARD_PASSWORD</code> in de omgevingsvariabelen.</p>
          )}
          {sp?.fout && (
            <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">Wachtwoord onjuist. Probeer het opnieuw.</p>
          )}
          <form action={login} className="mt-5">
            <input type="password" name="password" placeholder="Wachtwoord" autoComplete="current-password"
              className="w-full rounded-md border border-line bg-white px-4 py-3 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
            <button type="submit" className="btn-primary mt-3 w-full">Inloggen</button>
          </form>
        </div>
      </main>
    );
  }

  if (!isLeadsDbConfigured) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Leaddatabase nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen en draai de migraties in <code>supabase/migrations</code>.</p>
          <form action={logout} className="mt-5"><button className="text-sm font-semibold text-warm hover:text-ink-800">Uitloggen</button></form>
        </div>
      </main>
    );
  }

  const alle = await getLeads();
  const telling = statusen.map((s) => ({ s, n: alle.filter((l) => l.status === s).length }));
  const waardeGeaccordeerd = alle.filter((l) => l.status === 'geaccordeerd').reduce((t, l) => t + (Number(l.offertewaarde) || 0), 0);
  const waardeOpen = alle.filter((l) => l.status === 'nieuw' || l.status === 'offerte').reduce((t, l) => t + (Number(l.offertewaarde) || 0), 0);
  const bronnen = Array.from(new Set(alle.map((l) => l.bron).filter(Boolean))) as string[];

  // Filters toepassen
  const q = (sp.q ?? '').toLowerCase().trim();
  const leads = alle.filter((l) => {
    if (sp.status && l.status !== sp.status) return false;
    if (sp.bron && l.bron !== sp.bron) return false;
    if (q && !`${l.name} ${l.company ?? ''} ${l.email}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const qs = new URLSearchParams();
  if (sp.status) qs.set('status', sp.status);
  if (sp.bron) qs.set('bron', sp.bron);
  if (q) qs.set('q', q);
  const terug = `/dashboard${qs.toString() ? `?${qs}` : ''}`;

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Leads</h1>
        <div className="flex items-center gap-4">
          <a href="/dashboard/export" className="text-sm font-semibold text-amber-700 hover:text-amber-800">Export CSV</a>
          <form action={logout}><button className="text-sm font-semibold text-warm hover:text-ink-800">Uitloggen</button></form>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-xl border border-line bg-white p-4 shadow-soft">
          <p className="font-display text-2xl font-extrabold text-ink-900">{alle.length}</p>
          <p className="text-xs uppercase tracking-wide text-warm">totaal</p>
        </div>
        {telling.map(({ s, n }) => (
          <div key={s} className="rounded-xl border border-line bg-white p-4 shadow-soft">
            <p className="font-display text-2xl font-extrabold text-ink-900">{n}</p>
            <p className="text-xs uppercase tracking-wide text-warm">{s}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-6 rounded-xl border border-line bg-mist px-5 py-4 text-sm">
        <p><span className="text-warm">Waarde geaccordeerd:</span> <span className="font-bold text-ink-900">{euro(waardeGeaccordeerd)}</span></p>
        <p><span className="text-warm">Openstaande waarde (nieuw + offerte):</span> <span className="font-bold text-ink-900">{euro(waardeOpen)}</span></p>
      </div>

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-semibold text-warm">Status</label>
          <select name="status" defaultValue={sp.status ?? ''} className="mt-1 rounded-md border border-line px-3 py-2 text-sm">
            <option value="">Alle</option>
            {statusen.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-warm">Herkomst</label>
          <select name="bron" defaultValue={sp.bron ?? ''} className="mt-1 max-w-[14rem] rounded-md border border-line px-3 py-2 text-sm">
            <option value="">Alle</option>
            {bronnen.map((b) => <option key={b} value={b}>{b.length > 40 ? b.slice(0, 40) + '...' : b}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-warm">Zoek (naam, bedrijf, e-mail)</label>
          <input name="q" defaultValue={sp.q ?? ''} placeholder="zoeken" className="mt-1 rounded-md border border-line px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Filter</button>
        {(sp.status || sp.bron || sp.q) && <a href="/dashboard" className="py-2 text-sm font-semibold text-warm hover:text-ink-800">Wis filters</a>}
      </form>

      {leads.length === 0 ? (
        <p className="mt-10 text-sm text-warm">Geen aanvragen die aan dit filter voldoen.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-warm">
              <tr>
                <th className="px-4 py-3">Datum</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Branche / herkomst</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Beheer</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-b border-line align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-warm">{fmt(l.created_at)}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink-900">{l.name}{l.company ? ` · ${l.company}` : ''}</p>
                    <p className="text-warm">{l.email}{l.phone ? ` · ${l.phone}` : ''}</p>
                    {l.bericht && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-amber-700">Bericht</summary>
                        <p className="mt-1 whitespace-pre-wrap text-xs text-warm">{l.bericht}</p>
                      </details>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-warm">
                    <p className="text-sm text-ink-700">{l.branche || '-'}</p>
                    <p className="mt-1 max-w-[14rem]">{l.bron || '-'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${badge[l.status] ?? 'bg-ink-100 text-ink-600'}`}>{l.status}</span>
                    {l.offertewaarde != null && <p className="mt-1 text-xs font-semibold text-ink-700">{euro(Number(l.offertewaarde))}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <form action={saveLeadEdit} className="flex flex-col gap-2">
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="terug" value={terug} />
                      <div className="flex items-center gap-2">
                        <select name="status" defaultValue={l.status} className="rounded-md border border-line px-2 py-1 text-xs">
                          {statusen.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <input name="offertewaarde" defaultValue={l.offertewaarde ?? ''} inputMode="decimal" placeholder="bedrag" className="w-24 rounded-md border border-line px-2 py-1 text-xs" />
                      </div>
                      <input name="notitie" defaultValue={l.notitie ?? ''} placeholder="notitie" className="w-full rounded-md border border-line px-2 py-1 text-xs" />
                      <button type="submit" className="self-start rounded-md bg-ink-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-ink-800">Opslaan</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
