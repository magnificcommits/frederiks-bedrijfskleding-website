import Link from 'next/link';
import { redirect } from 'next/navigation';
import Drawer from '@/components/dashboard/Drawer';
import LiveZoekveld from '@/components/dashboard/LiveZoekveld';
import EmptyState from '@/components/dashboard/EmptyState';
import KpiTegel from '@/components/dashboard/overzicht/KpiTegel';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { listLeveranciersOverzicht, type LeverancierKaart } from '@/lib/kms/leveranciers';
import Logo from './Logo';
import { portaalLink } from '@/lib/kms/inkoop';
import { nieuweLeverancier } from './actions';
import LeverancierVelden from './LeverancierVelden';
import { UrlSegment } from '../voorraad/UrlKeuze';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Leveranciers', robots: { index: false, follow: false } };

const euro0 = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

type Zoek = { q?: string; weergave?: string; groep?: string; melding?: string };

function Cijfer({ label, waarde, nadruk = false }: { label: string; waarde: string; nadruk?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[11px] text-warm">{label}</dt>
      <dd className={`truncate font-display text-[15px] font-bold tabular-nums ${nadruk ? 'text-amber-700' : 'text-ink-900'}`}>{waarde}</dd>
    </div>
  );
}

function Kaart({ l, klaar }: { l: LeverancierKaart; klaar: boolean }) {
  const open = klaar ? l.openInkooporders : l.openRegels;
  const levertijd = l.gemLevertijd ?? l.levertijd_dagen;
  return (
    <Link
      href={`/dashboard/leveranciers/${l.id}`}
      className="group panel flex flex-col gap-3 p-4 transition-colors hover:border-ink-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
    >
      <div className="flex items-start gap-3">
        <Logo naam={l.naam} logo={l.logo} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center justify-between gap-2">
            <span className="truncate font-display text-[15px] font-bold text-ink-900">{l.naam}</span>
            <span aria-hidden className="text-ink-300 transition-colors group-hover:text-amber-600">&rarr;</span>
          </p>
          <p className="truncate text-[12px] text-warm">
            {l.kortingspercentage != null ? `${String(l.kortingspercentage).replace('.', ',')}% korting` : 'Geen korting bekend'}
            {l.contactpersoon ? ` · ${l.contactpersoon}` : ''}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-4 gap-2 border-t border-line pt-3">
        <Cijfer label="Producten" waarde={String(l.aantalProducten)} />
        <Cijfer label={klaar ? 'Open orders' : 'Open regels'} waarde={String(open)} nadruk={open > 0} />
        <Cijfer label="Dit jaar" waarde={l.inkoopwaardeJaar > 0 ? euro0.format(l.inkoopwaardeJaar) : '-'} />
        <Cijfer label={l.gemLevertijd != null ? 'Levertijd' : 'Levertijd*'} waarde={levertijd != null ? `${levertijd} d` : '-'} />
      </dl>
    </Link>
  );
}

