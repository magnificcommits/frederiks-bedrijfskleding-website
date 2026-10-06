import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { datumNL } from '@/lib/prospect/prospect';
import {
  bewaarScans,
  briefPersonen,
  getBatch,
  listEigenTemplates,
  listOntvangers,
  takenVoor,
  verrijkOntvangers,
  type VerrijkteOntvanger,
} from '@/lib/prospect/briefData';
import { INGEBOUWDE_TEMPLATES } from '@/lib/prospect/briefTemplates';
import type { BriefOntwerp } from '@/lib/prospect/briefTypes';
import { datumLang, heeftAdres, onbekendeVelden, VOORBEELD_PERSOON } from '@/lib/prospect/briefRender';
import { berekenFunnel, ONTVANGER_STATUSSEN, procent, type OntvangerStatus } from '@/lib/prospect/briefStatus';
import { site } from '@/content/site';
import LiveZoekveld from '@/components/dashboard/LiveZoekveld';
import StatusChips from '@/components/dashboard/StatusChips';
import Drawer from '@/components/dashboard/Drawer';
import KpiTegel from '@/components/dashboard/overzicht/KpiTegel';
import VerzendKnop from '@/components/dashboard/VerzendKnop';
import BevestigKnop from '@/app/dashboard/nieuwsbrief/BevestigKnop';
import Stappen from '../_ui/Stappen';
import Funnel from '../_ui/Funnel';
import Opvolglijst, { type OpvolgRij } from '../_ui/Opvolglijst';
import BriefEditor from '../_brief/BriefEditor';
import BriefPagina from '../_brief/BriefPagina';
import PastCheck from '../_brief/PastCheck';
import PrintBalk from '../_brief/PrintBalk';
import { controleerLive, PRINT_CSS } from '../_brief/print';
import { hernoemBatchActie, markeerVerstuurdActie, verwijderBatchActie } from '../actions';
import OntvangersTabel, { type OntvangerWeergave } from './OntvangersTabel';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const metadata = { title: 'Verzending', robots: { index: false, follow: false } };

const STAPPEN = ['ontvangers', 'brief', 'controle', 'print', 'volgen'] as const;
type StapSleutel = (typeof STAPPEN)[number];
const PER_DEEL = 100;

type Zoek = { stap?: string; status?: string; zoek?: string; toon?: string; alle?: string; zonderAdres?: string; deel?: string; verstuurd?: string; geprint?: string; toegevoegd?: string; aantal?: string; melding?: string };

