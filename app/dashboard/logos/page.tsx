import Link from 'next/link';
import { redirect } from 'next/navigation';
import Drawer from '@/components/dashboard/Drawer';
import EmptyState from '@/components/dashboard/EmptyState';
import LiveZoekveld from '@/components/dashboard/LiveZoekveld';
import AutoSubmitSelect from '@/components/dashboard/AutoSubmitSelect';
import { dashAuthed } from '@/lib/kms/adminClient';
import {
  WERKBON_LABEL,
  WERKBON_STATUSSEN,
  WERKBON_UITLEG,
  gebruikTelling,
  listAlleLogos,
  listOrganisaties,
  listWerkbonnen,
  logoBestanden,
  logoStaat,
  type LogoMetKlant,
  type WerkbonKaart as Kaart,
} from '@/lib/kms/logos';
import LogoKaart from './LogoKaart';
import NieuwLogoFormulier from './NieuwLogoFormulier';
import WerkbonKaart, { DeadlineLabel, ProefRegel, dagenTot } from './WerkbonKaart';
import Melding from './Melding';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Werkbonnen en logo’s', robots: { index: false, follow: false } };

const selectCls = 'w-full rounded-md border border-line bg-white px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';

type Zoek = {
  tab?: string;
  org?: string;
  q?: string;
  techniek?: string;
  type?: string;
  weergave?: string;
  laat?: string;
  melding?: string;
};