export default async function LeveranciersPage({ searchParams }: { searchParams: Promise<Zoek> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const sp = await searchParams;
  const sb = kmsAdmin();

  if (!sb) {
    return (
      <main className="container-smal py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="dash-h1">Database nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Zet <code>SUPABASE_URL</code> en <code>SUPABASE_SERVICE_ROLE_KEY</code> in de omgevingsvariabelen en draai de migraties in <code>supabase/migrations</code>.</p>
          <Link href="/dashboard" className="mt-5 inline-block text-sm font-semibold text-warm hover:text-ink-800">Terug naar dashboard</Link>
        </div>
      </main>
    );
  }

  const { leveranciers: alle, inkoopordersKlaar } = await listLeveranciersOverzicht();
  const woorden = (sp.q ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const leveranciers = alle.filter((l) => {
    if (!woorden.length) return true;
    const hooi = [l.naam, l.inkoop_bij, l.contactpersoon, l.email, ...(l.merken ?? [])].join(' ').toLowerCase();
    return woorden.every((w) => hooi.includes(w));
  });
  const tabel = sp.weergave === 'tabel';
  const perPartij = sp.groep !== 'geen';

  const partijen = new Map<string, LeverancierKaart[]>();
  for (const l of leveranciers) {
    const p = perPartij ? (l.inkoop_bij?.trim() || 'Rechtstreeks') : '';
    partijen.set(p, [...(partijen.get(p) ?? []), l]);
  }
  const groepen = [...partijen.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'nl'));

  const totaalJaar = alle.reduce((t, l) => t + l.inkoopwaardeJaar, 0);
  const totaalOpen = alle.reduce((t, l) => t + (inkoopordersKlaar ? l.openInkooporders : l.openRegels), 0);
  const aantalPartijen = new Set(alle.map((l) => l.inkoop_bij?.trim() || l.naam)).size;
  const zonderContact = alle.filter((l) => !l.email && !l.contactpersoon && !l.bestelportaal_url).length;

  return (
    <main className="container-app pb-12">
      <div className="dash-kop flex flex-wrap items-center justify-between gap-3">
        <h1 className="dash-h1">Leveranciers</h1>
        <Drawer knop="Nieuwe leverancier" titel="Nieuwe leverancier" beschrijving="Eén rij per merk. Vul bij Inkoop bij de groothandel in als je het merk daar bestelt.">
          <form action={nieuweLeverancier} className="flex flex-col gap-5">
            <LeverancierVelden />
            <button type="submit" className="self-start knop-donker">Leverancier aanmaken</button>
          </form>
        </Drawer>
      </div>

      {sp.melding === 'mislukt' && (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-700">Dat is niet gelukt. Probeer het nog een keer.</p>
      )}

      <section aria-label="Kerncijfers" className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTegel label="Merken" waarde={String(alle.length)} href="/dashboard/leveranciers?weergave=tabel" sub={<span className="text-warm">bij {aantalPartijen} inkooppartijen</span>} />
        <KpiTegel
          label={inkoopordersKlaar ? 'Open inkooporders' : 'Open inkoopregels'}
          waarde={String(totaalOpen)}
          href="/dashboard/inkoop?tab=orders&status=open"
          sub={<span className="text-warm">{inkoopordersKlaar ? 'verstuurd, nog niet alles binnen' : 'besteld, nog niet binnen'}</span>}
        />
        <KpiTegel label={`Ingekocht ${new Date().getFullYear()}`} waarde={euro0.format(totaalJaar)} href="/dashboard/inkoop?tab=orders&periode=365" sub={<span className="text-warm">tegen inkoopprijs, excl. btw</span>} />
        <KpiTegel
          label="Zonder bestelgegevens"
          waarde={String(zonderContact)}
          href="/dashboard/leveranciers?weergave=tabel"
          sub={<span className={zonderContact ? 'font-semibold text-amber-800' : 'text-warm'}>{zonderContact ? 'geen mail, contact of portaal' : 'alles ingevuld'}</span>}
        />
      </section>

      <section aria-label="Filters" className="mt-5 flex flex-wrap items-end gap-3">
        <LiveZoekveld placeholder="Zoek merk, groothandel of contact" label="Zoeken" breedte="w-full sm:w-72" />
        <UrlSegment param="weergave" label="Weergave" standaard="kaarten" opties={[{ value: 'kaarten', label: 'Kaarten' }, { value: 'tabel', label: 'Tabel' }]} />
        <UrlSegment param="groep" label="Groeperen" standaard="partij" opties={[{ value: 'partij', label: 'Per inkooppartij' }, { value: 'geen', label: 'Geen' }]} />
      </section>

      {leveranciers.length === 0 ? (
        <div className="mt-5">
          <EmptyState tekst={alle.length ? 'Geen leverancier gevonden met deze zoekterm.' : 'Nog geen leveranciers. Voeg er rechtsboven een toe.'} />
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-8">
          {groepen.map(([partij, lijst]) => {
            const portaal = portaalLink(lijst.find((l) => l.bestelportaal_url)?.bestelportaal_url);
            return (
              <section key={partij || 'alle'} aria-label={partij || 'Alle leveranciers'}>
                {perPartij && (
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2">
                    <h2 className="font-display text-lg font-bold text-ink-900">
                      {partij}
                      <span className="ml-2 text-[13px] font-medium text-warm">
                        {lijst.length} {lijst.length === 1 ? 'merk' : 'merken'} ·{' '}
                        {euro0.format(lijst.reduce((t, l) => t + l.inkoopwaardeJaar, 0))} dit jaar
                      </span>
                    </h2>
                    {portaal && (
                      <a href={portaal} target="_blank" rel="noopener noreferrer" className="knop-tekst text-[12px]">
                        Bestelportaal openen
                      </a>
                    )}
                  </div>
                )}
                {tabel ? (
                  <div className="panel overflow-x-auto">
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th className="w-24"><span className="sr-only">Logo</span></th>
                          <th>Merk</th>
                          {!perPartij && <th>Inkoop bij</th>}
                          <th className="text-right">Producten</th>
                          <th className="text-right">{inkoopordersKlaar ? 'Open orders' : 'Open regels'}</th>
                          <th className="text-right">Ingekocht dit jaar</th>
                          <th className="text-right">Levertijd</th>
                          <th className="text-right">Korting</th>
                          <th>Contact</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lijst.map((l) => {
                          const open = inkoopordersKlaar ? l.openInkooporders : l.openRegels;
                          return (
                            <tr key={l.id}>
                              <td className="!py-1"><Logo naam={l.naam} logo={l.logo} grootte="h-8 w-16" /></td>
                              <td><Link href={`/dashboard/leveranciers/${l.id}`} className="rij-link">{l.naam}</Link></td>
                              {!perPartij && <td className="stil">{l.inkoop_bij ?? '-'}</td>}
                              <td className="num">{l.aantalProducten || '-'}</td>
                              <td className={`num ${open ? 'font-semibold text-amber-700' : 'stil'}`}>{open || '-'}</td>
                              <td className="num">{l.inkoopwaardeJaar > 0 ? euro0.format(l.inkoopwaardeJaar) : '-'}</td>
                              <td className="num stil">
                                {l.gemLevertijd != null ? `${l.gemLevertijd} d gemeten` : l.levertijd_dagen != null ? `${l.levertijd_dagen} d` : '-'}
                              </td>
                              <td className="num stil">{l.kortingspercentage != null ? `${String(l.kortingspercentage).replace('.', ',')}%` : '-'}</td>
                              <td className="stil">{l.contactpersoon ?? l.email ?? (l.bestelportaal_url ? 'via portaal' : '-')}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {lijst.map((l) => <Kaart key={l.id} l={l} klaar={inkoopordersKlaar} />)}
                  </div>
                )}
              </section>
            );
          })}
          {!tabel && <p className="text-[12px] text-warm">* Levertijd met sterretje is de afgesproken levertijd; zonder sterretje is hij gemeten uit ontvangen bestellingen.</p>}
        </div>
      )}
    </main>
  );
}
