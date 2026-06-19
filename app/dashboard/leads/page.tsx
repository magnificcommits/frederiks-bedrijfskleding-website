import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { env, isLeadsDbConfigured } from '@/lib/env';
import { getLeads } from '@/lib/supabase';
import { saveLeadEdit } from '../actions';
import { converteerLead } from './actions';
import AiOpvolg from './AiOpvolg';
import NavigateSelect from '@/components/dashboard/NavigateSelect';

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
type SP = { status?: string; q?: string; bron?: string };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const authed = Boolean(env.dashboardPassword) && (await cookies()).get(DASH_COOKIE)?.value === env.dashboardPassword.trim();
  if (!authed) redirect('/dashboard');
  if (!isLeadsDbConfigured) redirect('/dashboard');

  const alle = await getLeads();
  const telling = statusen.map((s) => ({ s, n: alle.filter((l) => l.status === s).length }));
  const waardeGeaccordeerd = alle.filter((l) => l.status === 'geaccordeerd').reduce((t, l) => t + (Number(l.offertewaarde) || 0), 0);
  const waardeOpen = alle.filter((l) => l.status === 'nieuw' || l.status === 'offerte').reduce((t, l) => t + (Number(l.offertewaarde) || 0), 0);
  const bronnen = Array.from(new Set(alle.map((l) => l.bron).filter(Boolean))) as string[];

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
  const terug = `/dashboard/leads${qs.toString() ? `?${qs}` : ''}`;

  // Param-string voor NavigateSelect: de overige actieve filters reizen mee, gevolgd door de te zetten sleutel.
  // NavigateSelect bouwt `${basePath}?${param}=<waarde>`, dus we leveren de carry-over params hier mee.
  // Bij keuze "Alle" (lege waarde) navigeert NavigateSelect naar basePath en wordt dit filter gewist.
  const statusBehalveParam = (sleutel: 'status' | 'bron') => {
    const carry: string[] = [];
    if (sleutel !== 'status' && sp.status) carry.push(`status=${encodeURIComponent(sp.status)}`);
    if (sleutel !== 'bron' && sp.bron) carry.push(`bron=${encodeURIComponent(sp.bron)}`);
    if (sp.q) carry.push(`q=${encodeURIComponent(sp.q)}`);
    return [...carry, sleutel].join('&');
  };

  return (
    <main className="container-x py-12">
      <h1 className="font-display text-3xl font-extrabold text-ink-900">Leads</h1>
      <p className="mt-1 text-sm text-warm">Aanvragen vanuit de website en andere kanalen. Een gewonnen lead zet je met een klik om naar een klant.</p>

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

      <div className="mt-6 flex flex-wrap items-end gap-3">
        {/* De select-filters navigeren automatisch (geen aparte "Filter"-knop meer); de zoekterm en het
            andere filter reizen mee via param-injectie in NavigateSelect. Op "Alle" wordt dat filter gewist. */}
        <div>
          <label className="block text-xs font-semibold text-warm">Status</label>
          <NavigateSelect
            basePath="/dashboard/leads"
            param={statusBehalveParam('status')}
            value={sp.status ?? ''}
            placeholder="Alle"
            className="mt-1 rounded-md border border-line px-3 py-2 text-sm"
            options={statusen.map((s) => ({ value: s, label: s }))}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-warm">Herkomst</label>
          <NavigateSelect
            basePath="/dashboard/leads"
            param={statusBehalveParam('bron')}
            value={sp.bron ?? ''}
            placeholder="Alle"
            className="mt-1 max-w-[14rem] rounded-md border border-line px-3 py-2 text-sm"
            options={bronnen.map((b) => ({ value: b, label: b.length > 40 ? b.slice(0, 40) + '...' : b }))}
          />
        </div>
        {/* Zoeken blijft een tekstveld met submit; status en bron reizen mee als hidden velden. */}
        <form method="get" className="flex items-end gap-3">
          <div>
            <label className="block text-xs font-semibold text-warm">Zoek (naam, bedrijf, e-mail)</label>
            <input name="q" defaultValue={sp.q ?? ''} placeholder="zoeken" className="mt-1 rounded-md border border-line px-3 py-2 text-sm" />
          </div>
          {sp.status && <input type="hidden" name="status" value={sp.status} />}
          {sp.bron && <input type="hidden" name="bron" value={sp.bron} />}
          <button type="submit" className="rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">Zoeken</button>
        </form>
        {(sp.status || sp.bron || sp.q) && <Link href="/dashboard/leads" className="py-2 text-sm font-semibold text-warm hover:text-ink-800">Wis filters</Link>}
      </div>

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
                    <div className="w-56 rounded-lg border border-line bg-mist p-3">
                      <form action={saveLeadEdit} className="flex flex-col gap-2.5">
                        <input type="hidden" name="id" value={l.id} />
                        <input type="hidden" name="terug" value={terug} />
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="block text-[11px] font-semibold uppercase tracking-wide text-warm">Status</label>
                            <select name="status" defaultValue={l.status} className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-xs">
                              {statusen.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                          <div className="w-24">
                            <label className="block text-[11px] font-semibold uppercase tracking-wide text-warm">Bedrag</label>
                            <input name="offertewaarde" defaultValue={l.offertewaarde ?? ''} inputMode="decimal" placeholder="bedrag" className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-xs" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold uppercase tracking-wide text-warm">Notitie</label>
                          <input name="notitie" defaultValue={l.notitie ?? ''} placeholder="notitie" className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-xs" />
                        </div>
                        <button type="submit" className="w-full rounded-md bg-ink-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-ink-800">Opslaan</button>
                      </form>
                      <form action={converteerLead} className="mt-3 border-t border-line pt-3">
                        <input type="hidden" name="id" value={l.id} />
                        <button type="submit" className="text-xs font-semibold text-amber-700 hover:text-amber-800">Converteer naar klant</button>
                      </form>
                      <AiOpvolg
                        naam={l.name}
                        bedrijf={l.company ?? ''}
                        branche={l.branche ?? ''}
                        bericht={l.bericht ?? ''}
                        status={l.status}
                      />
                    </div>
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
