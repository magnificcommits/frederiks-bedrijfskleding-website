import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { isPortalConfigured } from '@/lib/env';
import { getPortaalUser, getMijnOrganisatie, getKledinglijn } from '@/lib/portaal/queries';
import { getMijnToegang } from '@/lib/portaal/team';
import { getWachtendeOrders } from '@/lib/portaal/goedkeuringen';
import { getSpaarInstellingen, getSpaarsaldo } from '@/lib/kms/sparen';
import { formatEuro, formatGetal } from '@/lib/format';
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
  const [items, wachtend, spaarInstellingen] = await Promise.all([
    getKledinglijn(),
    magKeuren ? getWachtendeOrders() : Promise.resolve([]),
    getSpaarInstellingen(),
  ]);
  const spaarsaldo = spaarInstellingen.actief ? await getSpaarsaldo(org.id) : null;
  const spaarMijlpaal = spaarsaldo
    ? (() => {
        const tiers = [5, 10, 25, 50, 100, 250, 500];
        const huidig = spaarsaldo.euroWaarde;
        const target = tiers.find((t) => t > huidig) ?? Math.ceil((huidig + 1) / 100) * 100;
        const vorige = [0, ...tiers].filter((t) => t <= huidig).pop() ?? 0;
        const pct = Math.max(4, Math.min(100, Math.round(((huidig - vorige) / (target - vorige)) * 100)));
        return { target, pct, teGaan: Math.max(0, target - huidig) };
      })()
    : null;

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

      {spaarsaldo && spaarMijlpaal && (
        <section className="mt-8 overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-amber-50 to-white p-6 shadow-soft sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-amber-700">Jullie spaarvoordeel</p>
              <p className="mt-1 font-display text-3xl font-extrabold text-ink-900">
                {formatEuro(spaarsaldo.euroWaarde)} <span className="text-base font-bold text-warm">aan korting gespaard</span>
              </p>
              <p className="mt-1 text-sm text-warm">
                {formatGetal(spaarsaldo.saldo)} {spaarsaldo.saldo === 1 ? 'punt' : 'punten'} &middot; in te zetten op je volgende bestelling
              </p>
            </div>
            <Link href="/portaal/webshop" className="btn-primary shrink-0">Bestel en spaar door</Link>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-amber-800">Volgende mijlpaal</span>
              <span className="text-warm">{formatEuro(spaarMijlpaal.target)} korting</span>
            </div>
            <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-amber-100">
              <div className="h-3 rounded-full bg-amber-500 transition-all" style={{ width: `${spaarMijlpaal.pct}%` }} aria-hidden="true" />
            </div>
            <p className="mt-3 text-sm text-ink-700">
              Nog <strong className="text-ink-900">{formatEuro(spaarMijlpaal.teGaan)}</strong> aan korting te gaan tot de mijlpaal van {formatEuro(spaarMijlpaal.target)}. Hoe meer jullie bestellen, hoe sneller het oploopt.
            </p>
          </div>
        </section>
      )}

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
            <p className="font-display text-lg font-extrabold text-ink-900">Medewerkers</p>
            <p className="mt-1 text-sm text-warm">Personen, maten, budget en toegang op &eacute;&eacute;n plek.</p>
          </Link>
        )}
        {magKeuren && (
          <Link href="/portaal/facturen" className="rounded-2xl border border-line bg-white p-6 shadow-soft transition hover:border-amber-300">
            <p className="font-display text-lg font-extrabold text-ink-900">Facturen</p>
            <p className="mt-1 text-sm text-warm">Bekijk de facturen van jullie bedrijf.</p>
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
