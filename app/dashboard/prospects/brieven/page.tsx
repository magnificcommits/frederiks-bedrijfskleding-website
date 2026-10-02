import Link from 'next/link';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { PROSPECT_STATUSSEN } from '@/lib/kms/prospecten';
import LogoOpKleding from '@/components/kennismaking/LogoOpKleding';
import { listProspectenVoorBrieven, mockupsVoorProspecten } from '@/lib/prospect/dashboard';
import { korteUrl, type ProspectRij } from '@/lib/prospect/prospect';
import type { MockupArtikel } from '@/lib/prospect/types';
import { BRANCHE_LABELS, brancheGroep, CONTACT_FALLBACK, STANDAARD_BRIEFTEKST, vulBriefIn, type BrancheGroep } from '@/content/kennismaking';
import { site } from '@/content/site';
import { bedrijf } from '@/content/bedrijf';
import { logoDataUri } from '@/content/logoData';
import { markeerBrievenVerstuurdActie } from './actions';
import PrintKnop from './PrintKnop';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Brieven maken', robots: { index: false, follow: false } };

const MAX_BRIEVEN = 60;
const MAX_TEKST = 1400;

type Zoek = {
  branche?: string; plaats?: string; status?: string; adres?: string; brief?: string; f?: string;
  id?: string | string[]; tekst?: string; toon?: string; verstuurd?: string;
};

/**
 * Controleert of het domein uit de QR-code al live is en de korte /k-route kent.
 * Een onbekend token hoort naar de homepage door te sturen (3xx); een 404 betekent
 * dat deze versie van de site nog niet gedeployed is.
 */
async function controleerLive(): Promise<{ ok: boolean; melding: string | null }> {
  try {
    const res = await fetch(`${site.url}/k/0000000000`, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(4000) });
    if (res.status >= 300 && res.status < 400) return { ok: true, melding: null };
    if (res.status === 404) return { ok: false, melding: `${site.url} is bereikbaar, maar de QR-route /k/ staat er nog niet op. Zet eerst deze versie live.` };
    return { ok: false, melding: `${site.url} gaf status ${res.status} terug op de QR-route.` };
  } catch {
    return { ok: false, melding: `${site.url} is vanaf de server niet bereikbaar.` };
  }
}

async function qrSvgDataUrl(url: string): Promise<string> {
  const svg = await QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#1c1c1c', light: '#ffffff' } });
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function datumLang(): string {
  return new Date().toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'long', year: 'numeric' });
}

/** PostNL-notatie: postcode met spatie, twee spaties, plaats in hoofdletters. */
function postcodePlaats(p: ProspectRij): string {
  const pc = (p.postcode ?? '').toUpperCase().replace(/\s+/g, '').replace(/^(\d{4})([A-Z]{2})$/, '$1 $2');
  const plaats = (p.plaats ?? '').toUpperCase();
  return [pc, plaats].filter(Boolean).join('  ');
}

