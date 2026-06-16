import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { isPortalConfigured } from '@/lib/env';
import { getPortaalUser, getMijnOrganisatie } from '@/lib/portaal/queries';
import { getMijnToegang } from '@/lib/portaal/team';
import { getWachtendeOrders } from '@/lib/portaal/goedkeuringen';
import PortaalNav from '../PortaalNav';
import { keurGoed, wijsAf } from './actions';

export const metadata: Metadata = { title: 'Goedkeuringen', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const euro = (n: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n || 0);
const datum = (s: string) =>
  new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(s));

const meldingen: Record<string, string> = {
  goedgekeurd: 'De bestelling is goedgekeurd en gaat door naar inkoop.',
  afgewezen: 'De bestelling is afgewezen.',
};

export default async function Goedkeuringen({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  if (!isPortalConfigured) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Klantportaal nog niet actief</h1>
          <p className="mt-3 text-sm text-warm">Neem contact op met Frederiks Bedrijfskleding.</p>
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
          <p className="mt-3 text-sm text-warm">Je bent ingelogd als {user.email}, maar dit adres hangt nog niet aan een bedrijf.</p>
        </div>
      </main>
    );
  }

  const toegang = await getMijnToegang();
  const magKeuren = toegang.rol === 'beheerder' || toegang.rol === 'leidinggevende';

  if (!magKeuren) {
    return (
      <main className="container-x py-12">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">Klantportaal</p>
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Goedkeuringen</h1>
        <PortaalNav rol={toegang.rol} actief="/portaal/goedkeuringen" />
        <div className="mt-8 max-w-xl rounded-2xl border border-line bg-white p-6 shadow-soft">
          <p className="text-sm text-warm">
            Alleen een beheerder of leidinggevende kan bestellingen goedkeuren.
          </p>
          <Link href="/portaal" className="mt-4 inline-block text-sm font-semibold text-warm hover:text-ink-800">
            Terug naar het overzicht
          </Link>
        </div>
      </main>
    );
  }

  const sp = await searchParams;
  const melding = sp?.ok ? meldingen[sp.ok] : null;
  const orders = await getWachtendeOrders();

  return (
    <main className="container-x py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">Klantportaal</p>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">Goedkeuringen</h1>
        </div>
      </div>
      <PortaalNav rol={toegang.rol} actief="/portaal/goedkeuringen" />

      <p className="mt-6 max-w-2xl text-sm text-warm">
        Bestellingen die wachten op goedkeuring. Keur ze goed om ze door te zetten naar inkoop, of wijs ze af.
      </p>

      {melding && (
        <div className="mt-6 rounded-xl border border-green-300 bg-green-50 p-4 text-sm text-green-800">
          {melding}
        </div>
      )}

      {orders.length === 0 ? (
        <p className="mt-8 text-sm text-warm">Er staan op dit moment geen bestellingen open voor goedkeuring.</p>
      ) : (
        <div className="mt-8 space-y-5">
          {orders.map((o) => {
            const wanneer = o.besteldatum ?? o.created_at;
            return (
              <div key={o.id} className="rounded-2xl border border-line bg-white p-6 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-ink-900">
                      {o.ordernummer ? `Order ${o.ordernummer}` : 'Bestelling'}
                    </p>
                    <p className="mt-0.5 text-sm text-warm">
                      {wanneer ? datum(wanneer) : 'Onbekende datum'}
                      {o.medewerker_naam ? ` · voor ${o.medewerker_naam}` : ''}
                      {o.aangevraagd_door ? ` · aangevraagd door ${o.aangevraagd_door}` : ''}
                    </p>
                  </div>
                  <span className="font-display text-lg font-extrabold text-ink-900">
                    {euro(Number(o.bedrag) || 0)}
                  </span>
                </div>

                {o.regels.length > 0 && (
                  <div className="mt-4 overflow-x-auto border-t border-line pt-4">
                    <table className="w-full min-w-[28rem] text-sm">
                      <thead>
                        <tr className="text-left text-xs font-semibold uppercase tracking-wide text-warm">
                          <th className="pb-2 pr-4">Artikel</th>
                          <th className="pb-2 pr-4">Maat / kleur</th>
                          <th className="pb-2 pr-4 text-right">Aantal</th>
                          <th className="pb-2 text-right">Stukprijs</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {o.regels.map((r) => (
                          <tr key={r.id}>
                            <td className="py-2 pr-4 text-ink-800">{r.item_naam}</td>
                            <td className="py-2 pr-4 text-warm">
                              {[r.maat, r.kleur].filter(Boolean).join(' · ') || '-'}
                            </td>
                            <td className="py-2 pr-4 text-right font-semibold text-ink-900">{r.aantal}x</td>
                            <td className="py-2 text-right text-warm">
                              {r.stukprijs != null ? euro(Number(r.stukprijs)) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-3 border-t border-line pt-4">
                  <form action={keurGoed}>
                    <input type="hidden" name="order_id" value={o.id} />
                    <button className="btn-primary">Goedkeuren</button>
                  </form>
                  <form action={wijsAf}>
                    <input type="hidden" name="order_id" value={o.id} />
                    <button className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-mist">
                      Afwijzen
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
