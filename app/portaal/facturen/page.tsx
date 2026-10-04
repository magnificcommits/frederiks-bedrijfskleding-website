import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { isPortalConfigured } from '@/lib/env';
import { getPortaalUser, getMijnOrganisatie } from '@/lib/portaal/queries';
import { getMijnToegang } from '@/lib/portaal/team';
import { getFacturenVanOrg } from '@/lib/portaal/facturen';
import PortaalNav from '../PortaalNav';
import { getVertaler } from '@/lib/i18n/portaal/server';
import type { Vertaler } from '@/lib/i18n/portaal/kern';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getVertaler();
  return { title: t('nav.facturen'), robots: { index: false, follow: false } };
}
export const dynamic = 'force-dynamic';

function StatusBadge({ status, v }: { status: string; v: Vertaler }) {
  const label = v.status('factuur', status);
  const toon =
    status === 'betaald'
      ? 'border-green-300 bg-green-50 text-green-800'
      : status === 'verzonden'
        ? 'border-amber-300 bg-amber-50 text-amber-700'
        : 'border-line bg-mist text-warm';
  return <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${toon}`}>{label}</span>;
}

export default async function Facturen() {
  const v = await getVertaler();
  const { t, datum, euro } = v;
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
  const magInzien = toegang.rol === 'beheerder' || toegang.rol === 'leidinggevende';

  if (!magInzien) {
    return (
      <main className="container-x py-12">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">{t('algemeen.klantportaal')}</p>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">{t('nav.facturen')}</h1>
        </div>
        <PortaalNav rol={toegang.rol} actief="/portaal/facturen" />
        <div className="mt-8 rounded-2xl border border-line bg-white p-8 text-center shadow-soft">
          <p className="text-sm text-warm">{t('facturen.alleenBeheer')}</p>
          <Link href="/portaal" className="btn-secondary mt-5 inline-block">{t('algemeen.terugNaarOverzicht')}</Link>
        </div>
      </main>
    );
  }

  const facturen = await getFacturenVanOrg(org.id);

  return (
    <main className="container-x py-12">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">{t('algemeen.klantportaal')}</p>
        <h1 className="font-display text-3xl font-extrabold text-ink-900">{t('nav.facturen')}</h1>
      </div>
      <PortaalNav rol={toegang.rol} actief="/portaal/facturen" />

      {facturen.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-line bg-white p-8 text-center shadow-soft">
          <p className="text-sm text-warm">{t('facturen.geenFacturen')}</p>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-line bg-mist text-left text-xs font-bold uppercase tracking-[0.04em] text-warm">
                <th className="px-5 py-3">{t('facturen.factuurnummer')}</th>
                <th className="px-5 py-3">{t('algemeen.datum')}</th>
                <th className="px-5 py-3 text-right">{t('facturen.bedragIncl')}</th>
                <th className="px-5 py-3">{t('algemeen.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {facturen.map((f) => (
                <tr key={f.id}>
                  <td className="px-5 py-4 font-semibold text-ink-900">{f.factuurnummer || t('facturen.concept')}</td>
                  <td className="px-5 py-4 text-warm">{datum(f.factuurdatum) || '-'}</td>
                  <td className="px-5 py-4 text-right font-semibold text-ink-900">{euro(Number(f.bedrag_incl) || 0)}</td>
                  <td className="px-5 py-4"><StatusBadge status={f.status} v={v} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
