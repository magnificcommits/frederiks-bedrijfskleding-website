import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { isPortalConfigured } from '@/lib/env';
import { getPortaalUser, getMijnOrganisatie } from '@/lib/portaal/queries';
import { getMijnToegang } from '@/lib/portaal/team';
import { getHuisstijl } from '@/lib/portaal/huisstijl';
import PortaalNav from '../PortaalNav';
import { PakketConfigurator } from '@/components/PakketConfigurator';
import { maakOntwerpAanvraag } from './actions';

export const metadata: Metadata = { title: 'Pakket ontwerpen', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function OntwerpenPage() {
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
  if (!org) redirect('/portaal');
  const toegang = await getMijnToegang();
  const huisstijl = await getHuisstijl();

  return (
    <main className="container-x py-12">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Klantportaal</p>
      <h1 className="font-display text-3xl font-extrabold text-ink-900">Pakket ontwerpen</h1>
      <PortaalNav rol={toegang.rol} actief="/portaal/ontwerpen" />

      <div className="mt-6 max-w-2xl text-sm text-warm">
        <p>Stel een nieuw pakket of een nieuwe lijn samen en zie je logo er meteen op staan. Je aanvraag komt als concept binnen bij Frederiks. Wij werken het uit tot echte producten, maten en een offerte, en nemen contact op. Routine nabestellen doe je sneller via Kleding bestellen.</p>
      </div>

      <div className="mt-8">
        <PakketConfigurator initialLogo={huisstijl?.logoUrl ?? null} portaal={{ onAanvraag: maakOntwerpAanvraag, bedrijfsnaam: org.naam }} />
      </div>
    </main>
  );
}
