import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { isPortalConfigured } from '@/lib/env';
import { getPortaalUser, getMijnOrganisatie } from '@/lib/portaal/queries';
import { getMijnToegang } from '@/lib/portaal/team';
import { getWachtendeOrders, getBehandeldeOrders } from '@/lib/portaal/goedkeuringen';
import PortaalNav from '../PortaalNav';
import { keurGoed, wijsAf } from './actions';
import { getVertaler } from '@/lib/i18n/portaal/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getVertaler();
  return { title: t('nav.goedkeuringen'), robots: { index: false, follow: false } };
}
export const dynamic = 'force-dynamic';

const meldingen = {
  goedgekeurd: 'goedkeuringen.okGoedgekeurd',
  afgewezen: 'goedkeuringen.okAfgewezen',
} as const;

export default async function Goedkeuringen({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const { t, euro, datum } = await getVertaler();
  if (!isPortalConfigured) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">{t('algemeen.nietActiefTitel')}</h1>
          <p className="mt-3 text-sm text-warm">{t('algemeen.nietActiefTekst')}</p>
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
          <h1 className="font-display text-2xl font-extrabold text-ink-900">{t('algemeen.nietGekoppeldTitel')}</h1>
          <p className="mt-3 text-sm text-warm">{t('algemeen.nietGekoppeldTekst', { email: user.email ?? '' })}</p>
        </div>
      </main>
    );
  }

  const toegang = await getMijnToegang();
  const magKeuren = toegang.rol === 'beheerder' || toegang.rol === 'leidinggevende';

  if (!magKeuren) {
    return (
      <main className="container-x py-12">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">{t('algemeen.klantportaal')}</p>
        <h1 className="font-display text-3xl font-extrabold text-ink-900">{t('nav.goedkeuringen')}</h1>
        <PortaalNav rol={toegang.rol} actief="/portaal/goedkeuringen" />
        <div className="mt-8 max-w-xl rounded-2xl border border-line bg-white p-6 shadow-soft">
          <p className="text-sm text-warm">
            {t('goedkeuringen.alleenBeheer')}
          </p>
          <Link href="/portaal" className="mt-4 inline-block text-sm font-semibold text-warm hover:text-ink-800">
            {t('algemeen.terugNaarOverzicht')}
          </Link>
        </div>
      </main>
    );
  }

  const sp = await searchParams;
  const melding = sp?.ok && Object.prototype.hasOwnProperty.call(meldingen, sp.ok) ? t(meldingen[sp.ok as keyof typeof meldingen]) : null;
  const orders = await getWachtendeOrders();
  const behandeld = await getBehandeldeOrders();

  return (
    <main className="container-x py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">{t('algemeen.klantportaal')}</p>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">{t('nav.goedkeuringen')}</h1>
        </div>
      </div>
      <PortaalNav rol={toegang.rol} actief="/portaal/goedkeuringen" />

      <p className="mt-6 max-w-2xl text-sm text-warm">
        {t('goedkeuringen.intro')}
      </p>

      {melding && (
        <div className="mt-6 rounded-xl border border-green-300 bg-green-50 p-4 text-sm text-green-800">
          {melding}
        </div>
      )}

      {orders.length === 0 ? (
        <p className="mt-8 text-sm text-warm">{t('goedkeuringen.geenOpen')}</p>
      ) : (
        <div className="mt-8 space-y-5">
          {orders.map((o) => {
            const wanneer = o.besteldatum ?? o.created_at;
            return (
              <div key={o.id} className="rounded-2xl border border-line bg-white p-6 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-ink-900">
                      {o.ordernummer ? t('algemeen.order', { nr: o.ordernummer }) : t('algemeen.bestelling')}
                    </p>
                    <p className="mt-0.5 text-sm text-warm">
                      {wanneer ? datum(wanneer) : t('algemeen.onbekendeDatum')}
                      {o.medewerker_naam ? ` · ${t('goedkeuringen.voor', { naam: o.medewerker_naam })}` : ''}
                      {o.aangevraagd_door ? ` · ${t('goedkeuringen.aangevraagdDoor', { naam: o.aangevraagd_door })}` : ''}
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
                          <th className="pb-2 pr-4">{t('goedkeuringen.artikel')}</th>
                          <th className="pb-2 pr-4">{t('goedkeuringen.maatKleur')}</th>
                          <th className="pb-2 pr-4 text-right">{t('algemeen.aantal')}</th>
                          <th className="pb-2 text-right">{t('goedkeuringen.stukprijs')}</th>
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
                    <button className="btn-primary">{t('goedkeuringen.goedkeuren')}</button>
                  </form>
                  <form action={wijsAf}>
                    <input type="hidden" name="order_id" value={o.id} />
                    <button className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-mist">
                      {t('goedkeuringen.afwijzen')}
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-14 border-t border-line pt-10">
        <h2 className="font-display text-2xl font-extrabold text-ink-900">{t('goedkeuringen.behandeld')}</h2>
        <p className="mt-2 max-w-2xl text-sm text-warm">
          {t('goedkeuringen.behandeldUitleg')}
        </p>

        {behandeld.length === 0 ? (
          <p className="mt-6 text-sm text-warm">{t('goedkeuringen.nietsBehandeld')}</p>
        ) : (
          <div className="mt-6 space-y-3">
            {behandeld.map((o) => {
              const wanneer = o.besteldatum ?? o.created_at;
              const afgewezen = o.goedkeuring_status === 'afgewezen';
              return (
                <div
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4 shadow-soft"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-ink-900">
                      {o.ordernummer ? t('algemeen.order', { nr: o.ordernummer }) : t('algemeen.bestelling')}
                    </p>
                    <p className="mt-0.5 text-sm text-warm">
                      {wanneer ? datum(wanneer) : t('algemeen.onbekendeDatum')}
                      {o.medewerker_naam ? ` · ${t('goedkeuringen.voor', { naam: o.medewerker_naam })}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-display text-base font-extrabold text-ink-900">
                      {euro(Number(o.bedrag) || 0)}
                    </span>
                    <span
                      className={
                        afgewezen
                          ? 'inline-flex items-center rounded-full border border-red-300 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700'
                          : 'inline-flex items-center rounded-full border border-green-300 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700'
                      }
                    >
                      {afgewezen ? t('status.goedkeuring.afgewezen') : t('status.goedkeuring.goedgekeurd')}
                      {o.goedgekeurd_door ? ` · ${t('goedkeuringen.door', { naam: o.goedgekeurd_door })}` : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