function dagLang(d: string | null): string {
  if (!d) return '';
  return new Date(`${d}T12:00:00`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
}

function weergave(v: VerrijkteOntvanger, taak: { open: boolean; vervaldatum: string | null } | null): OntvangerWeergave {
  const p = v.prospect;
  return {
    id: v.ontvanger.id,
    prospectId: v.ontvanger.prospect_id,
    bedrijfsnaam: p?.bedrijfsnaam ?? 'Onbekende prospect',
    contactpersoon: p?.contactpersoon ?? null,
    plaats: p?.plaats ?? null,
    telefoon: p?.telefoon ?? null,
    website: p?.website ?? null,
    adres: p?.adres ?? null,
    postcode: p?.postcode ?? null,
    heeftAdres: p ? heeftAdres(p) : false,
    logoUrl: p?.logo_url ?? null,
    status: v.status,
    verstuurdOp: v.ontvanger.verstuurd_op,
    qrScans: v.qrScans,
    eersteScan: v.eersteScan,
    laatsteScan: v.laatsteScan,
    portaal: v.portaalBezoeken,
    aanvragen: v.aanvragen,
    bezoeken: v.bezoeken,
    taak,
    afgemeld: Boolean(p?.afgemeld_op) || p?.status === 'afgemeld',
  };
}

export default async function VerzendingPagina({ params, searchParams }: { params: Promise<{ batch: string }>; searchParams: Promise<Zoek> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const { batch: batchId } = await params;
  const sp = await searchParams;

  const { actief, batch } = await getBatch(batchId);
  if (!actief || !batch) {
    return (
      <main className="container-smal py-16">
        <div className="panel mx-auto max-w-xl p-8">
          <h1 className="dash-h1">{actief ? 'Verzending niet gevonden' : 'Verzendingen zijn nog niet beschikbaar'}</h1>
          <p className="mt-3 text-sm text-warm">
            {actief
              ? 'Deze verzending bestaat niet (meer). Misschien is hij verwijderd.'
              : 'De tabellen voor verzendingen bestaan nog niet. Tot de migratie 20261004_brief_batches.sql gedraaid is, kun je brieven printen via de snelle printpagina.'}
          </p>
          <div className="mt-5 flex gap-2">
            <Link href="/dashboard/prospects/brieven" className="knop-donker">Naar verzendingen</Link>
            <Link href="/dashboard/prospects/brieven/snel" className="knop-stil">Snel printen</Link>
          </div>
        </div>
      </main>
    );
  }

  const ontvangers = await listOntvangers({ batchIds: [batch.id] });
  const verrijkt = (await verrijkOntvangers(ontvangers)).sort((a, b) => (a.prospect?.bedrijfsnaam ?? '').localeCompare(b.prospect?.bedrijfsnaam ?? '', 'nl'));
  const standaardStap: StapSleutel = ontvangers.length === 0 ? 'ontvangers' : !batch.geprint_op && !batch.verstuurd_op ? 'brief' : 'volgen';
  const stap: StapSleutel = (STAPPEN as readonly string[]).includes(sp.stap ?? '') ? (sp.stap as StapSleutel) : standaardStap;
  const ontwerp = batch.ontwerp ?? INGEBOUWDE_TEMPLATES[0].maak();
  const vandaag = datumNL(0);
  const basis = `/dashboard/prospects/brieven/${batch.id}`;
  const href = (s: StapSleutel, extra = '') => `${basis}?stap=${s}${extra}`;

  const zonderAdres = verrijkt.filter((v) => v.prospect && !heeftAdres(v.prospect));
  const zonderLogo = verrijkt.filter((v) => v.prospect && !v.prospect.logo_url);
  const nogTeVersturen = verrijkt.filter((v) => v.status === 'klaargezet' || v.status === 'geprint');
  const aantalGeprint = verrijkt.filter((v) => v.status === 'geprint').length;

  const stappen = [
    { sleutel: 'ontvangers', label: 'Prospects', href: href('ontvangers'), klaar: ontvangers.length > 0, detail: `${ontvangers.length} gekozen` },
    { sleutel: 'brief', label: 'Brief', href: href('brief'), klaar: Boolean(batch.ontwerp), detail: `${ontwerp.blokken.length} blokken` },
    { sleutel: 'controle', label: 'Controleren', href: href('controle'), klaar: Boolean(batch.geprint_op), detail: zonderAdres.length ? `${zonderAdres.length} zonder adres` : 'adressen ok' },
    { sleutel: 'print', label: 'Printen', href: href('print'), klaar: Boolean(batch.geprint_op), detail: batch.geprint_op ? dagLang(batch.geprint_op) : 'nog niet' },
    { sleutel: 'volgen', label: 'Versturen en volgen', href: href('volgen'), klaar: Boolean(batch.verstuurd_op), detail: batch.verstuurd_op ? `verstuurd ${dagLang(batch.verstuurd_op)}` : 'nog niet verstuurd' },
  ];

  return (
    <main className="container-app py-6 print:m-0 print:max-w-none print:p-0">
      {(stap === 'controle' || stap === 'print') && <style>{PRINT_CSS}</style>}

      <div className="dash-kop flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="min-w-0">
          <p className="text-[12px] text-warm">
            <Link href="/dashboard/prospects/brieven" className="hover:text-ink-900">Brieven met QR</Link> / verzending
          </p>
          <h1 className="dash-h1 truncate">{batch.naam}</h1>
          <p className="dash-sub mt-0.5">
            Aangemaakt {new Date(batch.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}
            {batch.geprint_op && ` · geprint ${dagLang(batch.geprint_op)}`}
            {batch.verstuurd_op && ` · verstuurd ${dagLang(batch.verstuurd_op)}`}
            {batch.notitie && ` · ${batch.notitie}`}
          </p>
        </div>
        <Drawer knop="Naam en notitie" titel="Verzending bewerken" knopKlasse="knop-stil" breedte="sm:max-w-lg">
          <form action={hernoemBatchActie} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="batch" value={batch.id} />
            <input type="hidden" name="terug" value={href(stap)} />
            <label>
              <span className="veld-label">Naam</span>
              <input name="naam" defaultValue={batch.naam} required maxLength={140} className="veld" />
            </label>
            <label>
              <span className="veld-label">Notitie</span>
              <textarea name="notitie" defaultValue={batch.notitie ?? ''} rows={3} className="veld" placeholder="Bijv. verstuurd met PostNL, 95 cent per brief" />
            </label>
            <button className="knop-donker self-start">Opslaan</button>
          </form>
          <form action={verwijderBatchActie} className="mt-6 border-t border-line pt-4">
            <input type="hidden" name="batch" value={batch.id} />
            <p className="text-[12px] text-warm">Verwijderen haalt de verzending en de statussen per ontvanger weg. De prospects, hun scans en taken blijven.</p>
            <BevestigKnop vraag={`Verzending "${batch.naam}" verwijderen?`} className="knop-tekst mt-2 px-0 text-red-700">Verzending verwijderen</BevestigKnop>
          </form>
        </Drawer>
      </div>

      <div className="mt-4">
        <Stappen stappen={stappen} actief={stap} />
      </div>

      {stap === 'ontvangers' && <StapOntvangers batchId={batch.id} verrijkt={verrijkt} sp={sp} vandaag={vandaag} zonderAdres={zonderAdres.length} zonderLogo={zonderLogo.length} href={href} />}

      {stap === 'brief' && <StapBrief batchId={batch.id} ontwerp={ontwerp} verrijkt={verrijkt} volgende={href('controle')} />}

      {(stap === 'controle' || stap === 'print') && (
        <StapControle batchId={batch.id} modus={stap} ontwerp={ontwerp} verrijkt={verrijkt} sp={sp} href={href} geprintOp={batch.geprint_op} vandaag={vandaag} />
      )}

      {stap === 'volgen' && (
        <StapVolgen batchId={batch.id} verrijkt={verrijkt} sp={sp} vandaag={vandaag} nogTeVersturen={nogTeVersturen.length} aantalGeprint={aantalGeprint} href={href} verstuurdOp={batch.verstuurd_op} />
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Stap 1: ontvangers                                                   */
/* ------------------------------------------------------------------ */

function StapOntvangers({ batchId, verrijkt, sp, vandaag, zonderAdres, zonderLogo, href }: {
  batchId: string; verrijkt: VerrijkteOntvanger[]; sp: Zoek; vandaag: string; zonderAdres: number; zonderLogo: number; href: (s: StapSleutel, extra?: string) => string;
}) {
  const toon = sp.toon === 'adres' || sp.toon === 'logo' ? sp.toon : '';
  const zoek = (sp.zoek ?? '').trim().toLowerCase();
  const rijen = verrijkt
    .filter((v) => (toon === 'adres' ? v.prospect && !heeftAdres(v.prospect) : toon === 'logo' ? v.prospect && !v.prospect.logo_url : true))
    .filter((v) => !zoek || `${v.prospect?.bedrijfsnaam ?? ''} ${v.prospect?.plaats ?? ''}`.toLowerCase().includes(zoek))
    .map((v) => weergave(v, null));
  const terug = href('ontvangers', `${toon ? `&toon=${toon}` : ''}${sp.zoek ? `&zoek=${encodeURIComponent(sp.zoek)}` : ''}`);
  const chip = (w: string, l: string, n: number) => (
    <Link href={href('ontvangers', w ? `&toon=${w}` : '')} className={`chip ${toon === w ? 'chip-aan' : ''}`}>
      {l}
      <span className="chip-tel">{n}</span>
    </Link>
  );
  return (
    <section className="mt-5 space-y-4">
      {sp.toegevoegd && <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-[13px] text-green-800" role="status">{Number(sp.toegevoegd) || 0} prospects toegevoegd.</p>}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <LiveZoekveld param="zoek" label="Zoeken" placeholder="Bedrijf of plaats" breedte="w-64" vast={{ stap: 'ontvangers' }} />
          <div>
            <span className="veld-label">Nakijken</span>
            <div className="flex flex-wrap gap-1.5">
              {chip('', 'Alle', verrijkt.length)}
              {chip('adres', 'Adres ontbreekt', zonderAdres)}
              {chip('logo', 'Zonder logo', zonderLogo)}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/prospects/brieven/nieuw?batch=${batchId}`} className="knop-stil">Prospects toevoegen</Link>
          <Link href={href('brief')} className="knop-primair">Verder: brief</Link>
        </div>
      </div>
      {zonderAdres > 0 && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          Bij {zonderAdres} {zonderAdres === 1 ? 'prospect' : 'prospects'} ontbreekt het adres. Klik op &quot;aanvullen&quot; in de lijst; het adres staat meestal onderaan hun website of in Google Maps. Zonder adres printen we die brief niet (tenzij je het briefhoofd &quot;zelf afgeven&quot; kiest).
        </p>
      )}
      {zonderLogo > 0 && (
        <p className="text-[12px] text-warm">{zonderLogo} zonder logo: daar zetten we de bedrijfsnaam netjes als tekst op de kleding. Dat werkt prima, maar met hun eigen logo valt de brief meer op.</p>
      )}
      <OntvangersTabel batchId={batchId} rijen={rijen} modus="ontvangers" terug={terug} vandaag={vandaag} />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Stap 2: brief                                                        */
/* ------------------------------------------------------------------ */

async function StapBrief({ batchId, ontwerp, verrijkt, volgende }: { batchId: string; ontwerp: BriefOntwerp; verrijkt: VerrijkteOntvanger[]; volgende: string }) {
  // Voorbeelden: de langste namen (die lopen het eerst over) en een paar gewone.
  const prospecten = verrijkt.map((v) => v.prospect).filter((p): p is NonNullable<typeof p> => Boolean(p));
  const lang = [...prospecten].sort((a, b) => (b.bedrijfsnaam.length + (b.contactpersoon?.length ?? 0)) - (a.bedrijfsnaam.length + (a.contactpersoon?.length ?? 0))).slice(0, 3);
  const gekozen = [...new Map([...prospecten.slice(0, 5), ...lang].map((p) => [p.id, p])).values()].slice(0, 8);
  const [personen, eigen] = await Promise.all([briefPersonen(gekozen), listEigenTemplates()]);
  return (
    <section className="mt-5">
      <BriefEditor
        batchId={batchId}
        beginOntwerp={ontwerp}
        personen={personen.length ? personen : [VOORBEELD_PERSOON]}
        eigenTemplates={eigen.templates.map((t) => ({ id: t.id, naam: t.naam, omschrijving: t.omschrijving, ontwerp: t.ontwerp }))}
        templatesActief={eigen.actief}
        datum={datumLang()}
        volgendeHref={volgende}
      />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Stap 3 en 4: controleren en printen                                  */
/* ------------------------------------------------------------------ */

async function StapControle({ batchId, modus, ontwerp, verrijkt, sp, href, geprintOp, vandaag }: {
  batchId: string; modus: 'controle' | 'print'; ontwerp: BriefOntwerp; verrijkt: VerrijkteOntvanger[]; sp: Zoek;
  href: (s: StapSleutel, extra?: string) => string; geprintOp: string | null; vandaag: string;
}) {
  const venster = ontwerp.instellingen.briefhoofd === 'venster';
  const alle = sp.alle === '1';
  const metZonderAdres = sp.zonderAdres === '1' || !venster;
  const kandidaten = verrijkt.filter((v) => v.prospect && !v.prospect.afgemeld_op && v.prospect.status !== 'afgemeld' && (alle || v.status === 'klaargezet' || v.status === 'geprint'));
  const overgeslagenAdres = kandidaten.filter((v) => v.prospect && !heeftAdres(v.prospect));
  const printbaar = kandidaten.filter((v) => metZonderAdres || (v.prospect && heeftAdres(v.prospect)));
  const delen = Math.max(1, Math.ceil(printbaar.length / PER_DEEL));
  const deel = Math.min(delen, Math.max(1, Number(sp.deel) || 1));
  const ditDeel = printbaar.slice((deel - 1) * PER_DEEL, deel * PER_DEEL);
  const [personen, live] = await Promise.all([briefPersonen(ditDeel.map((v) => v.prospect!)), controleerLive()]);
  const datum = datumLang();
  const afgemeld = verrijkt.filter((v) => v.prospect && (v.prospect.afgemeld_op || v.prospect.status === 'afgemeld')).length;
  const verder = verrijkt.length - kandidaten.length - afgemeld;
  const onbekend = [...new Set(ontwerp.blokken.flatMap((b) => onbekendeVelden(JSON.stringify(b))))];
  const extra = (o: Record<string, string>) => {
    const p = new URLSearchParams();
    if (alle) p.set('alle', '1');
    if (sp.zonderAdres === '1') p.set('zonderAdres', '1');
    for (const [k, v] of Object.entries(o)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const s = p.toString();
    return s ? `&${s}` : '';
  };

  return (
    <section className="mt-5">
      <div className="space-y-2 print:hidden">
        <div className="panel p-4">
          <h2 className="font-display text-base font-bold text-ink-900">{modus === 'controle' ? 'Nakijken voor het printen' : 'Printen'}</h2>
          <ul className="mt-3 space-y-1.5 text-[13px]">
            <li className="flex gap-2">
              <span className={live.ok ? 'badge-klaar' : 'badge bg-red-50 text-red-700'}>{live.ok ? 'ok' : 'let op'}</span>
              {live.ok ? <span>QR-codes wijzen naar {site.url.replace(/^https?:\/\//, '')}/k/… en die route werkt.</span> : <span><strong>Nog niet printen.</strong> {live.melding}</span>}
            </li>
            <li className="flex gap-2">
              <span className={overgeslagenAdres.length && venster ? 'badge-actie' : 'badge-klaar'}>{overgeslagenAdres.length && venster ? 'let op' : 'ok'}</span>
              <span>
                {printbaar.length} {printbaar.length === 1 ? 'brief' : 'brieven'} om te printen.
                {venster && overgeslagenAdres.length > 0 && !metZonderAdres && (
                  <> {overgeslagenAdres.length} zonder adres slaan we over: <Link href={href('ontvangers', '&toon=adres')} className="font-semibold text-amber-700 hover:text-amber-800">adressen aanvullen</Link> of <Link href={href(modus, extra({ zonderAdres: '1' }))} className="font-semibold text-amber-700 hover:text-amber-800">toch meeprinten</Link>.</>
                )}
                {venster && sp.zonderAdres === '1' && overgeslagenAdres.length > 0 && <> Inclusief {overgeslagenAdres.length} zonder adres (<Link href={href(modus, extra({ zonderAdres: '' }))} className="font-semibold text-amber-700">weglaten</Link>).</>}
              </span>
            </li>
            {verder > 0 && (
              <li className="flex gap-2">
                <span className="badge-rust">info</span>
                <span>
                  {verder} {verder === 1 ? 'staat' : 'staan'} al verder dan geprint en {alle ? 'worden nu toch getoond' : 'tonen we niet'}.{' '}
                  <Link href={href(modus, extra({ alle: alle ? '' : '1' }))} className="font-semibold text-amber-700 hover:text-amber-800">{alle ? 'Alleen nog niet verstuurde' : 'Alles tonen (opnieuw printen)'}</Link>
                </span>
              </li>
            )}
            {afgemeld > 0 && <li className="flex gap-2"><span className="badge-rust">info</span><span>{afgemeld} afgemeld; die krijgen geen brief.</span></li>}
            {onbekend.length > 0 && <li className="flex gap-2"><span className="badge bg-red-50 text-red-700">let op</span><span>Onbekende velden in de brief: {onbekend.join(', ')}. <Link href={href('brief')} className="font-semibold text-amber-700">Aanpassen</Link></span></li>}
            <li className="flex gap-2"><span className="badge-rust">tip</span><span>Printen op A4, marges &quot;geen&quot;, achtergrondafbeeldingen aan. Venster-envelop met het venster links. Scan na het printen één brief met je telefoon (uitgelogd), dan weet je zeker dat het werkt.</span></li>
          </ul>
          <div className="mt-3">
            <PastCheck containerId="brieven-print" totaal={personen.length} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            {modus === 'controle' ? (
              <>
                <Link href={href('print', extra({}))} className="knop-primair">Alles goed: naar printen</Link>
                <Link href={href('brief')} className="knop-stil">Brief aanpassen</Link>
              </>
            ) : (
              <PrintBalk batchId={batchId} ids={ditDeel.map((v) => v.ontvanger.id)} vandaag={vandaag} alGeprint={geprintOp} />
            )}
            {delen > 1 && (
              <nav className="flex items-center gap-1 text-[13px]" aria-label="Delen">
                <span className="text-warm">Deel</span>
                {Array.from({ length: delen }, (_, i) => (
                  <Link key={i} href={href(modus, extra({ deel: String(i + 1) }))} className={`chip ${deel === i + 1 ? 'chip-aan' : ''}`}>{i + 1}</Link>
                ))}
                <span className="text-[12px] text-warm">({PER_DEEL} per keer, anders wordt de printer traag)</span>
              </nav>
            )}
          </div>
        </div>
      </div>

      {personen.length === 0 ? (
        <p className="mt-6 rounded-md border border-dashed border-line bg-mist px-3 py-10 text-center text-[13px] text-warm print:hidden">Er is niets om te printen.</p>
      ) : (
        <div id="brieven-print" className="mt-5 flex flex-col items-center gap-6 bg-mist py-6 print:bg-white">
          {personen.map((p) => (
            <BriefPagina key={p.id} ontwerp={ontwerp} persoon={p} datum={datum} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Stap 5: versturen en volgen                                          */
/* ------------------------------------------------------------------ */

async function StapVolgen({ batchId, verrijkt, sp, vandaag, nogTeVersturen, aantalGeprint, href, verstuurdOp }: {
  batchId: string; verrijkt: VerrijkteOntvanger[]; sp: Zoek; vandaag: string; nogTeVersturen: number; aantalGeprint: number; href: (s: StapSleutel, extra?: string) => string; verstuurdOp: string | null;
}) {
  await bewaarScans(verrijkt);
  const taken = await takenVoor(verrijkt.map((v) => v.ontvanger.prospect_id));
  const funnel = berekenFunnel(verrijkt.map((v) => ({ status: v.status, prospectStatus: v.prospect?.status ?? '', qrScans: v.qrScans, portaalBezoeken: v.portaalBezoeken, aanvragen: v.aanvragen })));
  const tellingen: Record<string, number> = {};
  for (const v of verrijkt) tellingen[v.status] = (tellingen[v.status] ?? 0) + 1;
  const status = ONTVANGER_STATUSSEN.includes(sp.status as OntvangerStatus) ? (sp.status as OntvangerStatus) : '';
  const zoek = (sp.zoek ?? '').trim().toLowerCase();
  const rijen = verrijkt
    .filter((v) => !status || v.status === status)
    .filter((v) => !zoek || `${v.prospect?.bedrijfsnaam ?? ''} ${v.prospect?.plaats ?? ''}`.toLowerCase().includes(zoek))
    .map((v) => weergave(v, taken.get(v.ontvanger.prospect_id) ?? null));
  const terug = href('volgen', `${status ? `&status=${status}` : ''}${sp.zoek ? `&zoek=${encodeURIComponent(sp.zoek)}` : ''}`);
  const opvolg: OpvolgRij[] = verrijkt
    .filter((v) => v.status === 'gescand' && v.prospect && !['reageerde', 'gekwalificeerd', 'klant', 'afgemeld'].includes(v.prospect.status))
    .sort((a, b) => (b.laatsteScan ?? '').localeCompare(a.laatsteScan ?? ''))
    .map((v) => ({
      prospectId: v.ontvanger.prospect_id,
      ontvangerId: v.ontvanger.id,
      batchId,
      batchNaam: null,
      bedrijfsnaam: v.prospect!.bedrijfsnaam,
      plaats: v.prospect!.plaats,
      telefoon: v.prospect!.telefoon,
      qrScans: v.qrScans,
      laatsteScan: v.laatsteScan,
      portaal: v.portaalBezoeken > 0,
      aanvraag: v.aanvragen > 0,
      taak: taken.get(v.ontvanger.prospect_id) ?? null,
    }));
  const [verstuurd, gescand, , contact, klant] = funnel;
  const dagenSinds = verstuurdOp ? Math.floor((Date.parse(`${vandaag}T12:00:00`) - Date.parse(`${verstuurdOp}T12:00:00`)) / 86_400_000) : null;

  return (
    <section className="mt-5 space-y-5">
      {(sp.verstuurd || sp.geprint || sp.aantal) && (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-[13px] text-green-800" role="status">
          {sp.geprint ? `${Number(sp.geprint) || 0} brieven op geprint gezet.` : sp.verstuurd ? `${Number(sp.verstuurd) || 0} brieven op verstuurd gezet. De prospects staan nu op benaderd; scant iemand, dan komt hij vanzelf in de opvolglijst.` : `${Number(sp.aantal) || 0} brieven bijgewerkt.`}
        </p>
      )}

      {nogTeVersturen > 0 && (
        <form action={markeerVerstuurdActie} className="panel flex flex-wrap items-center gap-3 border-amber-300 bg-amber-50 p-4">
          <input type="hidden" name="batch" value={batchId} />
          <p className="grow text-[13px] text-ink-900">
            {aantalGeprint > 0 ? (
              <>
                <strong>{aantalGeprint} geprinte {aantalGeprint === 1 ? 'brief is' : 'brieven zijn'} nog niet als verstuurd gemarkeerd.</strong> Op de post gedaan? Markeer ze, dan tellen scans vanaf die dag.
                {nogTeVersturen > aantalGeprint && <span className="text-warm"> De {nogTeVersturen - aantalGeprint} die nog niet geprint zijn blijven staan.</span>}
              </>
            ) : (
              <>
                <strong>{nogTeVersturen} {nogTeVersturen === 1 ? 'brief staat' : 'brieven staan'} nog klaar.</strong> Zelf geprint en op de post gedaan? Markeer ze als verstuurd, dan tellen scans vanaf die dag.
              </>
            )}
          </p>
          <label className="flex items-center gap-1.5 text-[13px]">
            Verstuurd op
            <input type="date" name="datum" defaultValue={vandaag} max={vandaag} className="veld w-auto py-1 text-[13px]" />
          </label>
          <VerzendKnop className="knop-donker" bezigTekst="Bijwerken…">Markeer als verstuurd</VerzendKnop>
        </form>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTegel label="Verstuurd" waarde={String(verstuurd.aantal)} href={href('volgen', '&status=verstuurd')} sub={<span className="text-warm">{dagenSinds != null ? `${dagenSinds} ${dagenSinds === 1 ? 'dag' : 'dagen'} geleden op de post` : 'nog niet op de post'}</span>} />
        <KpiTegel label="QR gescand" waarde={String(gescand.aantal)} href={href('volgen', '&status=gescand')} sub={<span className="text-warm">{procent(gescand.vanVorige)} van verstuurd</span>} />
        <KpiTegel label="Contact" waarde={String(contact.aantal)} href={href('volgen', '&status=gereageerd')} sub={<span className="text-warm">{procent(contact.vanStart)} van verstuurd</span>} />
        <KpiTegel label="Klant geworden" waarde={String(klant.aantal)} href={href('volgen', '&status=klant')} sub={<span className="text-warm">{procent(klant.vanStart)} van verstuurd</span>} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="panel p-4">
          <h2 className="font-display text-base font-bold text-ink-900">Funnel</h2>
          <div className="mt-3">
            <Funnel rijen={funnel} />
          </div>
          {verstuurd.aantal > 0 && gescand.aantal === 0 && dagenSinds != null && dagenSinds < 5 && (
            <p className="mt-3 text-[12px] text-warm">Nog geen scans. Dat is normaal in de eerste dagen: de meeste scans komen binnen een week na bezorging.</p>
          )}
        </div>
        <div className="panel p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-base font-bold text-ink-900">Gescand, nog niet gebeld <span className="chip-tel ml-1 align-middle">{opvolg.length}</span></h2>
            <p className="text-[12px] text-warm">Bel binnen een dag of twee na de scan: dan weten ze nog wie je bent.</p>
          </div>
          <div className="mt-2">
            <Opvolglijst rijen={opvolg} terug={href('volgen')} />
          </div>
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <StatusChips basePath={`/dashboard/prospects/brieven/${batchId}`} huidig={status} statussen={ONTVANGER_STATUSSEN.filter((s) => tellingen[s])} aantallen={tellingen} bewaar={{ stap: 'volgen', zoek: sp.zoek }} alleLabel="Alle ontvangers" />
          <LiveZoekveld param="zoek" placeholder="Zoek bedrijf of plaats" ariaLabel="Zoek in ontvangers" breedte="w-64" vast={{ stap: 'volgen' }} />
        </div>
        <p className="mt-2 text-[12px] text-warm">
          Volgorde: klaargezet, geprint, verstuurd, gescand, gereageerd of afspraak, klant. Retour en geen interesse sluiten af. Gescand gaat vanzelf zodra iemand de QR-code scant.
        </p>
        <div className="mt-3">
          <OntvangersTabel batchId={batchId} rijen={rijen} modus="volgen" terug={terug} vandaag={vandaag} />
        </div>
      </div>
    </section>
  );
}
