import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { PROSPECT_STATUSSEN } from '@/lib/kms/prospecten';
import { listProspectenVoorBrieven } from '@/lib/prospect/dashboard';
import { brievenVanProspecten, getBatch, listEigenTemplates, listOntvangers } from '@/lib/prospect/briefData';
import { INGEBOUWDE_TEMPLATES } from '@/lib/prospect/briefTemplates';
import { heeftAdres } from '@/lib/prospect/briefRender';
import { BRANCHE_LABELS, brancheGroep, type BrancheGroep } from '@/content/kennismaking';
import LiveZoekveld from '@/components/dashboard/LiveZoekveld';
import UrlSelect from '../_ui/UrlSelect';
import Stappen from '../_ui/Stappen';
import ProspectKiezer, { type KiesRij } from './ProspectKiezer';

export const dynamic = 'force-dynamic';
// "Logo's zoeken" loopt tot ~50 seconden.
export const maxDuration = 60;
export const metadata = { title: 'Nieuwe verzending', robots: { index: false, follow: false } };

type Zoek = {
  zoek?: string; branche?: string; plaats?: string; status?: string; adres?: string; logo?: string; brief?: string;
  batch?: string; id?: string | string[]; melding?: string; gelukt?: string; mislukt?: string; over?: string; rest?: string;
};

const BASIS = '/dashboard/prospects/brieven/nieuw';

