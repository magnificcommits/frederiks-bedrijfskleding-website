import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { isPortalConfigured } from '@/lib/env';
import { getPortaalUser, getMijnOrganisatie } from '@/lib/portaal/queries';
import { getMijnToegang } from '@/lib/portaal/team';
import { getHuisstijl } from '@/lib/portaal/huisstijl';
import PortaalNav from '../PortaalNav';
import { PakketConfigurator } from '@/components/PakketConfigurator';
import { maakOntwerpAanvraag } from './actions';
import { getVertaler } from '@/lib/i18n/portaal/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getVertaler();
  return { title: t('nav.pakketOntwerpen'), robots: { index: false, follow: false } };
}
export const dynamic = 'force-dynamic';

export default async function OntwerpenPage() {
  const { t } = await getVertaler();
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
  if (!org) redirect('/portaal');
  const toegang = await getMijnToegang();
  const huisstijl = await getHuisstijl();

  return (
    <main className="container-x py-12">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">{t('algemeen.klantportaal')}</p>
      <h1 className="font-display text-3xl font-extrabold text-ink-900">{t('nav.pakketOntwerpen')}</h1>
      <PortaalNav rol={toegang.rol} actief="/portaal/ontwerpen" />

      <div className="mt-6 max-w-2xl text-sm text-warm">
        <p>{t('ontwerpen.intro')}</p>
      </div>

      <div className="mt-8">
        <PakketConfigurator initialLogo={huisstijl?.logoUrl ?? null} portaal={{ onAanvraag: maakOntwerpAanvraag, bedrijfsnaam: org.naam }} />
      </div>
    </main>
  );
}
