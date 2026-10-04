import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { listProspectenVoorBrieven } from '@/lib/prospect/dashboard';
import { bezoekenVoor, isPortaal, listBatches, listOntvangers, takenVoor, verrijkOntvangers } from '@/lib/prospect/briefData';
import { ONTVANGER_BADGE, ONTVANGER_LABEL, isOntvangerStatus } from '@/lib/prospect/briefStatus';
import LiveZoekveld from '@/components/dashboard/LiveZoekveld';
import UrlSelect from '../_ui/UrlSelect';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Scans van de brieven', robots: { index: false, follow: false } };

type Zoek = { gescand?: string; batch?: string; zoek?: string; sort?: string };

type ScanRij = {
  prospectId: string;
  bedrijfsnaam: string;
  plaats: string | null;
  telefoon: string | null;
  batchId: string | null;
  batchNaam: string | null;
  status: string;
  statusIsBrief: boolean;
  verstuurdOp: string | null;
  qrScans: number;
  eersteScan: string | null;
  laatsteScan: string | null;
  linkBezoeken: number;
  portaal: number;
  aanvragen: number;
  taak: { open: boolean; vervaldatum: string | null } | null;
};

function tijd(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function dag(d: string | null): string {
  if (!d) return '-';
  return new Date(`${d}T12:00:00`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

/**
 * Alle QR-codes in één lijst: welke zijn gescand en welke niet, wanneer, hoe
 * vaak en wat ze daarna bekeken. Per prospect telt de laatste brief. Brieven van
 * voor de verzendingen (los gemarkeerd als verstuurd) staan er ook in.
 */
export default async function ScansPagina({ searchParams }: { searchParams: Promise<Zoek> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const sp = await searchParams;

  const [{ actief, batches }, prospecten] = await Promise.all([listBatches(), listProspectenVoorBrieven()]);
  const ontvangers = actief && batches.length ? await listOntvangers({ batchIds: batches.map((b) => b.id) }) : [];
  const verrijkt = await verrijkOntvangers(ontvangers);
  const batchNaam = new Map(batches.map((b) => [b.id, b.naam]));

  // Per prospect de laatste brief.
  const laatste = new Map<string, (typeof verrijkt)[number]>();
  for (const v of verrijkt) {
    const oud = laatste.get(v.ontvanger.prospect_id);
    if (!oud || (v.ontvanger.verstuurd_op ?? v.ontvanger.created_at) > (oud.ontvanger.verstuurd_op ?? oud.ontvanger.created_at)) laatste.set(v.ontvanger.prospect_id, v);
  }
  const los = prospecten.filter((p) => !laatste.has(p.id) && (p.brief_verstuurd_op || (p.aantal_scans ?? 0) > 0));
  const losBezoeken = await bezoekenVoor(los.map((p) => p.id));
  const taken = await takenVoor([...laatste.keys(), ...los.map((p) => p.id)]);

  const alle: ScanRij[] = [
    ...[...laatste.values()].map((v) => ({
      prospectId: v.ontvanger.prospect_id,
      bedrijfsnaam: v.prospect?.bedrijfsnaam ?? 'Onbekend',
      plaats: v.prospect?.plaats ?? null,
      telefoon: v.prospect?.telefoon ?? null,
      batchId: v.ontvanger.batch_id,
      batchNaam: batchNaam.get(v.ontvanger.batch_id) ?? null,
      status: v.status,
      statusIsBrief: true,
      verstuurdOp: v.ontvanger.verstuurd_op,
      qrScans: v.qrScans,
      eersteScan: v.eersteScan,
      laatsteScan: v.laatsteScan,
      linkBezoeken: v.bezoeken.filter((b) => b.soort === 'link').length,
      portaal: v.portaalBezoeken,
      aanvragen: v.aanvragen,
      taak: taken.get(v.ontvanger.prospect_id) ?? null,
    })),
    ...los.map((p) => {
      const bz = losBezoeken.filter((b) => b.prospect_id === p.id);
      return {
        prospectId: p.id,
        bedrijfsnaam: p.bedrijfsnaam,
        plaats: p.plaats,
        telefoon: p.telefoon,
        batchId: null,
        batchNaam: null,
        status: p.status,
        statusIsBrief: false,
        verstuurdOp: p.brief_verstuurd_op,
        qrScans: p.aantal_scans ?? 0,
        eersteScan: p.eerste_scan_op,
        laatsteScan: p.laatste_scan_op,
        linkBezoeken: bz.filter((b) => b.soort === 'link').length,
        portaal: bz.filter(isPortaal).length,
        aanvragen: bz.filter((b) => b.soort === 'aanvraag').length,
        taak: taken.get(p.id) ?? null,
      };
    }),
  ];

  const gescand = sp.gescand === 'ja' || sp.gescand === 'nee' ? sp.gescand : '';
  const fBatch = sp.batch ?? '';
  const zoek = (sp.zoek ?? '').trim().toLowerCase();
  const rijen = alle
    .filter((r) => (gescand === 'ja' ? r.qrScans > 0 : gescand === 'nee' ? r.qrScans === 0 : true))
    .filter((r) => (fBatch === 'los' ? !r.batchId : fBatch ? r.batchId === fBatch : true))
    .filter((r) => !zoek || `${r.bedrijfsnaam} ${r.plaats ?? ''}`.toLowerCase().includes(zoek))
    .sort((a, b) => (b.laatsteScan ?? '').localeCompare(a.laatsteScan ?? '') || a.bedrijfsnaam.localeCompare(b.bedrijfsnaam, 'nl'));

  const aantalGescand = alle.filter((r) => r.qrScans > 0).length;
  const chip = (w: string, l: string, n: number) => {
    const qs = new URLSearchParams();
    if (w) qs.set('gescand', w);
    if (fBatch) qs.set('batch', fBatch);
    if (sp.zoek) qs.set('zoek', sp.zoek);
    const s = qs.toString();
    return (
      <Link href={`/dashboard/prospects/brieven/scans${s ? `?${s}` : ''}`} className={`chip ${gescand === w ? 'chip-aan' : ''}`}>
        {l}
        <span className="chip-tel">{n}</span>
      </Link>
    );
  };

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[12px] text-warm"><Link href="/dashboard/prospects/brieven" className="hover:text-ink-900">Brieven met QR</Link> / scans</p>
          <h1 className="dash-h1">Scans van de brieven</h1>
          <p className="dash-sub mt-0.5">Wie scande de QR-code, wanneer, hoe vaak en wat bekeken ze daarna. Jouw eigen scans tellen niet mee zolang je ingelogd bent.</p>
        </div>
        <Link href="/dashboard/prospects/brieven" className="knop-tekst">Terug naar verzendingen</Link>
      </div>

      <div className="dash-filter mt-5 flex flex-wrap items-end gap-3">
        <div>
          <span className="veld-label">QR-code</span>
          <div className="flex flex-wrap gap-1.5">
            {chip('', 'Alle brieven', alle.length)}
            {chip('ja', 'Gescand', aantalGescand)}
            {chip('nee', 'Nog niet gescand', alle.length - aantalGescand)}
          </div>
        </div>
        <UrlSelect
          param="batch"
          label="Verzending"
          waarde={fBatch}
          leegLabel="Alle verzendingen"
          opties={[...batches.map((b) => ({ value: b.id, label: b.naam })), ...(los.length ? [{ value: 'los', label: 'Los verstuurd (zonder verzending)' }] : [])]}
        />
        <LiveZoekveld param="zoek" label="Zoeken" placeholder="Bedrijf of plaats" breedte="w-64" />
      </div>

      <div className="panel mt-4 overflow-x-auto">
        {rijen.length === 0 ? (
          <p className="px-3 py-10 text-center text-[13px] text-warm">{alle.length === 0 ? 'Er zijn nog geen brieven verstuurd.' : 'Niets gevonden met dit filter.'}</p>
        ) : (
          <table className="tbl">
            <thead className="thead-sticky">
              <tr>
                <th>Bedrijf</th>
                <th className="hidden md:table-cell">Verzending</th>
                <th className="hidden sm:table-cell">Verstuurd</th>
                <th className="num">Scans</th>
                <th>Eerste scan</th>
                <th className="hidden md:table-cell">Laatste scan</th>
                <th className="hidden lg:table-cell">Bekeken</th>
                <th>Status</th>
                <th className="hidden lg:table-cell">Taak</th>
              </tr>
            </thead>
            <tbody>
              {rijen.map((r) => (
                <tr key={r.prospectId}>
                  <td>
                    <Link href={`/dashboard/prospects/${r.prospectId}`} className="rij-link">{r.bedrijfsnaam}</Link>
                    <span className="block text-[12px] text-warm">{[r.plaats, r.telefoon].filter(Boolean).join(' · ')}</span>
                  </td>
                  <td className="hidden md:table-cell">
                    {r.batchId ? <Link href={`/dashboard/prospects/brieven/${r.batchId}?stap=volgen`} className="text-[12px] text-warm hover:text-ink-900">{r.batchNaam}</Link> : <span className="text-[12px] text-ink-300">los</span>}
                  </td>
                  <td className="stil hidden whitespace-nowrap sm:table-cell">{dag(r.verstuurdOp)}</td>
                  <td className="num">{r.qrScans > 0 ? <span className="badge-actie">{r.qrScans}x</span> : <span className="text-ink-300">0</span>}</td>
                  <td className="whitespace-nowrap text-[12px]">{r.eersteScan ? tijd(r.eersteScan) : <span className="text-ink-300">niet gescand</span>}</td>
                  <td className="stil hidden whitespace-nowrap text-[12px] md:table-cell">{r.qrScans > 1 ? tijd(r.laatsteScan) : '-'}</td>
                  <td className="hidden lg:table-cell">
                    <span className="flex flex-wrap gap-1">
                      {r.qrScans + r.linkBezoeken > 0 && <span className="badge-rust">kennismakingspagina</span>}
                      {r.portaal > 0 && <span className="badge-actie">demo-portaal {r.portaal > 1 ? `${r.portaal}x` : ''}</span>}
                      {r.aanvragen > 0 && <span className="badge-klaar">pasdag aangevraagd</span>}
                      {r.qrScans + r.linkBezoeken + r.portaal + r.aanvragen === 0 && <span className="text-[12px] text-ink-300">-</span>}
                    </span>
                  </td>
                  <td>
                    {r.statusIsBrief && isOntvangerStatus(r.status) ? <span className={ONTVANGER_BADGE[r.status]}>{ONTVANGER_LABEL[r.status]}</span> : <span className="badge-rust">{r.status}</span>}
                  </td>
                  <td className="hidden lg:table-cell">
                    {r.taak ? <Link href="/dashboard/taken" className="text-[12px] text-warm hover:text-ink-900">{r.taak.open ? 'open' : 'afgerond'}</Link> : <span className="text-[12px] text-ink-300">-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-2 text-[12px] text-warm">
        &quot;Bekeken&quot; telt de bezoeken na het versturen. Bezoeken aan het demo-portaal worden nog niet apart bijgehouden; die kolom vult zich zodra dat wel zo is.
      </p>
    </main>
  );
}