/** Querystring met encodeURIComponent (spaties als %20), zodat hij als terugadres geldig blijft. */
function bouwUrl(params: Record<string, string | undefined>): string {
  const delen = Object.entries(params)
    .filter(([, v]) => v)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v!)}`);
  return delen.length ? `/dashboard/logos?${delen.join('&')}` : '/dashboard/logos';
}

const BESTANDSTYPES: { waarde: string; label: string }[] = [
  { waarde: '', label: 'Alle bestanden' },
  { waarde: 'vector', label: 'Met vectorbestand' },
  { waarde: 'geen_vector', label: 'Zonder vectorbestand' },
  { waarde: 'borduur', label: 'Met borduurprogramma' },
  { waarde: 'bitmap', label: 'Alleen bitmap' },
  { waarde: 'pdf', label: 'PDF' },
];

function pastBijType(l: LogoMetKlant, type: string): boolean {
  if (!type) return true;
  const staat = logoStaat(l);
  const bestanden = logoBestanden(l);
  if (type === 'vector') return staat.heeftVector;
  if (type === 'geen_vector') return !staat.heeftVector;
  if (type === 'borduur') return staat.heeftBorduur;
  if (type === 'bitmap') return !staat.heeftVector && bestanden.some((b) => b.productie === 'bitmap');
  if (type === 'pdf') return bestanden.some((b) => b.extensie === 'pdf');
  return true;
}

export default async function ProductiePage({ searchParams }: { searchParams: Promise<Zoek> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const zp = await searchParams;
  // Oude links (?org=...) kwamen uit de logobibliotheek; die openen weer daar.
  const tab = zp.tab === 'bibliotheek' || (!zp.tab && zp.org) ? 'bibliotheek' : 'werkbonnen';
  const orgs = await listOrganisaties();

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="dash-h1">Werkbonnen en logo&apos;s</h1>
          <p className="dash-sub max-w-3xl">
            Wat er bedrukt en geborduurd moet worden, met het juiste logo, de plek en de deadline. Daaronder de logo&apos;s van alle klanten.
          </p>
        </div>
        <Drawer knop="Nieuw logo" titel="Nieuw logo" beschrijving="Upload de bestanden, of plak een link als alternatief.">
          <NieuwLogoFormulier klanten={orgs} />
        </Drawer>
      </div>

      <Melding code={zp.melding} />

      <nav aria-label="Onderdelen" className="mt-6 flex flex-wrap gap-1 border-b border-line">
        {[
          { id: 'werkbonnen', label: 'Werkbonnen', href: '/dashboard/logos' },
          { id: 'bibliotheek', label: 'Logobibliotheek', href: '/dashboard/logos?tab=bibliotheek' },
        ].map((t) => (
          <Link
            key={t.id}
            href={t.href}
            aria-current={tab === t.id ? 'page' : undefined}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${tab === t.id ? 'border-amber-600 text-ink-900' : 'border-transparent text-warm hover:text-ink-800'}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="pt-6">{tab === 'werkbonnen' ? <WerkbonnenTab zp={zp} /> : <BibliotheekTab zp={zp} orgs={orgs} />}</div>
    </main>
  );
}

/* ------------------------------------------------------------------------- */
/* Werkbonnen                                                                 */
/* ------------------------------------------------------------------------- */

async function WerkbonnenTab({ zp }: { zp: Zoek }) {
  const { kaarten: alle, tabelBestaat } = await listWerkbonnen();
  const techniek = zp.techniek === 'borduren' || zp.techniek === 'bedrukken' ? zp.techniek : '';
  const weergave = zp.weergave === 'lijst' ? 'lijst' : 'bord';
  const laat = zp.laat === '1';
  const q = (zp.q ?? '').trim().toLowerCase().replace(/^#/, '');

  const kaarten = alle.filter((k) => {
    if (techniek && !k.technieken.includes(techniek)) return false;
    if (laat && !((dagenTot(k.deadline) ?? 1) < 0 && k.status !== 'klaar')) return false;
    if (q) {
      const hooi = `${k.klant_naam} ${k.ordernummer ?? ''} ${k.artikelen.map((a) => a.naam).join(' ')} ${k.logos.map((l) => l.naam).join(' ')}`.toLowerCase();
      if (!hooi.includes(q)) return false;
    }
    return true;
  });
  const teLaat = alle.filter((k) => (dagenTot(k.deadline) ?? 1) < 0 && k.status !== 'klaar').length;
  const basis = { tab: undefined, q: zp.q, techniek, weergave: weergave === 'lijst' ? 'lijst' : undefined, laat: laat ? '1' : undefined };
  const terug = bouwUrl(basis);

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <LiveZoekveld param="q" label="Zoeken" placeholder="Klant, ordernummer, artikel of logo" breedte="w-full sm:w-80" />
          <div className="dash-filter flex flex-wrap items-center gap-1.5">
            <Link href={bouwUrl({ ...basis, techniek: undefined })} className={`chip ${!techniek ? 'chip-aan' : ''}`}>Alle technieken</Link>
            <Link href={bouwUrl({ ...basis, techniek: 'borduren' })} className={`chip ${techniek === 'borduren' ? 'chip-aan' : ''}`}>Borduren</Link>
            <Link href={bouwUrl({ ...basis, techniek: 'bedrukken' })} className={`chip ${techniek === 'bedrukken' ? 'chip-aan' : ''}`}>Bedrukken</Link>
            <Link href={bouwUrl({ ...basis, laat: laat ? undefined : '1' })} className={`chip ${laat ? 'chip-aan' : ''}`}>
              Te laat<span className="chip-tel">{teLaat}</span>
            </Link>
          </div>
        </div>
        <div className="flex gap-1" role="group" aria-label="Weergave">
          <Link href={bouwUrl({ ...basis, weergave: undefined })} aria-current={weergave === 'bord' ? 'true' : undefined} className={`chip ${weergave === 'bord' ? 'chip-aan' : ''}`}>Planbord</Link>
          <Link href={bouwUrl({ ...basis, weergave: 'lijst' })} aria-current={weergave === 'lijst' ? 'true' : undefined} className={`chip ${weergave === 'lijst' ? 'chip-aan' : ''}`}>Lijst</Link>
        </div>
      </div>

      {!tabelBestaat && (
        <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-3 text-sm text-warm">
          De planning volgt nu de orderstatus en de drukproeven. Na de database-update kun je ook een deadline zetten en zelf bepalen wanneer iets in productie gaat.
        </p>
      )}

      {alle.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            titel="Nog geen werkbonnen"
            tekst="Een werkbon ontstaat zodra je op een order een logo aan een artikel koppelt, of er een drukproef aan hangt. Open een order en kies Werkbon."
            actieHref="/dashboard/orders"
            actieLabel="Naar de orders"
          />
        </div>
      ) : kaarten.length === 0 ? (
        <div className="mt-6">
          <EmptyState titel="Niets gevonden" tekst="Geen werkbonnen met deze filters." actieHref="/dashboard/logos" actieLabel="Filters wissen" />
        </div>
      ) : weergave === 'bord' ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {WERKBON_STATUSSEN.map((s) => {
            const kolom = kaarten.filter((k) => k.status === s);
            return (
              <section key={s} aria-labelledby={`kolom-${s}`} className="flex min-w-0 flex-col rounded-xl border border-line bg-mist/60 p-2.5">
                <header className="px-1 pb-2">
                  <h2 id={`kolom-${s}`} className="flex items-center justify-between font-display text-sm font-bold text-ink-900">
                    {WERKBON_LABEL[s]}
                    <span className="chip-tel">{kolom.length}</span>
                  </h2>
                  <p className="mt-0.5 text-[11px] leading-snug text-warm">{WERKBON_UITLEG[s]}</p>
                </header>
                {kolom.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-xs text-ink-400">Leeg</p>
                ) : (
                  <ul className="flex flex-col gap-2.5">
                    {kolom.map((k) => <WerkbonKaart key={k.order_id} k={k} terug={terug} />)}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <WerkbonLijst kaarten={kaarten} />
      )}
    </section>
  );
}

function WerkbonLijst({ kaarten }: { kaarten: Kaart[] }) {
  return (
    <div className="mt-5 overflow-x-auto panel">
      <table className="tbl">
        <thead>
          <tr>
            <th>Status</th>
            <th>Klant en order</th>
            <th>Logo</th>
            <th>Artikelen</th>
            <th>Positie en techniek</th>
            <th className="text-right">Aantal</th>
            <th>Deadline</th>
            <th>Drukproef</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {kaarten.map((k) => (
            <tr key={k.order_id} className="border-b border-line align-top">
              <td className="whitespace-nowrap text-[13px] font-semibold text-ink-800">{WERKBON_LABEL[k.status]}</td>
              <td>
                <Link href={`/dashboard/klanten/${k.organisatie_id}`} className="font-semibold text-ink-900 hover:text-amber-800">{k.klant_naam}</Link>
                <Link href={`/dashboard/orders/${k.order_id}`} className="block text-[12px] text-warm hover:text-ink-800">Order {k.ordernummer != null ? `#${k.ordernummer}` : ''}</Link>
              </td>
              <td>
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded border border-line bg-mist">
                  {k.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={k.thumb} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
                  ) : null}
                </div>
              </td>
              <td className="text-[13px] text-ink-800">{k.artikelen.map((a) => `${a.aantal}x ${a.naam}`).join(', ') || '-'}</td>
              <td className="text-[13px] text-warm">
                {[k.posities.join(', '), k.technieken.join(', ')].filter(Boolean).join(' · ') || '-'}
                {k.waarschuwingen.length > 0 && <span className="mt-1 block text-[12px] font-semibold text-amber-800">{k.waarschuwingen.join(' · ')}</span>}
              </td>
              <td className="text-right tabular-nums">{k.aantal}</td>
              <td className="whitespace-nowrap text-[12px]"><DeadlineLabel k={k} /></td>
              <td className="text-[12px]"><ProefRegel k={k} /></td>
              <td className="whitespace-nowrap">
                <Link href={`/dashboard/orders/${k.order_id}/werkbon`} className="knop-stil !px-2.5 !py-1 !text-xs">Openen</Link>{' '}
                <Link href={`/dashboard/orders/${k.order_id}/werkbon?afdrukken=1`} className="knop-stil !px-2.5 !py-1 !text-xs">Afdrukken</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Logobibliotheek                                                            */
