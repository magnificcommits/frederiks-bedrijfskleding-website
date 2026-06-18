import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { isPortalConfigured } from '@/lib/env';
import { getPortaalUser, getMijnOrganisatie, getKledinglijn } from '@/lib/portaal/queries';
import { getMijnToegang } from '@/lib/portaal/team';
import { getWachtendeOrders } from '@/lib/portaal/goedkeuringen';
import { portaalLogout } from './actions';
import PortaalNav from './PortaalNav';

export const metadata: Metadata = { title: 'Klantportaal', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const euro = (n: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

const rolLabel: Record<string, string> = {
  beheerder: 'Beheerder',
  leidinggevende: 'Leidinggevende',
  medewerker: 'Medewerker',
};

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

  const toegang = await getMijnToegang();
  const magKeuren = toegang.rol === 'beheerder' || toegang.rol === 'leidinggevende';
  const [items, wachtend] = await Promise.all([
    getKledinglijn(),
    magKeuren ? getWachtendeOrders() : Promise.resolve([]),
  ]);

  return (
    <main className="container-x py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Welkom terug</h1>
          <p className="mt-1 text-sm text-warm">
            Ingelogd als {user.email}
            {toegang.rol ? ` · ${rolLabel[toegang.rol] ?? toegang.rol}` : ''}
          </p>
        </div>
        <Link href="/portaal/webshop" className="btn-primary">Kleding bestellen</Link>
      </div>

      <PortaalNav rol={toegang.rol} actief="/portaal" />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/portaal/webshop" className="rounded-2xl border border-line bg-white p-6 shadow-soft transition hover:border-amber-300">
          <p className="font-display text-lg font-extrabold text-ink-900">Kleding bestellen</p>
          <p className="mt-1 text-sm text-warm">Bestel kleding uit jullie eigen lijn.</p>
        </Link>
        <Link href="/portaal/bestellingen" className="rounded-2xl border border-line bg-white p-6 shadow-soft transition hover:border-amber-300">
          <p className="font-display text-lg font-extrabold text-ink-900">Mijn bestellingen</p>
          <p className="mt-1 text-sm text-warm">Volg de status van je bestellingen.</p>
        </Link>
        {magKeuren && (
          <Link href="/portaal/goedkeuringen" className="rounded-2xl border border-line bg-white p-6 shadow-soft transition hover:border-amber-300">
            <p className="font-display text-lg font-extrabold text-ink-900">Goedkeuringen</p>
            <p className="mt-1 text-sm text-warm">
              {wachtend.length > 0
                ? `${wachtend.length} ${wachtend.length === 1 ? 'bestelling wacht' : 'bestellingen wachten'} op je`
                : 'Geen openstaande goedkeuringen.'}
            </p>
          </Link>
        )}
        {magKeuren && (
          <Link href="/portaal/medewerkers" className="rounded-2xl border border-line bg-white p-6 shadow-soft transition hover:border-amber-300">
            <p className="font-display text-lg font-extrabold text-ink-900">Medewerkers en maten</p>
            <p className="mt-1 text-sm text-warm">Leg medewerkers, maten en budget vast.</p>
          </Link>
        )}
        {toegang.rol === 'beheerder' && (
          <Link href="/portaal/team" className="rounded-2xl border border-line bg-white p-6 shadow-soft transition hover:border-amber-300">
            <p className="font-display text-lg font-extrabold text-ink-900">Team en toegang</p>
            <p className="mt-1 text-sm text-warm">Geef collega&apos;s toegang en bepaal hun rol.</p>
          </Link>
        )}
      </div>

      <h2 className="mt-12 font-display text-xl font-extrabold text-ink-900">Jullie kledinglijn</h2>
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
