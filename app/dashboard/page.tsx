import Link from 'next/link';
import type { Metadata } from 'next';
import { env, isLeadsDbConfigured } from '@/lib/env';
import { login } from './actions';
import { dashAuthed } from '@/lib/kms/adminClient';
import AdminLoginForm from '@/components/dashboard/AdminLoginForm';
import { getOverzicht, getVandaagSignalen, getWerklijst } from '@/lib/kms/overzicht';

export const metadata: Metadata = { title: 'Overzicht', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
function fmt(d: string) {
  try { return new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}
type SP = { fout?: string };

const badge: Record<string, string> = {
  nieuw: 'bg-amber-100 text-amber-800',
  offerte: 'bg-ink-100 text-ink-700',
  geaccordeerd: 'bg-green-100 text-green-800',
  afgewezen: 'bg-ink-100 text-ink-500',
};

/**
 * Een cijfer zonder vergelijking zegt niets. Dit zet er de vorige maand naast.
 * Bewust neutraal van kleur: groei is niet per se goed nieuws en daling niet per
 * se slecht — amber is in dit dashboard voorbehouden aan "hier moet iets gebeuren".
 */
function Delta({ nu, eerder, periode }: { nu: number; eerder: number; periode: string }) {
  if (eerder <= 0) {
    return nu > 0 ? <span className="text-[11px] text-warm">geen {periode} om mee te vergelijken</span> : null;
  }
  const pct = ((nu - eerder) / eerder) * 100;
  const pijl = pct > 0 ? '\u25b2' : pct < 0 ? '\u25bc' : '\u2013';
  return (
    <span className="text-[11px] text-warm">
      {pijl} {Math.abs(pct).toFixed(0)}% t.o.v. {periode}
    </span>
  );
}

export default async function DashboardHome({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const authed = await dashAuthed();

  if (!authed) {
    return (
      <main className="container-smal py-20">
        <div className="mx-auto max-w-sm panel p-4">
          <h1 className="dash-h1">Frederiks KMS</h1>
          <p className="mt-2 text-sm text-warm">Log in om het systeem te beheren.</p>
          {sp?.fout === 'link' && (
            <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">De inloglink werkte niet of is verlopen. Vraag hieronder een nieuwe aan.</p>
          )}
          <div className="mt-5">
            <AdminLoginForm />
            <p className="mt-2 text-xs text-warm">Voor beheerders met een eigen account.</p>
          </div>

          <div className="mt-6 border-t border-line pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Of log in met het wachtwoord</p>
            {!env.dashboardPassword && (
              <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Nog niet ingesteld. Zet <code>DASHBOARD_PASSWORD</code> in de omgevingsvariabelen.</p>
            )}
            {sp?.fout === '1' && (
              <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">Wachtwoord onjuist. Probeer het opnieuw.</p>
            )}
            <form action={login} className="mt-3">
              <input type="password" name="password" placeholder="Wachtwoord" autoComplete="current-password"
                className="w-full rounded-md border border-line bg-white px-4 py-3 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" />
              <button type="submit" className="mt-3 w-full rounded-md border border-line px-4 py-2.5 text-sm font-semibold text-ink-800 hover:bg-mist">Inloggen met wachtwoord</button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  if (!isLeadsDbConfigured) {
    return (
      <main className="container-smal py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="dash-h1">Database nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen.</p>
        </div>
      </main>
    );
  }

  const [o, signalen, werklijst] = await Promise.all([getOverzicht(), getVandaagSignalen(), getWerklijst()]);

  const nu = new Date();
  const vorigeMaand = new Date(nu.getFullYear(), nu.getMonth() - 1, 1)
    .toLocaleDateString('nl-NL', { month: 'long' });

  // Signalen: alleen tonen wat een aantal heeft. Een rij nullen is ruis.
  const signaalLijst = [
    { label: 'taken verlopen', aantal: signalen?.verlopenTaken ?? 0, href: '/dashboard/taken' },
    { label: 'orders wachten op goedkeuring', aantal: signalen?.ordersWachtGoedkeuring ?? 0, href: '/dashboard/orders?status=offerte_goedgekeurd' },
    { label: 'retouren te beoordelen', aantal: signalen?.retourenTeBeoordelen ?? 0, href: '/dashboard/retouren' },
    { label: 'facturen vervallen', aantal: signalen?.vervallenFacturen ?? 0, href: '/dashboard/facturen' },
    { label: 'producten onder minimumvoorraad', aantal: signalen?.voorraadOnderMinimum ?? 0, href: '/dashboard/voorraad' },
    { label: 'openstaande taken', aantal: signalen?.openTaken ?? 0, href: '/dashboard/taken', stil: true },
  ].filter((s) => s.aantal > 0);
  const urgent = signaalLijst.filter((s) => !s.stil);

  const kpis: { label: string; waarde: string; href: string; duiding?: React.ReactNode }[] = [
    {
      label: 'Nieuwe leads deze maand',
      waarde: String(o?.leadsDezeMaand ?? 0),
      href: '/dashboard/leads',
      duiding: <Delta nu={o?.leadsDezeMaand ?? 0} eerder={o?.leadsVorigeMaand ?? 0} periode={vorigeMaand} />,
    },
    {
      label: 'Omzet deze maand',
      waarde: euro(o?.omzetMaand ?? 0),
      href: '/dashboard/rapportages',
      duiding: <Delta nu={o?.omzetMaand ?? 0} eerder={o?.omzetVorigeMaand ?? 0} periode={vorigeMaand} />,
    },
    {
      label: 'Open orders',
      waarde: String(o?.openOrders ?? 0),
      href: '/dashboard/orders',
      duiding: (o?.ordersLangerDanTweeWeken ?? 0) > 0
        ? <span className="text-[11px] font-semibold text-amber-800">{o?.ordersLangerDanTweeWeken} langer dan 14 dagen</span>
        : <span className="text-[11px] text-warm">geen die blijft liggen</span>,
    },
    {
      label: 'Open facturen',
      waarde: euro(o?.openFacturenBedrag ?? 0),
      href: '/dashboard/facturen',
      duiding: (o?.vervallenFacturenBedrag ?? 0) > 0
        ? <span className="text-[11px] font-semibold text-amber-800">{euro(o?.vervallenFacturenBedrag ?? 0)} vervallen</span>
        : <span className="text-[11px] text-warm">niets vervallen</span>,
    },
    { label: 'Openstaande offertewaarde', waarde: euro(o?.openOffertewaarde ?? 0), href: '/dashboard/leads' },
    { label: 'Te bestellen', waarde: String(o?.teBestellen ?? 0), href: '/dashboard/inkoop' },
  ];

  return (
    <main className="container-app py-6">
      <div className="dash-kop justify-between gap-4">
        <h1 className="dash-h1">Overzicht</h1>
        <span className="text-[13px] text-warm">
          {nu.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      </div>

      {/* Signalen staan boven de cijfers: eerst wat er moet gebeuren, dan hoe het gaat. */}
      <div className="mt-4">
        {signaalLijst.length === 0 ? (
          <p className="panel px-4 py-3 text-[13px] text-warm">Niets dat op je ligt te wachten.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {signaalLijst.map((s) => (
              <Link
                key={s.label}
                href={s.href}
                className={`inline-flex items-baseline gap-2 rounded-md border px-3 py-2 transition-colors ${
                  s.stil ? 'border-line bg-white hover:bg-mist' : 'border-amber-300 bg-amber-50 hover:bg-amber-100'
                }`}
              >
                <span className={`font-display text-lg font-bold tabular-nums ${s.stil ? 'text-ink-900' : 'text-amber-900'}`}>{s.aantal}</span>
                <span className={`text-[13px] ${s.stil ? 'text-warm' : 'font-semibold text-amber-900'}`}>{s.label}</span>
              </Link>
            ))}
            {urgent.length > 0 && (
              <Link href="/dashboard/meldingen" className="knop-tekst self-center">Alle meldingen</Link>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="panel p-3.5 transition-colors hover:border-ink-300">
            <p className="text-[11px] uppercase tracking-wide text-warm">{k.label}</p>
            <p className="mt-1 font-display text-xl font-bold tabular-nums text-ink-900">{k.waarde}</p>
            {k.duiding && <p className="mt-0.5">{k.duiding}</p>}
          </Link>
        ))}
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-base font-bold text-ink-900">Loopt nu</h2>
          <Link href="/dashboard/orders" className="knop-tekst">Alle orders</Link>
        </div>
        <div className="panel mt-2">
          {werklijst.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-warm">Geen lopende orders.</p>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th className="w-20">Order</th>
                  <th>Klant</th>
                  <th>Status</th>
                  <th>Goedkeuring</th>
                  <th className="num w-28">Bedrag</th>
                  <th className="num w-28">Dagen open</th>
                </tr>
              </thead>
              <tbody>
                {werklijst.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/dashboard/orders/${r.id}`} className="rij-link tabular-nums">#{r.ordernummer ?? '—'}</Link>
                    </td>
                    <td>{r.klant || '—'}</td>
                    <td><span className="badge-rust">{r.status.replace(/_/g, ' ')}</span></td>
                    <td>
                      <span className={r.goedkeuring_status === 'wacht' ? 'badge-actie' : 'badge-rust'}>
                        {r.goedkeuring_status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="num stil">{r.bedrag != null ? euro(Number(r.bedrag)) : '—'}</td>
                    <td className="num">
                      <span className={r.dagenOpen > 14 ? 'badge-actie' : 'stil'}>{r.dagenOpen}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-base font-bold text-ink-900">Recente leads</h2>
          <Link href="/dashboard/leads" className="knop-tekst">Alle leads</Link>
        </div>
        <div className="panel mt-2">
          {(!o || o.recenteLeads.length === 0) ? (
            <p className="px-4 py-8 text-center text-[13px] text-warm">Nog geen leads.</p>
          ) : (
            <ul className="divide-y divide-line">
              {o.recenteLeads.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 px-3 py-1.5 text-[13px]">
                  <span className="min-w-0 truncate text-ink-900">{l.name}{l.company ? ` · ${l.company}` : ''}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className={`badge ${badge[l.status] ?? 'bg-ink-100 text-ink-600'}`}>{l.status}</span>
                    <span className="whitespace-nowrap text-warm">{fmt(l.created_at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