/* ------------------------------------------------------------------------- */

async function BibliotheekTab({ zp, orgs }: { zp: Zoek; orgs: { id: string; naam: string }[] }) {
  const org = zp.org && orgs.some((o) => o.id === zp.org) ? zp.org : '';
  const techniek = zp.techniek === 'borduren' || zp.techniek === 'bedrukken' ? zp.techniek : '';
  const type = BESTANDSTYPES.some((t) => t.waarde === zp.type) ? zp.type ?? '' : '';

  const alle = await listAlleLogos({ org, q: zp.q });
  const naTechniek = techniek ? alle.filter((l) => logoStaat(l).technieken.includes(techniek)) : alle;
  const logos = naTechniek.filter((l) => pastBijType(l, type));
  const zonderVector = naTechniek.filter((l) => !logoStaat(l).heeftVector).length;
  const gebruik = await gebruikTelling(logos);
  const filterActief = Boolean(zp.q || techniek || type);
  const basis = { tab: 'bibliotheek', org, q: zp.q, techniek, type };

  return (
    <section>
      <div className="panel p-4">
        <div className="flex flex-wrap items-end gap-3">
          <LiveZoekveld param="q" label="Zoeken" placeholder="Naam van het logo of de klant" breedte="w-full sm:w-72" vast={{ tab: 'bibliotheek' }} />
          <form action="/dashboard/logos" method="get" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="tab" value="bibliotheek" />
            {zp.q && <input type="hidden" name="q" value={zp.q} />}
            <label className="block min-w-[14rem]">
              <span className="veld-label">Klant</span>
              <span className="mt-1 block">
                <AutoSubmitSelect name="org" defaultValue={org} aria-label="Klant" className={selectCls} options={[{ value: '', label: 'Alle klanten' }, ...orgs.map((o) => ({ value: o.id, label: o.naam }))]} />
              </span>
            </label>
            <label className="block">
              <span className="veld-label">Techniek</span>
              <span className="mt-1 block">
                <AutoSubmitSelect
                  name="techniek"
                  defaultValue={techniek}
                  aria-label="Techniek"
                  className={selectCls}
                  options={[{ value: '', label: 'Alle technieken' }, { value: 'borduren', label: 'Borduren' }, { value: 'bedrukken', label: 'Bedrukken' }]}
                />
              </span>
            </label>
            <label className="block">
              <span className="veld-label">Bestanden</span>
              <span className="mt-1 block">
                <AutoSubmitSelect name="type" defaultValue={type} aria-label="Bestanden" className={selectCls} options={BESTANDSTYPES.map((t) => ({ value: t.waarde, label: t.label }))} />
              </span>
            </label>
            <noscript>
              <button type="submit" className="knop-stil">Filteren</button>
            </noscript>
          </form>
        </div>
        <div className="dash-filter mt-3 flex flex-wrap items-center gap-1.5">
          <Link href={bouwUrl({ ...basis, type: undefined })} className={`chip ${!type ? 'chip-aan' : ''}`}>
            Alle logo&apos;s<span className="chip-tel">{naTechniek.length}</span>
          </Link>
          <Link href={bouwUrl({ ...basis, type: 'geen_vector' })} className={`chip ${type === 'geen_vector' ? 'chip-aan' : ''}`}>
            Ontbrekend vectorbestand<span className="chip-tel">{zonderVector}</span>
          </Link>
          {filterActief && (
            <Link href={bouwUrl({ tab: 'bibliotheek', org })} className="ml-1 text-xs font-semibold text-warm underline underline-offset-2 hover:text-ink-800">Filters wissen</Link>
          )}
        </div>
      </div>

      {logos.length === 0 ? (
        <div className="mt-6">
          {filterActief || org ? (
            <EmptyState titel="Geen logo's gevonden" tekst={org && !filterActief ? 'Deze klant heeft nog geen logo. Voeg er rechtsboven een toe.' : 'Pas de filters aan of wis ze.'} />
          ) : (
            <EmptyState titel="Nog geen logo's" tekst="Voeg rechtsboven het eerste logo toe, of doe het vanaf de klantkaart." />
          )}
        </div>
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {logos.map((l) => (
            <LogoKaart key={l.id} logo={l} klantNaam={org ? null : l.organisatie_naam} gebruik={gebruik[l.id]} />
          ))}
        </ul>
      )}
    </section>
  );
}
