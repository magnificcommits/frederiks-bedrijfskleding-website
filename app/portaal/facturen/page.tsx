import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { isPortalConfigured } from '@/lib/env';
import { getPortaalUser, getMijnOrganisatie } from '@/lib/portaal/queries';
import { getMijnToegang } from '@/lib/portaal/team';
import { getFacturenVanOrg } from '@/lib/portaal/facturen';
import PortaalNav from '../PortaalNav';

export const metadata: Metadata = { title: 'Facturen', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const datum = (s: string | null) =>
  s ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(s)) : '';
const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n || 0);

const statusLabel: Record<string, string> = {
  concept: 'Concept',
  verzonden: 'Verzonden',
  betaald: 'Betaald',
};

function StatusBadge({ status }: { status: string }) {
  const label = statusLabel[status] ?? status;
  const toon =
    status === 'betaald'
      ? 'border-green-300 bg-green-50 text-green-800'
      : status === 'verzonden'
        ? 'border-amber-300 bg-amber-50 text-amber-700'
        : 'border-line bg-cream text-warm';
  return <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${toon}`}>{label}</span>;
}

export default async function Facturen() {
  if (!isPortalConfigured) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Klantportaal nog niet actief</h1>
          <p className="mt-3 text-sm text-warm">Het portaal staat nog niet aan. Neem contact op met Frederiks Bedrijfskleding.</p>
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
          <p className="mt-3 text-sm text-warm">Je bent ingelogd als {user.email}, maar dit adres hangt nog niet aan een bedrijf. Neem contact op met Frederiks Bedrijfskleding.</p>
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
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">Klantportaal</p>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">Facturen</h1>
        </div>
        <PortaalNav rol={toegang.rol} actief="/portaal/facturen" />
        <div className="mt-8 rounded-2xl border border-line bg-white p-8 text-center shadow-soft">
          <p className="text-sm text-warm">Bedrijfsfacturen zijn alleen in te zien door een beheerder of leidinggevende. Neem contact op met de beheerder binnen je bedrijf.</p>
          <Link href="/portaal" className="btn-secondary mt-5 inline-block">Terug naar overzicht</Link>
        </div>
      </main>
    );
  }

  const facturen = await getFacturenVanOrg(org.id);

  return (
    <main className="container-x py-12">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">Klantportaal</p>
        <h1 className="font-display text-3xl font-extrabold text-ink-900">Facturen</h1>
      </div>
      <PortaalNav rol={toegang.rol} actief="/portaal/facturen" />

      {facturen.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-line bg-white p-8 text-center shadow-soft">
          <p className="text-sm text-warm">Er zijn nog geen facturen.</p>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-line bg-cream text-left text-xs font-bold uppercase tracking-[0.04em] text-warm">
                <th className="px-5 py-3">Factuurnummer</th>
                <th className="px-5 py-3">Datum</th>
                <th className="px-5 py-3 text-right">Bedrag incl.</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {facturen.map((f) => (
                <tr key={f.id}>
                  <td className="px-5 py-4 font-semibold text-ink-900">{f.factuurnummer || 'Concept'}</td>
                  <td className="px-5 py-4 text-warm">{datum(f.factuurdatum) || '-'}</td>
                  <td className="px-5 py-4 text-right font-semibold text-ink-900">{euro(Number(f.bedrag_incl) || 0)}</td>
                  <td className="px-5 py-4"><StatusBadge status={f.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