export default async function BrievenPagina({ searchParams }: { searchParams: Promise<Zoek> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const sp = await searchParams;

  const [alle, live] = await Promise.all([listProspectenVoorBrieven(), controleerLive()]);
  const kandidaten = alle.filter((p) => !p.afgemeld_op && p.status !== 'afgemeld');

  // Filters. Bij de eerste keer openen staat "nog geen brief" aan.
  const filterGebruikt = sp.f === '1';
  const fBranche = (sp.branche ?? '') as BrancheGroep | '';
  const fPlaats = sp.plaats ?? '';
  const fStatus = sp.status ?? '';
  const fAdres = sp.adres === '1';
  const fGeenBrief = filterGebruikt ? sp.brief === '1' : true;

  const gefilterd = kandidaten.filter((p) =>
    (!fBranche || brancheGroep(p.branche) === fBranche) &&
    (!fPlaats || (p.plaats ?? '').toLowerCase() === fPlaats.toLowerCase()) &&
    (!fStatus || p.status === fStatus) &&
    (!fAdres || Boolean(p.adres && p.postcode)) &&
    (!fGeenBrief || !p.brief_verstuurd_op),
  );

  const brancheTellingen = new Map<BrancheGroep, number>();
  for (const p of kandidaten) brancheTellingen.set(brancheGroep(p.branche), (brancheTellingen.get(brancheGroep(p.branche)) ?? 0) + 1);
  const plaatsen = [...new Set(kandidaten.map((p) => (p.plaats ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'nl'));

  const gekozenIds = (Array.isArray(sp.id) ? sp.id : sp.id ? [sp.id] : []).filter((i) => /^[0-9a-f-]{36}$/i.test(i));
  const tekst = (sp.tekst ?? '').trim() ? (sp.tekst as string).slice(0, 4000) : STANDAARD_BRIEFTEKST;
  const toon = gekozenIds.length > 0;
  const perId = new Map(alle.map((p) => [p.id, p]));
  const brieven = gekozenIds.map((i) => perId.get(i)).filter((p): p is ProspectRij => Boolean(p && !p.afgemeld_op)).slice(0, MAX_BRIEVEN);
  // Wat de lijst aangevinkt toont: de gekozen brieven, of standaard de eerste 50 uit het filter.
  const aangevinkt = new Set(toon ? gekozenIds : gefilterd.slice(0, 50).map((p) => p.id));
  const zonderAdres = brieven.filter((p) => !p.adres || !p.postcode);

  const [mockups, qrs] = toon
    ? await Promise.all([
        mockupsVoorProspecten(brieven),
        Promise.all(brieven.map((p) => qrSvgDataUrl(korteUrl(p.token)))),
      ])
    : [new Map<string, MockupArtikel[]>(), [] as string[]];

  const filterVelden = (
    <>
      <input type="hidden" name="f" value="1" />
      {fBranche && <input type="hidden" name="branche" value={fBranche} />}
      {fPlaats && <input type="hidden" name="plaats" value={fPlaats} />}
      {fStatus && <input type="hidden" name="status" value={fStatus} />}
      {fAdres && <input type="hidden" name="adres" value="1" />}
      {fGeenBrief && <input type="hidden" name="brief" value="1" />}
    </>
  );
  const huidigeQs = new URLSearchParams();
  huidigeQs.set('f', '1');
  if (fBranche) huidigeQs.set('branche', fBranche);
  if (fPlaats) huidigeQs.set('plaats', fPlaats);
  if (fStatus) huidigeQs.set('status', fStatus);
  if (fAdres) huidigeQs.set('adres', '1');
  if (fGeenBrief) huidigeQs.set('brief', '1');
  const terugUrl = `/dashboard/prospects/brieven?${huidigeQs.toString()}`;
  const datum = datumLang();

  return (
    <main className="container-app py-6 print:m-0 print:max-w-none print:p-0">
      <style>{`
        @page { size: A4; margin: 0; }
        .brief { width: 210mm; height: 297mm; }
        @media print {
          html, body { background: #fff !important; padding: 0 !important; margin: 0 !important; }
          body * { visibility: hidden !important; }
          #brieven-print, #brieven-print * { visibility: visible !important; }
          aside { display: none !important; }
          #brieven-print { margin: 0 !important; padding: 0 !important; gap: 0 !important; }
          .brief { box-shadow: none !important; border: 0 !important; margin: 0 !important; break-after: page; page-break-after: always; }
          .brief:last-child { break-after: auto; page-break-after: auto; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="dash-kop flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="dash-h1">Brieven maken</h1>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/prospects" className="knop-tekst">Terug naar prospects</Link>
        </div>
      </div>

      <div className="print:hidden">
        <div className={`mt-4 rounded-md border px-3 py-2 text-[13px] ${live.ok ? 'border-line bg-mist text-ink-800' : 'border-red-200 bg-red-50 text-red-800'}`} role={live.ok ? undefined : 'alert'}>
          {live.ok ? (
            <>De QR-codes wijzen naar <strong>{site.url.replace(/^https?:\/\//, '')}/k/…</strong> en die route is live. Scan na het printen één brief met je eigen telefoon als controle (log dan eerst uit in het dashboard, anders telt de scan niet).</>
          ) : (
            <><strong>Nog niet printen.</strong> De QR-code wijst naar {site.url.replace(/^https?:\/\//, '')}; zorg dat het domein live is voordat je print. {live.melding}</>
          )}
        </div>

        {sp.verstuurd && (
          <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-[13px] text-green-800" role="status">
            {Number(sp.verstuurd) || 0} brieven gemarkeerd als verstuurd. Ze staan nu op &apos;benaderd&apos;; zodra iemand scant komt er een beltaak.
          </p>
        )}

        {/* Stap 1: filter */}
        <form method="get" className="mt-5 flex flex-wrap items-end gap-3">
          <input type="hidden" name="f" value="1" />
          <div>
            <label className="veld-label" htmlFor="b-branche">Branche</label>
            <select id="b-branche" name="branche" defaultValue={fBranche} className="veld">
              <option value="">Alle branches</option>
              {(Object.keys(BRANCHE_LABELS) as BrancheGroep[]).filter((g) => brancheTellingen.get(g)).map((g) => (
                <option key={g} value={g}>{BRANCHE_LABELS[g]} ({brancheTellingen.get(g)})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="veld-label" htmlFor="b-plaats">Plaats</label>
            <select id="b-plaats" name="plaats" defaultValue={fPlaats} className="veld">
              <option value="">Alle plaatsen</option>
              {plaatsen.map((pl) => <option key={pl} value={pl}>{pl}</option>)}
            </select>
          </div>
          <div>
            <label className="veld-label" htmlFor="b-status">Status</label>
            <select id="b-status" name="status" defaultValue={fStatus} className="veld">
              <option value="">Alle statussen</option>
              {PROSPECT_STATUSSEN.filter((s) => s !== 'afgemeld').map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-1.5 text-[13px] text-ink-800">
            <input type="checkbox" name="adres" value="1" defaultChecked={fAdres} className="h-4 w-4 accent-amber-500" /> Heeft adres
          </label>
          <label className="flex items-center gap-1.5 text-[13px] text-ink-800">
            <input type="checkbox" name="brief" value="1" defaultChecked={fGeenBrief} className="h-4 w-4 accent-amber-500" /> Nog geen brief
          </label>
          <button className="knop-stil">Filter</button>
          <Link href="/dashboard/prospects/brieven" className="knop-tekst">Wissen</Link>
        </form>

        {/* Stap 2: selectie + tekst */}
        <form method="get" className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
          {filterVelden}
          <div className="panel">
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <p className="text-[13px] font-semibold text-ink-900">{gefilterd.length} prospects {gefilterd.length > 50 && !toon ? '(eerste 50 aangevinkt)' : ''}</p>
              <p className="text-[12px] text-warm">Afgemelde prospects staan er nooit tussen.</p>
            </div>
            {gefilterd.length === 0 ? (
              <p className="px-3 py-6 text-center text-[13px] text-warm">Geen prospects met dit filter.</p>
            ) : (
              <div className="max-h-[28rem] overflow-y-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th className="w-8"><span className="sr-only">Kies</span></th>
                      <th>Bedrijf</th>
                      <th>Plaats</th>
                      <th className="hidden md:table-cell">Branche</th>
                      <th>Adres</th>
                      <th className="hidden md:table-cell">Logo</th>
                      <th className="hidden lg:table-cell">Brief</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gefilterd.map((p) => (
                      <tr key={p.id}>
                        <td><input type="checkbox" name="id" value={p.id} defaultChecked={aangevinkt.has(p.id)} aria-label={`Kies ${p.bedrijfsnaam}`} className="h-4 w-4 accent-amber-500" /></td>
                        <td><Link href={`/dashboard/prospects/${p.id}`} className="rij-link">{p.bedrijfsnaam}</Link></td>
                        <td className="stil">{p.plaats ?? '-'}</td>
                        <td className="stil hidden md:table-cell">{BRANCHE_LABELS[brancheGroep(p.branche)]}</td>
                        <td>{p.adres && p.postcode ? <span className="badge-klaar">ja</span> : <span className="badge-actie">ontbreekt</span>}</td>
                        <td className="hidden md:table-cell">{p.logo_url ? <span className="badge-klaar">ja</span> : <span className="badge-rust">naam</span>}</td>
                        <td className="stil hidden lg:table-cell">{p.brief_verstuurd_op ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="panel p-3">
            <label className="veld-label" htmlFor="b-tekst">Brieftekst</label>
            <textarea id="b-tekst" name="tekst" rows={16} maxLength={4000} defaultValue={tekst} className="veld font-mono text-[12px] leading-relaxed" />
            <p className="veld-hint">
              Velden: <code>{'{{bedrijf}}'}</code> <code>{'{{contactpersoon}}'}</code> (leeg wordt &quot;{CONTACT_FALLBACK}&quot;, in de aanhef &quot;Geachte directie&quot;) <code>{'{{plaats}}'}</code> <code>{'{{branche}}'}</code>.
              Houd het onder de {MAX_TEKST} tekens, anders past het niet op één A4 met de kleding en QR-code. Nu: {tekst.length}.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button name="toon" value="1" className="knop-donker">Brieven tonen</button>
              <Link href={terugUrl} className="knop-tekst">Standaardtekst</Link>
            </div>
            <p className="veld-hint mt-2">Maximaal {MAX_BRIEVEN} brieven per keer.</p>
          </div>
        </form>
      </div>

      {/* Stap 3: voorbeeld en printen */}
      {toon && (
        <>
          <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-5 print:hidden">
            <h2 className="font-display text-base font-bold text-ink-900">Voorbeeld ({brieven.length})</h2>
            <PrintKnop aantal={brieven.length} />
            <form action={markeerBrievenVerstuurdActie}>
              {brieven.map((p) => <input key={p.id} type="hidden" name="id" value={p.id} />)}
              <input type="hidden" name="terug" value={terugUrl} />
              <button className="knop-stil">Markeer als verstuurd</button>
            </form>
            <span className="text-[12px] text-warm">Printen: A4, marges &quot;geen&quot;, achtergrondafbeeldingen aan. Venster-envelop met adresvenster links.</span>
          </div>
          {zonderAdres.length > 0 && (
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-[13px] text-amber-900 print:hidden">
              {zonderAdres.length} {zonderAdres.length === 1 ? 'brief heeft' : 'brieven hebben'} geen volledig adres: {zonderAdres.slice(0, 6).map((p) => p.bedrijfsnaam).join(', ')}{zonderAdres.length > 6 ? ' en meer' : ''}. Vul adres en postcode in bij de prospect, anders komt de brief niet aan.
            </p>
          )}

          <div id="brieven-print" className="mt-5 flex flex-col items-center gap-6 bg-mist py-6 print:bg-white">
            {brieven.map((p, i) => {
              const artikelen = (mockups.get(p.id) ?? []).slice(0, 3);
              const inhoud = vulBriefIn(tekst, { bedrijf: p.bedrijfsnaam, contactpersoon: p.contactpersoon, plaats: p.plaats, branche: p.branche });
              const alineas = inhoud.split(/\n\s*\n/).map((a) => a.trim()).filter(Boolean);
              const kort = korteUrl(p.token).replace(/^https?:\/\//, '');
              return (
                <article key={p.id} className="brief relative flex flex-col overflow-hidden bg-white text-[10.5pt] leading-[1.45] text-ink-900 shadow-card" style={{ fontFamily: 'var(--font-body), Arial, sans-serif' }}>
                  {/* Briefhoofd rechtsboven, buiten het adresvenster */}
                  <header className="absolute right-[18mm] top-[14mm] w-[70mm] text-right">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoDataUri} alt={site.name} className="ml-auto h-[16mm] w-auto" />
                    <p className="mt-[3mm] text-[8pt] leading-snug text-warm">
                      {bedrijf.adres}<br />{bedrijf.postcode} {bedrijf.plaats}<br />{bedrijf.telefoon}<br />{bedrijf.email}<br />{bedrijf.website}
                    </p>
                  </header>

                  {/* Adresblok voor venster-envelop (links, 20 mm van links, 50 mm van boven) */}
                  <div className="absolute left-[20mm] top-[46mm] w-[85mm]">
                    <p className="border-b border-ink-200 pb-[1mm] text-[6.5pt] text-ink-400">{site.name} · {bedrijf.adres} · {bedrijf.postcode} {bedrijf.plaats}</p>
                  </div>
                  <address className="absolute left-[20mm] top-[52mm] h-[35mm] w-[85mm] text-[10.5pt] not-italic leading-snug">
                    {p.bedrijfsnaam}<br />
                    {p.contactpersoon ? `t.a.v. ${p.contactpersoon}` : CONTACT_FALLBACK}<br />
                    {p.adres ?? ''}{p.adres && <br />}
                    {postcodePlaats(p)}
                  </address>

                  <div className="mx-[20mm] mt-[98mm] flex min-h-0 grow flex-col">
                    <p>{bedrijf.plaats}, {datum}</p>
                    <p className="mt-[5mm] font-bold">Betreft: werkkleding voor {p.bedrijfsnaam}</p>
                    <div className="mt-[4mm] space-y-[3mm]">
                      {alineas.map((a, j) => <p key={j} className="whitespace-pre-line">{a}</p>)}
                    </div>
                    <div className="mt-[5mm]">
                      <p>Met vriendelijke groet,</p>
                      <p className="mt-[1mm] text-[20pt] leading-none text-ink-900" style={{ fontFamily: "'Segoe Script', 'Brush Script MT', 'Snell Roundhand', cursive" }}>Jessi</p>
                      <p className="mt-[1mm]">Jessi Frederiks<br /><span className="text-warm">{site.name}</span></p>
                    </div>

                    {/* Kleding + QR */}
                    <div className="mt-auto flex items-end gap-[4mm] pb-[14mm]">
                      {artikelen.map((a) => (
                        <figure key={a.productId} className="w-[30mm]">
                          <LogoOpKleding fotoUrl={a.fotoUrl} alt={a.naam} logoUrl={p.logo_url} bedrijfsnaam={p.bedrijfsnaam} positie={a.logoPositie} className="h-[30mm] w-[30mm] rounded-[2mm] border border-line bg-white" />
                          <figcaption className="mt-[1mm] truncate text-[6.5pt] text-warm">{a.naam}</figcaption>
                        </figure>
                      ))}
                      <div className="ml-auto flex items-end gap-[3mm]">
                        <div className="text-right text-[8pt] leading-snug">
                          <p className="font-bold">Scan mij</p>
                          <p className="text-warm">en zie jullie logo<br />op de kleding</p>
                          <p className="mt-[1.5mm] font-mono text-[7.5pt]">{kort}</p>
                        </div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={qrs[i]} alt={`QR-code naar ${kort}`} className="h-[30mm] w-[30mm]" />
                      </div>
                    </div>
                  </div>

                  <footer className="absolute inset-x-0 bottom-0 flex h-[9mm] items-center justify-between bg-ink-900 px-[20mm] text-[7pt] text-white">
                    <span>{site.name}</span>
                    <span>{bedrijf.telefoon} · {bedrijf.email} · KvK {bedrijf.kvk}</span>
                  </footer>
                </article>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
