import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { listProspectenVoorBrieven } from '@/lib/prospect/dashboard';
import { bewaarScans, listBatches, listOntvangers, takenVoor, verrijkOntvangers, type BriefBatch, type VerrijkteOntvanger } from '@/lib/prospect/briefData';
import { berekenFunnel, procent, type FunnelBewijs } from '@/lib/prospect/briefStatus';
import KpiTegel from '@/components/dashboard/overzicht/KpiTegel';
import EmptyState from '@/components/dashboard/EmptyState';
import Funnel from './_ui/Funnel';
import Opvolglijst, { type OpvolgRij } from './_ui/Opvolglijst';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Brieven met QR', robots: { index: false, follow: false } };

type Zoek = { id?: string | string[]; toon?: string; tekst?: string; f?: string; melding?: string };

const bewijs = (v: VerrijkteOntvanger): FunnelBewijs => ({ status: v.status, prospectStatus: v.prospect?.status ?? '', qrScans: v.qrScans, portaalBezoeken: v.portaalBezoeken, aanvragen: v.aanvragen });

function dag(d: string | null): string {
  if (!d) return '';
  return new Date(`${d}T12:00:00`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

/** Wat er bij een verzending nu te doen is, met de stap waar dat gebeurt. */
function volgendeStap(b: BriefBatch, aantal: number, nogTeVersturen: number, opvolgen: number): { tekst: string; stap: string; nadruk: boolean } {
  if (aantal === 0) return { tekst: 'Prospects kiezen', stap: 'ontvangers', nadruk: true };
  if (!b.geprint_op && !b.verstuurd_op) return { tekst: 'Brief afmaken en printen', stap: 'brief', nadruk: true };
  if (nogTeVersturen > 0) return { tekst: `${nogTeVersturen} als verstuurd markeren`, stap: 'volgen', nadruk: true };
  if (opvolgen > 0) return { tekst: `${opvolgen} bellen`, stap: 'volgen', nadruk: true };
  return { tekst: 'Resultaten bekijken', stap: 'volgen', nadruk: false };
}

export default async function BrievenOverzicht({ searchParams }: { searchParams: Promise<Zoek> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const sp = await searchParams;

  // Oude links (?id=...&toon=1, ook vanaf de prospectpagina) gaan naar de snelle printpagina.
  if (sp.id || sp.toon || sp.tekst || sp.f) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) for (const w of Array.isArray(v) ? v : [v]) if (w) qs.append(k, w);
    redirect(`/dashboard/prospects/brieven/snel?${qs.toString()}`);
  }

  const [{ actief, batches }, prospecten] = await Promise.all([listBatches(), listProspectenVoorBrieven()]);
  const ontvangers = actief && batches.length ? await listOntvangers({ batchIds: batches.map((b) => b.id) }) : [];
  const verrijkt = await verrijkOntvangers(ontvangers);
  await bewaarScans(verrijkt);
  const perBatch = new Map<string, VerrijkteOntvanger[]>();
  for (const v of verrijkt) perBatch.set(v.ontvanger.batch_id, [...(perBatch.get(v.ontvanger.batch_id) ?? []), v]);

  // Opvolglijst: gescand in een verzending, plus losse brieven van voor de verzendingen.
  const inBatch = new Set(verrijkt.map((v) => v.ontvanger.prospect_id));
  const warmStatus = (s: string) => !['reageerde', 'gekwalificeerd', 'klant', 'afgemeld'].includes(s);
  const gescandInBatch = verrijkt.filter((v) => v.status === 'gescand' && v.prospect && warmStatus(v.prospect.status));
  const losGescand = prospecten.filter((p) => !inBatch.has(p.id) && (p.aantal_scans ?? 0) > 0 && !p.afgemeld_op && warmStatus(p.status));
  const taken = await takenVoor([...gescandInBatch.map((v) => v.ontvanger.prospect_id), ...losGescand.map((p) => p.id)]);
  const batchNaam = new Map(batches.map((b) => [b.id, b.naam]));
  const opvolg: OpvolgRij[] = [
    ...gescandInBatch.map((v) => ({
      prospectId: v.ontvanger.prospect_id,
      ontvangerId: v.ontvanger.id,
      batchId: v.ontvanger.batch_id,
      batchNaam: batchNaam.get(v.ontvanger.batch_id) ?? null,
      bedrijfsnaam: v.prospect!.bedrijfsnaam,
      plaats: v.prospect!.plaats,
      telefoon: v.prospect!.telefoon,
      qrScans: v.qrScans,
      laatsteScan: v.laatsteScan,
      portaal: v.portaalBezoeken > 0,
      aanvraag: v.aanvragen > 0,
      taak: taken.get(v.ontvanger.prospect_id) ?? null,
    })),
    ...losGescand.map((p) => ({
      prospectId: p.id,
      ontvangerId: null,
      batchId: null,
      batchNaam: null,
      bedrijfsnaam: p.bedrijfsnaam,
      plaats: p.plaats,
      telefoon: p.telefoon,
      qrScans: p.aantal_scans ?? 0,
      laatsteScan: p.laatste_scan_op,
      portaal: false,
      aanvraag: false,
      taak: taken.get(p.id) ?? null,
    })),
  ].sort((a, b) => (b.laatsteScan ?? '').localeCompare(a.laatsteScan ?? ''));

  const totaal = berekenFunnel(verrijkt.map(bewijs));
  const losVerstuurd = prospecten.filter((p) => !inBatch.has(p.id) && p.brief_verstuurd_op).length;
  const [verstuurd, gescand, , contact, klant] = totaal;
  const metAdres = prospecten.filter((p) => !p.afgemeld_op && p.adres && p.postcode).length;
  const zonderBrief = prospecten.filter((p) => !p.afgemeld_op && p.status !== 'afgemeld' && !p.brief_verstuurd_op && !inBatch.has(p.id)).length;

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="dash-h1">Brieven met QR</h1>
          <p className="dash-sub mt-0.5">Een persoonlijke brief per prospect, met hun logo op de kleding en een QR-code. Per verzending zie je wie scande en wie je moet bellen.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/dashboard/prospects/brieven/snel" className="knop-tekst">Snel printen</Link>
          <Link href="/dashboard/prospects/brieven/scans" className="knop-stil">Alle scans</Link>
          <Link href="/dashboard/prospects/brieven/nieuw" className="knop-primair">Nieuwe verzending</Link>
        </div>
      </div>

      {!actief && (
        <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          Verzendingen, templates en statussen per brief werken zodra de migratie <code>20261004_brief_batches.sql</code> gedraaid is. Tot die tijd print je via <Link href="/dashboard/prospects/brieven/snel" className="font-semibold underline">Snel printen</Link>; scans en de opvolglijst hieronder werken al wel.
        </p>
      )}

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTegel
          label="Brieven verstuurd"
          waarde={String(verstuurd.aantal + losVerstuurd)}
          href="/dashboard/prospects/brieven/scans"
          sub={<span className="text-warm">{batches.length} {batches.length === 1 ? 'verzending' : 'verzendingen'}{losVerstuurd ? `, ${losVerstuurd} los` : ''}</span>}
        />
        <KpiTegel label="QR gescand" waarde={String(gescand.aantal + losGescand.length)} href="/dashboard/prospects/brieven/scans?gescand=ja" sub={<span className="text-warm">{procent(gescand.vanVorige)} van de verzendingen</span>} />
        <KpiTegel label="Contact of afspraak" waarde={String(contact.aantal)} href="/dashboard/prospects/brieven/scans?gescand=ja" sub={<span className="text-warm">{procent(contact.vanStart)} van verstuurd</span>} />
        <KpiTegel label="Klant geworden" waarde={String(klant.aantal)} href="/dashboard/prospects?status=klant" sub={<span className="text-warm">{procent(klant.vanStart)} van verstuurd</span>} />
      </div>

      <section className="panel mt-5 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-base font-bold text-ink-900">Gescand, nog niet gebeld <span className="chip-tel ml-1 align-middle">{opvolg.length}</span></h2>
          <p className="text-[12px] text-warm">Nieuwste scan bovenaan. Bij de eerste scan staat er al automatisch een beltaak klaar.</p>
        </div>
        <div className="mt-2">
          <Opvolglijst rijen={opvolg.slice(0, 25)} terug="/dashboard/prospects/brieven" toonBatch />
          {opvolg.length > 25 && <Link href="/dashboard/prospects/brieven/scans?gescand=ja" className="mt-2 inline-block text-[13px] font-semibold text-amber-700">Alle {opvolg.length} bekijken</Link>}
        </div>
      </section>

      <section className="mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-base font-bold text-ink-900">Verzendingen</h2>
          <p className="text-[12px] text-warm">{zonderBrief} prospects hebben nog nooit een brief gehad; {metAdres} hebben een volledig adres.</p>
        </div>
        {batches.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              titel={actief ? 'Nog geen verzendingen' : 'Verzendingen nog niet beschikbaar'}
              tekst="Een verzending is een stapel brieven die je in één keer print en op de post doet, bijvoorbeeld alle bouwbedrijven in Doetinchem. Kies de prospects, maak de brief, print en volg wie scant."
              actieHref="/dashboard/prospects/brieven/nieuw"
              actieLabel="Eerste verzending maken"
            />
          </div>
        ) : (
          <div className="panel mt-3 overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Verzending</th>
                  <th className="num">Brieven</th>
                  <th className="hidden md:table-cell">Geprint</th>
                  <th className="hidden md:table-cell">Verstuurd</th>
                  <th>Funnel</th>
                  <th className="hidden lg:table-cell">Scanratio</th>
                  <th>Nu te doen</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => {
                  const lijst = perBatch.get(b.id) ?? [];
                  const f = berekenFunnel(lijst.map(bewijs));
                  // Na het printen telt alleen wat geprint is; brieven zonder adres blijven klaargezet staan.
                  const nogTeVersturen = b.geprint_op ? lijst.filter((v) => v.status === 'geprint').length : lijst.filter((v) => v.status === 'klaargezet' || v.status === 'geprint').length;
                  const opvolgen = lijst.filter((v) => v.status === 'gescand' && v.prospect && warmStatus(v.prospect.status)).length;
                  const volgende = volgendeStap(b, lijst.length, nogTeVersturen, opvolgen);
                  return (
                    <tr key={b.id}>
                      <td>
                        <Link href={`/dashboard/prospects/brieven/${b.id}`} className="rij-link">{b.naam}</Link>
                        <span className="block text-[12px] text-warm">aangemaakt {new Date(b.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</span>
                      </td>
                      <td className="num">{lijst.length}</td>
                      <td className="stil hidden md:table-cell">{dag(b.geprint_op) || '-'}</td>
                      <td className="stil hidden md:table-cell">{dag(b.verstuurd_op) || '-'}</td>
                      <td><Funnel rijen={f} compact /></td>
                      <td className="hidden tabular-nums lg:table-cell">{f[0].aantal ? procent(f[1].vanVorige) : '-'}</td>
                      <td>
                        <Link href={`/dashboard/prospects/brieven/${b.id}?stap=${volgende.stap}`} className={volgende.nadruk ? 'knop-stil whitespace-nowrap py-1 text-[12px]' : 'text-[12px] text-warm hover:text-ink-900'}>
                          {volgende.tekst}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="border-t border-line px-3 py-2 text-[12px] text-warm">Funnel van links naar rechts: verstuurd, gescand, demo-portaal bekeken, contact, klant.</p>
          </div>
        )}
      </section>
    </main>
  );
}
