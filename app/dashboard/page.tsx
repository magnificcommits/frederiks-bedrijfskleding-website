import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { env, isLeadsDbConfigured } from '@/lib/env';
import { getLeads } from '@/lib/supabase';
import { login, logout, setStatus } from './actions';
const DASH_COOKIE = 'fb_dash';

export const metadata: Metadata = { title: 'Leads', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const statusen = ['nieuw', 'offerte', 'geaccordeerd', 'afgewezen'] as const;
const badge: Record<string, string> = {
  nieuw: 'bg-amber-100 text-amber-800',
  offerte: 'bg-ink-100 text-ink-700',
  geaccordeerd: 'bg-green-100 text-green-800',
  afgewezen: 'bg-ink-100 text-ink-500',
};

function fmt(d: string) {
  try {
    return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

export default async function DashboardPage() {
  const authed = Boolean(env.dashboardPassword) && (await cookies()).get(DASH_COOKIE)?.value === env.dashboardPassword;

  if (!authed) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-sm rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Lead-dashboard</h1>
          <p className="mt-2 text-sm text-warm">Log in om de aanvragen te bekijken.</p>
          {!env.dashboardPassword && (
            <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Nog niet ingesteld. Zet <code>DASHBOARD_PASSWORD</code> in de omgevingsvariabelen.</p>
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
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen en draai de migratie in <code>supabase/migrations/0001_leads.sql</code>. Daarna verschijnen hier alle aanvragen.</p>
          <form action={logout} className="mt-5"><button className="text-sm font-semibold text-warm hover:text-ink-800">Uitloggen</button></form>
        </div>
      </main>
    );
  }

  const leads = await getLeads();
  const telling = statusen.map((s) => ({ s, n: leads.filter((l) => l.status === s).length }));

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Leads</h1>
        <form action={logout}><button className="text-sm font-semibold text-warm hover:text-ink-800">Uitloggen</button></form>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-line bg-white p-4 shadow-soft">
          <p className="font-display text-2xl font-extrabold text-ink-900">{leads.length}</p>
          <p className="text-xs uppercase tracking-wide text-warm">totaal</p>
        </div>
        {telling.map(({ s, n }) => (
          <div key={s} className="rounded-xl border border-line bg-white p-4 shadow-soft">
            <p className="font-display text-2xl font-extrabold text-ink-900">{n}</p>
            <p className="text-xs uppercase tracking-wide text-warm">{s}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-warm">Tip voor je verdienmodel: de teller <strong>geaccordeerd</strong> is je afrekenbasis met Frederiks. Zet de status bij elke aanvraag bij.</p>

      {leads.length === 0 ? (
        <p className="mt-10 text-sm text-warm">Nog geen aanvragen binnen.</p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-mist text-xs uppercase tracking-wide text-warm">
              <tr>
                <th className="px-4 py-3">Datum</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Branche</th>
                <th className="px-4 py-3">Herkomst</th>
                <th className="px-4 py-3">Status</th>
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
                  <td className="px-4 py-3 text-warm">{l.branche || '-'}</td>
                  <td className="max-w-[16rem] px-4 py-3 text-xs text-warm">{l.bron || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${badge[l.status] ?? 'bg-ink-100 text-ink-600'}`}>{l.status}</span>
                    <form action={setStatus} className="mt-2 flex items-center gap-2">
                      <input type="hidden" name="id" value={l.id} />
                      <select name="status" defaultValue={l.status} className="rounded-md border border-line px-2 py-1 text-xs">
                        {statusen.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <button type="submit" className="rounded-md bg-ink-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-ink-800">Opslaan</button>
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
