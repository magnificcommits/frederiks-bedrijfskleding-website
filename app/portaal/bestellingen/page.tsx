import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { isPortalConfigured } from '@/lib/env';
import { getPortaalUser, getMijnOrganisatie } from '@/lib/portaal/queries';
import { getMijnToegang } from '@/lib/portaal/team';
import { getMijnOrders } from '@/lib/portaal/orders';
import PortaalNav from '../PortaalNav';
import { getVertaler } from '@/lib/i18n/portaal/server';
import type { Vertaler } from '@/lib/i18n/portaal/kern';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getVertaler();
  return { title: t('nav.mijnBestellingen'), robots: { index: false, follow: false } };
}
export const dynamic = 'force-dynamic';

/** Foutcodes uit herbestelActie; een andere waarde is al een (vertaalde) melding. */
const FOUTEN = {
  onbekend: 'bestellingen.foutOnbekend',
  nietgevonden: 'bestellingen.foutNietGevonden',
  geenregels: 'bestellingen.foutGeenRegels',
} as const;

function regelDetail(t: Vertaler['t'], maat: string | null, kleur: string | null): string {
  return [maat ? t('bestellingen.maatDetail', { maat }) : '', kleur ? t('bestellingen.kleurDetail', { kleur }) : ''].filter(Boolean).join(', ');
}

function StatusBadge({ status, v }: { status: string | null; v: Vertaler }) {
  const label = status ? v.status('order', status) : v.t('algemeen.onbekend');
  const toon =
    status === 'afgerond' || status === 'compleet_geleverd' || status === 'verzonden'
      ? 'border-green-300 bg-green-50 text-green-800'
      : status === 'geannuleerd'
        ? 'border-line bg-mist text-warm'
        : 'border-amber-300 bg-amber-50 text-amber-700';
  return <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${toon}`}>{label}</span>;
}

export default async function Bestellingen({ searchParams }: { searchParams: Promise<{ ok?: string; herbesteld?: string; fout?: string }> }) {
  const v = await getVertaler();
  const { t, datum } = v;
  const euro = (n: number) => v.euro(n, 0);
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

  const sp = await searchParams;
  const [orders, toegang] = await Promise.all([getMijnOrders(), getMijnToegang()]);

  return (
    <main className="container-x py-12">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">{t('algemeen.klantportaal')}</p>
        <h1 className="font-display text-3xl font-extrabold text-ink-900">{t('nav.mijnBestellingen')}</h1>
      </div>
      <PortaalNav rol={toegang.rol} actief="/portaal/bestellingen" />

      {sp?.ok && (
        <div className="mt-6 rounded-xl border border-green-300 bg-green-50 p-4 text-sm text-green-800">
          {t('bestellingen.geplaatst')}
        </div>
      )}

      {sp?.herbesteld && (
        <div className="mt-6 rounded-xl border border-green-300 bg-green-50 p-4 text-sm text-green-800">
          {t('bestellingen.herbesteld')}
        </div>
      )}

      {sp?.fout && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-700">
          {Object.prototype.hasOwnProperty.call(FOUTEN, sp.fout) ? t(FOUTEN[sp.fout as keyof typeof FOUTEN]) : sp.fout}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-line bg-white p-8 text-center shadow-soft">
          <p className="text-sm text-warm">{t('bestellingen.geenBestellingen')}</p>
          <Link href="/portaal/webshop" className="btn-primary mt-5 inline-block">{t('nav.kledingBestellen')}</Link>
        </div>
      ) : (
        <div className="mt-8 space-y-5">
          {orders.map((o) => (
            <div key={o.id} className="rounded-2xl border border-line bg-white p-6 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink-900">{datum(o.besteldatum ?? o.created_at)}</p>
                  {o.ordernummer != null && <p className="text-xs text-warm">{t('bestellingen.nummer', { nr: o.ordernummer })}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={o.status} v={v} />
                  {o.bedrag != null && <span className="text-sm font-semibold text-ink-900">{euro(Number(o.bedrag))}</span>}
                </div>
              </div>

              {(o.medewerker_naam || o.goedkeuring_status) && (
                <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-warm">
                  {o.medewerker_naam && <span>{t('bestellingen.voor', { naam: o.medewerker_naam })}</span>}
                  {o.goedkeuring_status && <span>{v.status('goedkeuring', o.goedkeuring_status)}</span>}
                </p>
              )}

              {o.regels.length > 0 ? (
                <ul className="mt-4 divide-y divide-line text-sm">
                  {o.regels.map((r) => {
                    const detail = regelDetail(t, r.maat, r.kleur);
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
                <p className="mt-4 text-sm text-warm">{t('bestellingen.geenRegels')}</p>
              )}

              {o.notitie && (
                <p className="mt-4 rounded-lg bg-mist px-4 py-3 text-sm text-warm"><span className="font-semibold text-ink-800">{t('algemeen.opmerking')}:</span> {o.notitie}</p>
              )}

              {o.status === 'verzonden' && (o.vervoerder || o.track_trace_code) && (
                <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                  {o.vervoerder && <p><span className="font-semibold">{t('bestellingen.vervoerder')}</span> {o.vervoerder}</p>}
                  {o.track_trace_code && <p className="mt-1"><span className="font-semibold">{t('bestellingen.trackTrace')}</span> {o.track_trace_code}</p>}
                </div>
              )}

              {o.regels.length > 0 && (
                <div className="mt-5 border-t border-line pt-4">
                  <Link href={`/portaal/webshop?herhaal=${o.id}`} className="btn-secondary inline-flex">
                    {t('bestellingen.bestelOpnieuw')}
                  </Link>
                  <p className="mt-2 text-xs text-warm">
                    {t('bestellingen.controleerWagen')}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
