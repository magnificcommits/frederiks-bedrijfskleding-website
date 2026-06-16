import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { isPortalConfigured } from '@/lib/env';
import { getPortaalUser, getMijnOrganisatie, getKledinglijn } from '@/lib/portaal/queries';
import { portaalLogout } from './actions';

export const metadata: Metadata = { title: 'Klantportaal', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

export default async function Portaal() {
  if (!isPortalConfigured) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Klantportaal nog niet actief</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>NEXT_PUBLIC_SUPABASE_URL</code> en <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in de omgevingsvariabelen om het portaal aan te zetten.</p>
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
          <p className="mt-3 text-sm text-warm">Je bent ingelogd als {user.email}, maar dit adres is nog niet aan een bedrijf gekoppeld. Neem contact op met Frederiks Bedrijfskleding.</p>
          <form action={portaalLogout} className="mt-5"><button className="text-sm font-semibold text-warm hover:text-ink-800">Uitloggen</button></form>
        </div>
      </main>
    );
  }

  const items = await getKledinglijn();

  return (
    <main className="container-x py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">Klantportaal</p>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">{org.naam}</h1>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/portaal/herbestellen" className="btn-primary">Herbestellen</Link>
          <Link href="/portaal/bestellingen" className="text-sm font-semibold text-warm hover:text-ink-800">Mijn bestellingen</Link>
          <form action={portaalLogout}><button className="text-sm font-semibold text-warm hover:text-ink-800">Uitloggen</button></form>
        </div>
      </div>

      <h2 className="mt-10 font-display text-xl font-extrabold text-ink-900">Jullie kledinglijn</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-warm">Er is nog geen kledinglijn ingesteld. Frederiks stelt deze voor je samen.</p>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((i) => (
            <div key={i.id} className="rounded-xl border border-line bg-white p-5 shadow-soft">
              <p className="font-bold text-ink-900">{i.naam}</p>
              <p className="mt-1 text-sm text-warm">{[i.merk, i.kleur].filter(Boolean).join(' · ') || 'Geen details'}</p>
              <p className="mt-1 text-xs text-warm">Logo: {i.logopositie || 'n.t.b.'}{i.techniek ? ` · ${i.techniek}` : ''}</p>
              {i.richtprijs != null && <p className="mt-2 text-sm font-semibold text-ink-700">{euro(Number(i.richtprijs))}</p>}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
