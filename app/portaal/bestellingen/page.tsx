import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { isPortalConfigured } from '@/lib/env';
import { getPortaalUser, getMijnOrganisatie } from '@/lib/portaal/queries';
import { getMijnToegang } from '@/lib/portaal/team';
import { getMijnOrders, leesbareStatus, leesbareGoedkeuring } from '@/lib/portaal/orders';
import PortaalNav from '../PortaalNav';

export const metadata: Metadata = { title: 'Mijn bestellingen', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const datum = (s: string | null) =>
  s ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(s)) : '';
const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

function regelDetail(maat: string | null, kleur: string | null): string {
  return [maat ? `maat ${maat}` : '', kleur ? `kleur ${kleur}` : ''].filter(Boolean).join(', ');
}

function StatusBadge({ status }: { status: string | null }) {
  const label = leesbareStatus(status);
  const toon =
    status === 'afgerond' || status === 'compleet_geleverd' || status === 'verzonden'
      ? 'border-green-300 bg-green-50 text-green-800'
      : status === 'geannuleerd'
        ? 'border-line bg-cream text-warm'
        : 'border-amber-300 bg-amber-50 text-amber-700';
  return <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${toon}`}>{label}</span>;
}

export default async function Bestellingen({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  if (!isPortalConfigured) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Klantportaal nog niet actief</h1>
          <p className="mt-3 text-sm text-warm">Het portaal staat nog niet aan. Neem contact op met Frederiks Bedrijfskleding.</p>
        </div>
      </main>
    );
  }

  const user = await getPortaalUser();
  if (!user) redirect('/portaal/login');

  const org = await getMijnOrganisatie();
  if (!org) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Je account is nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Je bent ingelogd als {user.email}, maar dit adres hangt nog niet aan een bedrijf. Neem contact op met Frederiks Bedrijfskleding.</p>
        </div>
      </main>
    );
  }

  const sp = await searchParams;
  const [orders, toegang] = await Promise.all([getMijnOrders(), getMijnToegang()]);

  return (
    <main className="container-x py-12">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">Klantportaal</p>
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Mijn bestellingen</h1>
      </div>
      <PortaalNav rol={toegang.rol} actief="/portaal/bestellingen" />

      {sp?.ok && (
        <div className="mt-6 rounded-xl border border-green-300 bg-green-50 p-4 text-sm text-green-800">
          Je bestelling is geplaatst. Je vindt hem hieronder terug.
        </div>
      )}

      {orders.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-line bg-white p-8 text-center shadow-soft">
          <p className="text-sm text-warm">Je hebt nog geen bestellingen.</p>
          <Link href="/portaal/webshop" className="btn-primary mt-5 inline-block">Kleding bestellen</Link>
        </div>
      ) : (
        <div className="mt-8 space-y-5">
          {orders.map((o) => (
            <div key={o.id} className="rounded-2xl border border-line bg-white p-6 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink-900">{datum(o.besteldatum ?? o.created_at)}</p>
                  {o.ordernummer != null && <p className="text-xs text-warm">Bestelling #{o.ordernummer}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={o.status} />
                  {o.bedrag != null && <span className="text-sm font-semibold text-ink-900">{euro(Number(o.bedrag))}</span>}
                </div>
              </div>

              {(o.medewerker_naam || o.goedkeuring_status) && (
                <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-warm">
                  {o.medewerker_naam && <span>Voor {o.medewerker_naam}</span>}
                  {o.goedkeuring_status && <span>{leesbareGoedkeuring(o.goedkeuring_status)}</span>}
                </p>
              )}

              {o.regels.length > 0 ? (
                <ul className="mt-4 divide-y divide-line text-sm">
                  {o.regels.map((r) => {
                    const detail = regelDetail(r.maat, r.kleur);
                    return (
                      <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                        <span className="text-ink-800">
                          {r.item_naam}
                          {detail ? <span className="text-warm"> ({detail})</span> : null}
                        </span>
                        <span className="font-semibold text-ink-900">{r.aantal}x</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-warm">Geen regels bij deze bestelling.</p>
              )}

              {o.notitie && (
                <p className="mt-4 rounded-lg bg-cream px-4 py-3 text-sm text-warm"><span className="font-semibold text-ink-800">Opmerking:</span> {o.notitie}</p>
              )}

              {o.status === 'verzonden' && (o.vervoerder || o.track_trace_code) && (
                <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                  {o.vervoerder && <p><span className="font-semibold">Vervoerder:</span> {o.vervoerder}</p>}
                  {o.track_trace_code && <p className="mt-1"><span className="font-semibold">Track en trace:</span> {o.track_trace_code}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
