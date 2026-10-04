import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import LiveZoekveld from '@/components/dashboard/LiveZoekveld';
import StatusChips from '@/components/dashboard/StatusChips';
import EmptyState from '@/components/dashboard/EmptyState';
import { berekenStanden, laadEnSynchroniseer } from '@/lib/kms/sparenGrootboek';
import { MigratieBanner, NiveauBadge, NiveauVoortgang, datumKort, euro0, getal } from '../_ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sparen: klanten', robots: { index: false, follow: false } };

const SORTEN: Record<string, string> = {
  saldo: 'Saldo',
  omzet: 'Omzet 12 mnd',
  voortgang: 'Dichtst bij volgend niveau',
  naam: 'Naam',
};

export default async function SparenKlanten({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; niveau?: string; sort?: string; alle?: string }>;
}) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const { q = '', niveau = '', sort = 'saldo', alle = '' } = await searchParams;

  const b = await laadEnSynchroniseer();
  const basis = b.instellingen.niveauBasis;
  const alleStanden = berekenStanden(b);
  const metActiviteit = alle ? alleStanden : alleStanden.filter((s) => s.aantalOrders > 0 || s.saldo !== 0);
  const zoek = q.trim().toLowerCase();
  const gezocht = zoek ? metActiviteit.filter((s) => `${s.naam} ${s.plaats ?? ''}`.toLowerCase().includes(zoek)) : metActiviteit;

  const niveauNamen = b.niveaus.slice().sort((a, c) => a.drempel - c.drempel).map((n) => n.naam);
  const aantallen: Record<string, number> = {};
  gezocht.forEach((s) => {
    const n = s.niveau.huidig?.naam;
    if (n) aantallen[n] = (aantallen[n] ?? 0) + 1;
  });
  const rijen = (niveau ? gezocht.filter((s) => s.niveau.huidig?.naam === niveau) : gezocht).slice();
  rijen.sort((a, c) => {
    if (sort === 'naam') return a.naam.localeCompare(c.naam, 'nl');
    if (sort === 'omzet') return c.omzet12m - a.omzet12m;
    if (sort === 'voortgang') {
      const av = a.niveau.volgende ? a.niveau.voortgang : -1;
      const cv = c.niveau.volgende ? c.niveau.voortgang : -1;
      return cv - av;
    }
    return c.saldo - a.saldo || c.omzet12m - a.omzet12m;
  });

  const bewaar = { q: q || undefined, sort: sort !== 'saldo' ? sort : undefined, alle: alle || undefined };
  const sortUrl = (s: string) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (niveau) p.set('niveau', niveau);
    if (alle) p.set('alle', alle);
    if (s !== 'saldo') p.set('sort', s);
    return `/dashboard/sparen/klanten${p.toString() ? `?${p}` : ''}`;
  };
  const alleUrl = () => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (sort !== 'saldo') p.set('sort', sort);
    if (!alle) p.set('alle', '1');
    return `/dashboard/sparen/klanten${p.toString() ? `?${p}` : ''}`;
  };

  return (
    <div className="pt-5">
      <MigratieBanner toon={!b.loyaliteit} />
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <LiveZoekveld placeholder="Zoek klant of plaats" ariaLabel="Zoek klant" breedte="w-full sm:w-72" />
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-warm">
          <span>Sorteer:</span>
          {Object.entries(SORTEN).map(([k, label]) => (
            <Link key={k} href={sortUrl(k)} className={`chip ${sort === k || (k === 'saldo' && !SORTEN[sort]) ? 'chip-aan' : ''}`}>
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-3 [&_.dash-filter]:static [&_.dash-filter]:mx-0 [&_.dash-filter]:min-h-0 [&_.dash-filter]:border-0 [&_.dash-filter]:px-0 [&_.dash-filter]:py-0">
        <StatusChips
          basePath="/dashboard/sparen/klanten"
          param="niveau"
          huidig={niveau}
          statussen={niveauNamen}
          aantallen={aantallen}
          bewaar={bewaar}
          alleLabel="Alle niveaus"
        />
      </div>

      <p className="mt-2 text-[12px] text-warm">
        {alle ? 'Alle klanten, ook zonder orders.' : 'Klanten met orders of punten.'}{' '}
        <Link href={alleUrl()} className="font-semibold text-ink-800 underline-offset-2 hover:underline">
          {alle ? 'Alleen klanten met activiteit' : `Toon alle ${getal(alleStanden.length)} klanten`}
        </Link>
      </p>

      {rijen.length === 0 ? (
        <div className="mt-4">
          <EmptyState titel={zoek ? 'Geen klant gevonden' : 'Nog geen spaarders'} tekst={zoek ? `Niets gevonden voor "${q}".` : 'Zodra klanten orders met een bedrag hebben, staan ze hier met hun saldo en niveau.'} />
        </div>
      ) : (
        <div className="panel mt-3 overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Klant</th>
                <th>Niveau</th>
                <th>Op weg naar</th>
                <th className="num">Omzet 12 mnd</th>
                <th className="num">Saldo</th>
                <th className="num">Waarde</th>
                <th>Vervalt binnenkort</th>
                <th>Laatste order</th>
              </tr>
            </thead>
            <tbody>
              {rijen.map((s) => (
                <tr key={s.organisatieId}>
                  <td>
                    <Link href={`/dashboard/sparen/klanten/${s.organisatieId}`} className="rij-link">{s.naam || 'Naamloos'}</Link>
                    {s.plaats && <span className="ml-1.5 text-[11px] text-ink-400">{s.plaats}</span>}
                  </td>
                  <td><NiveauBadge niveau={s.niveau.huidig} klein /></td>
                  <td className="w-48"><NiveauVoortgang stand={s.niveau} basis={basis} compact /></td>
                  <td className="num">{euro0(s.omzet12m)}</td>
                  <td className={`num font-semibold ${s.saldo < 0 ? 'text-red-700' : 'text-ink-900'}`}>
                    {getal(s.saldo)}
                    {s.gereserveerd > 0 && <span className="block text-[10px] font-normal text-warm">{getal(s.gereserveerd)} aangevraagd</span>}
                  </td>
                  <td className="num stil">{euro0(s.euroWaarde)}</td>
                  <td className="stil">
                    {s.vervaltBinnenkort > 0 ? (
                      <span className="badge-actie">{getal(s.vervaltBinnenkort)} op {datumKort(s.vervaltOp)}</span>
                    ) : (
                      <span className="text-ink-300">-</span>
                    )}
                  </td>
                  <td className="stil whitespace-nowrap">{datumKort(s.laatsteOrder) || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
