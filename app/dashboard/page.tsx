import Link from 'next/link';
import type { Metadata } from 'next';
import { env, isLeadsDbConfigured } from '@/lib/env';
import { login } from './actions';
import { dashAuthed } from '@/lib/kms/adminClient';
import AdminLoginForm from '@/components/dashboard/AdminLoginForm';
import { getOverzicht, getVandaagSignalen } from '@/lib/kms/overzicht';

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

export default async function DashboardHome({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const authed = await dashAuthed();

  if (!authed) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-sm rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Frederiks KMS</h1>
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
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Database nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen.</p>
        </div>
      </main>
    );
  }

  const [o, signalen] = await Promise.all([getOverzicht(), getVandaagSignalen()]);
  const oppakken = [
    {
      label: 'Openstaande taken',
      aantal: signalen?.openTaken ?? 0,
      detail: (signalen?.verlopenTaken ?? 0) > 0 ? `${signalen?.verlopenTaken} verlopen` : null,
      urgent: (signalen?.verlopenTaken ?? 0) > 0,
      href: '/dashboard/taken',
    },
    {
      label: 'Orders wachten op goedkeuring',
      aantal: signalen?.ordersWachtGoedkeuring ?? 0,
      detail: null,
      urgent: (signalen?.ordersWachtGoedkeuring ?? 0) > 0,
      href: '/dashboard/orders',
    },
    {
      label: 'Retouren te beoordelen',
      aantal: signalen?.retourenTeBeoordelen ?? 0,
      detail: null,
      urgent: (signalen?.retourenTeBeoordelen ?? 0) > 0,
      href: '/dashboard/retouren',
    },
    {
      label: 'Vervallen facturen',
      aantal: signalen?.vervallenFacturen ?? 0,
      detail: null,
      urgent: (signalen?.vervallenFacturen ?? 0) > 0,
      href: '/dashboard/facturen',
    },
  ];
  const kpis = [
    { label: 'Nieuwe leads', waarde: String(o?.nieuweLeads ?? 0), href: '/dashboard/leads' },
    { label: 'Openstaande offertewaarde', waarde: euro(o?.openOffertewaarde ?? 0), href: '/dashboard/leads' },
    { label: 'Open orders', waarde: String(o?.openOrders ?? 0), href: '/dashboard/orders' },
    { label: 'Te bestellen', waarde: String(o?.teBestellen ?? 0), href: '/dashboard/inkoop' },
    { label: 'Open facturen', waarde: euro(o?.openFacturenBedrag ?? 0), href: '/dashboard/facturen' },
    { label: 'Omzet deze maand', waarde: euro(o?.omzetMaand ?? 0), href: '/dashboard/rapportages' },
  ];

  return (
    <main className="container-x py-8">
      <h1 className="font-display text-2xl font-extrabold text-ink-900">Overzicht</h1>
      <p className="mt-0.5 text-sm text-warm">De stand van zaken in één oogopslag.</p>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="rounded-xl border border-line bg-white p-3.5 shadow-soft hover:border-amber-300">
            <p className="text-[11px] uppercase tracking-wide text-warm">{k.label}</p>
            <p className="mt-1 font-display text-xl font-extrabold text-ink-900">{k.waarde}</p>
          </Link>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-white p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-ink-900">Recente leads</h2>
            <Link href="/dashboard/leads" className="text-sm font-semibold text-amber-700 hover:text-amber-800">Alle leads</Link>
          </div>
          {(!o || o.recenteLeads.length === 0) ? (
            <p className="mt-2 text-sm text-warm">Nog geen leads.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {o.recenteLeads.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                  <span className="min-w-0 truncate text-ink-900">{l.name}{l.company ? ` · ${l.company}` : ''}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge[l.status] ?? 'bg-ink-100 text-ink-600'}`}>{l.status}</span>
                    <span className="whitespace-nowrap text-warm">{fmt(l.created_at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-line bg-white p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-ink-900">Vandaag oppakken</h2>
            <Link href="/dashboard/meldingen" className="text-sm font-semibold text-amber-700 hover:text-amber-800">Alle meldingen</Link>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {oppakken.map((b) => (
              <Link
                key={b.label}
                href={b.href}
                className={`rounded-md border px-3 py-2.5 hover:bg-mist ${b.urgent ? 'border-amber-300 bg-amber-50' : 'border-line'}`}
              >
                <span className="block font-display text-xl font-extrabold text-ink-900">{b.aantal}</span>
                <span className="mt-0.5 block text-xs font-semibold leading-tight text-ink-700">{b.label}</span>
                {b.detail && <span className="mt-0.5 block text-[11px] font-semibold text-amber-700">{b.detail}</span>}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