export default async function NieuweVerzending({ searchParams }: { searchParams: Promise<Zoek> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const sp = await searchParams;

  const batchParam = sp.batch && /^[0-9a-f-]{36}$/i.test(sp.batch) ? sp.batch : null;
  const [alle, batchUit, eigen] = await Promise.all([
    listProspectenVoorBrieven(),
    batchParam ? getBatch(batchParam) : Promise.resolve(null),
    listEigenTemplates(),
  ]);
  const batch = batchUit?.batch ?? null;
  const actief = eigen.actief;
  const kandidaten = alle.filter((p) => !p.afgemeld_op && p.status !== 'afgemeld');
  const [brieven, inBatch] = await Promise.all([
    actief ? brievenVanProspecten(kandidaten.map((p) => p.id)) : Promise.resolve(new Map()),
    batch ? listOntvangers({ batchIds: [batch.id] }) : Promise.resolve([]),
  ]);
  const inDezeBatch = new Set(inBatch.map((o) => o.prospect_id));

  // Filters. Standaard: nog geen brief gehad.
  const zoek = (sp.zoek ?? '').trim().toLowerCase();
  const fBranche = (sp.branche ?? '') as BrancheGroep | '';
  const fPlaats = sp.plaats ?? '';
  const fStatus = sp.status ?? '';
  const fAdres = sp.adres === 'met' || sp.adres === 'zonder' ? sp.adres : '';
  const fLogo = sp.logo === 'met' || sp.logo === 'zonder' ? sp.logo : '';
  const fBrief = sp.brief === 'ja' || sp.brief === 'alle' ? sp.brief : 'nee';

  const heeftBrief = (id: string, verstuurd: string | null) => Boolean(verstuurd) || (brieven.get(id)?.length ?? 0) > 0;
  const gefilterd = kandidaten.filter((p) => {
    if (zoek) {
      const hooiberg = [p.bedrijfsnaam, p.contactpersoon, p.plaats, p.branche, p.email].filter(Boolean).join(' ').toLowerCase();
      if (!zoek.split(/\s+/).every((w) => hooiberg.includes(w))) return false;
    }
    if (fBranche && brancheGroep(p.branche) !== fBranche) return false;
    if (fPlaats && (p.plaats ?? '').trim().toLowerCase() !== fPlaats.toLowerCase()) return false;
    if (fStatus && p.status !== fStatus) return false;
    if (fAdres === 'met' && !heeftAdres(p)) return false;
    if (fAdres === 'zonder' && heeftAdres(p)) return false;
    if (fLogo === 'met' && !p.logo_url) return false;
    if (fLogo === 'zonder' && p.logo_url) return false;
    if (fBrief === 'nee' && heeftBrief(p.id, p.brief_verstuurd_op)) return false;
    if (fBrief === 'ja' && !heeftBrief(p.id, p.brief_verstuurd_op)) return false;
    return true;
  });

  const brancheTellingen = new Map<BrancheGroep, number>();
  for (const p of kandidaten) brancheTellingen.set(brancheGroep(p.branche), (brancheTellingen.get(brancheGroep(p.branche)) ?? 0) + 1);
  const plaatsTellingen = new Map<string, number>();
  for (const p of kandidaten) {
    const pl = (p.plaats ?? '').trim();
    if (pl) plaatsTellingen.set(pl, (plaatsTellingen.get(pl) ?? 0) + 1);
  }
  const plaatsen = [...plaatsTellingen.keys()].sort((a, b) => a.localeCompare(b, 'nl'));

  const rijen: KiesRij[] = gefilterd.map((p) => {
    const vorige = (brieven.get(p.id) ?? [])[0];
    return {
      id: p.id,
      bedrijfsnaam: p.bedrijfsnaam,
      contactpersoon: p.contactpersoon,
      plaats: p.plaats,
      branche: BRANCHE_LABELS[brancheGroep(p.branche)],
      adres: p.adres,
      postcode: p.postcode,
      heeftAdres: heeftAdres(p),
      logoUrl: p.logo_url,
      website: p.website,
      vorige: vorige ? { batchId: vorige.batchId, batchNaam: vorige.batchNaam, status: vorige.status } : null,
      briefVerstuurdOp: p.brief_verstuurd_op,
      inDezeBatch: inDezeBatch.has(p.id),
    };
  });

  const voorgekozen = (Array.isArray(sp.id) ? sp.id : sp.id ? [sp.id] : []).filter((i) => /^[0-9a-f-]{36}$/i.test(i));
  const maand = new Date().toLocaleDateString('nl-NL', { month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' });
  const standaardNaam = `Brieven ${maand}${fBranche ? `, ${BRANCHE_LABELS[fBranche]}` : ''}${fPlaats ? ` ${fPlaats}` : ''}`;

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries({ zoek: sp.zoek, branche: fBranche, plaats: fPlaats, status: fStatus, adres: fAdres, logo: fLogo, brief: sp.brief, batch: batchParam ?? '' })) if (v) qs.set(k, v);
  const terug = qs.toString() ? `${BASIS}?${qs.toString()}` : BASIS;
  const vast = batchParam ? { batch: batchParam } : undefined;

  const templates = [
    ...INGEBOUWDE_TEMPLATES.map((t) => ({ waarde: t.sleutel, label: t.naam })),
    ...eigen.templates.map((t) => ({ waarde: t.id, label: `${t.naam} (eigen)` })),
  ];

  const stapHref = (s: string) => (batch ? `/dashboard/prospects/brieven/${batch.id}?stap=${s}` : BASIS);

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="dash-h1">{batch ? `Ontvangers toevoegen aan "${batch.naam}"` : 'Nieuwe verzending'}</h1>
          <p className="dash-sub mt-0.5">Kies wie een brief krijgt. Je kunt later nog mensen toevoegen of weghalen.</p>
        </div>
        <Link href={batch ? `/dashboard/prospects/brieven/${batch.id}?stap=ontvangers` : '/dashboard/prospects/brieven'} className="knop-tekst">
          {batch ? 'Terug naar de verzending' : 'Terug naar verzendingen'}
        </Link>
      </div>

      <div className="mt-4">
        <Stappen
          actief="ontvangers"
          stappen={[
            { sleutel: 'ontvangers', label: 'Prospects kiezen', href: stapHref('ontvangers'), klaar: false },
            { sleutel: 'brief', label: 'Brief maken', href: stapHref('brief'), klaar: false },
            { sleutel: 'controle', label: 'Controleren', href: stapHref('controle'), klaar: false },
            { sleutel: 'print', label: 'Printen', href: stapHref('print'), klaar: false },
            { sleutel: 'volgen', label: 'Versturen en volgen', href: stapHref('volgen'), klaar: false },
          ]}
        />
      </div>

      {!actief && (
        <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          Verzendingen opslaan kan nog niet: de migratie <code>20261004_brief_batches.sql</code> is nog niet gedraaid. Kiezen en printen werkt wel, via de snelle printpagina.
        </p>
      )}
      {sp.melding === 'geen-keuze' && <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-[13px] text-amber-900">Kies eerst minstens één prospect.</p>}
      {sp.melding === 'opslaan-mislukt' && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-800">De verzending kon niet worden opgeslagen. Probeer het nog een keer.</p>}
      {sp.melding === 'logos' && (
        <p className="mt-4 rounded-md border border-line bg-mist px-3 py-2 text-[13px] text-ink-800" role="status">
          Logo&apos;s zoeken klaar: {Number(sp.gelukt) || 0} gevonden, {Number(sp.mislukt) || 0} niet gelukt{Number(sp.rest) ? `, ${Number(sp.rest)} nog niet aan toegekomen (klik nog een keer)` : ''}. Controleer ze even op de prospectpagina.
        </p>
      )}

      <div className="dash-filter mt-5 flex flex-wrap items-end gap-3">
        <LiveZoekveld param="zoek" label="Zoeken" placeholder="Bedrijf, contactpersoon of plaats" breedte="grow min-w-[14rem] max-w-md" vast={vast} />
        <UrlSelect
          param="branche"
          label="Branche"
          waarde={fBranche}
          leegLabel="Alle branches"
          vast={vast}
          opties={(Object.keys(BRANCHE_LABELS) as BrancheGroep[]).filter((g) => brancheTellingen.get(g)).map((g) => ({ value: g, label: `${BRANCHE_LABELS[g]} (${brancheTellingen.get(g)})` }))}
        />
        <UrlSelect param="plaats" label="Plaats" waarde={fPlaats} leegLabel="Alle plaatsen" vast={vast} opties={plaatsen.map((pl) => ({ value: pl, label: `${pl} (${plaatsTellingen.get(pl)})` }))} />
        <UrlSelect param="status" label="Status" waarde={fStatus} leegLabel="Alle statussen" vast={vast} opties={PROSPECT_STATUSSEN.filter((s) => s !== 'afgemeld').map((s) => ({ value: s, label: s }))} />
        <UrlSelect param="adres" label="Adres" waarde={fAdres} leegLabel="Alle" vast={vast} opties={[{ value: 'met', label: 'Met adres' }, { value: 'zonder', label: 'Adres ontbreekt' }]} />
        <UrlSelect param="logo" label="Logo" waarde={fLogo} leegLabel="Alle" vast={vast} opties={[{ value: 'met', label: 'Met logo' }, { value: 'zonder', label: 'Zonder logo' }]} />
        <UrlSelect param="brief" label="Eerder een brief" waarde={fBrief} vast={vast} opties={[{ value: 'nee', label: 'Nog nooit' }, { value: 'ja', label: 'Al eens gehad' }, { value: 'alle', label: 'Maakt niet uit' }]} />
        {(sp.zoek || fBranche || fPlaats || fStatus || fAdres || fLogo || sp.brief) && (
          <Link href={batchParam ? `${BASIS}?batch=${batchParam}` : BASIS} className="knop-tekst">Filters wissen</Link>
        )}
      </div>

      <div className="mt-4">
        <ProspectKiezer
          rijen={rijen}
          voorgekozen={voorgekozen}
          batch={batch ? { id: batch.id, naam: batch.naam } : null}
          actief={actief}
          templates={templates}
          standaardNaam={standaardNaam}
          terug={terug}
          totaalKandidaten={kandidaten.length}
        />
      </div>
    </main>
  );
}
