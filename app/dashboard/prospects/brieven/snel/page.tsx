import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { PROSPECT_STATUSSEN } from '@/lib/kms/prospecten';
import { listProspectenVoorBrieven } from '@/lib/prospect/dashboard';
import type { ProspectRij } from '@/lib/prospect/prospect';
import { briefPersonen } from '@/lib/prospect/briefData';
import { klassiekMetTekst } from '@/lib/prospect/briefTemplates';
import { datumLang, heeftAdres } from '@/lib/prospect/briefRender';
import { BRANCHE_LABELS, brancheGroep, CONTACT_FALLBACK, STANDAARD_BRIEFTEKST, type BrancheGroep } from '@/content/kennismaking';
import { site } from '@/content/site';
import { markeerBrievenVerstuurdActie } from '../actions';
import PrintKnop from '../PrintKnop';
import BriefPagina from '../_brief/BriefPagina';
import PastCheck from '../_brief/PastCheck';
import { controleerLive, PRINT_CSS } from '../_brief/print';

/**
 * De oude, snelle manier: filteren, aanvinken, één vrije tekst, printen.
 * Blijft bestaan als terugval zolang de tabellen voor verzendingen er niet zijn,
 * en voor wie snel één losse brief wil. De brief zelf is het template Klassiek
 * met de tekst uit het tekstvak, dus precies wat er vroeger uitkwam.
 */

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Brieven snel printen', robots: { index: false, follow: false } };

const MAX_BRIEVEN = 60;
const MAX_TEKST = 1400;
const BASIS = '/dashboard/prospects/brieven/snel';

type Zoek = {
  branche?: string; plaats?: string; status?: string; adres?: string; brief?: string; f?: string;
  id?: string | string[]; tekst?: string; toon?: string; verstuurd?: string; melding?: string;
};

export default async function SnelPagina({ searchParams }: { searchParams: Promise<Zoek> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const sp = await searchParams;

  const [alle, live] = await Promise.all([listProspectenVoorBrieven(), controleerLive()]);
  const kandidaten = alle.filter((p) => !p.afgemeld_op && p.status !== 'afgemeld');

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
  const aangevinkt = new Set(toon ? gekozenIds : gefilterd.slice(0, 50).map((p) => p.id));
  const zonderAdres = brieven.filter((p) => !heeftAdres(p));

  const personen = toon ? await briefPersonen(brieven) : [];
  const ontwerp = klassiekMetTekst(tekst);

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
  const terugUrl = `${BASIS}?${huidigeQs.toString()}`;
  const datum = datumLang();

  return (
    <main className="container-app py-6 print:m-0 print:max-w-none print:p-0">
      <style>{PRINT_CSS}</style>

      <div className="dash-kop flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="dash-h1">Brieven snel printen</h1>
          <p className="dash-sub mt-0.5">Zonder verzending: geen statussen of funnel. Voor een losse brief of als de verzendingen nog niet beschikbaar zijn.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/prospects/brieven" className="knop-tekst">Naar verzendingen</Link>
          <Link href="/dashboard/prospects/brieven/nieuw" className="knop-primair">Nieuwe verzending</Link>
        </div>
      </div>

      <div className="print:hidden">
        {sp.melding === 'geen-tabellen' && (
          <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-900" role="status">
            De verzending kon niet worden opgeslagen: de tabellen daarvoor bestaan nog niet (migratie 20261004_brief_batches). Je keuze staat hieronder klaar om toch te printen.
          </p>
        )}
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
          <Link href={BASIS} className="knop-tekst">Wissen</Link>
        </form>

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
            <p className="veld-hint mt-2">Maximaal {MAX_BRIEVEN} brieven per keer. Wil je een mooiere brief met blokken, statussen en scans per verzending? Gebruik dan <Link href="/dashboard/prospects/brieven/nieuw" className="font-semibold text-amber-700 hover:text-amber-800">Nieuwe verzending</Link>.</p>
          </div>
        </form>
      </div>

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
          <div className="mt-3 space-y-2 print:hidden">
            <PastCheck containerId="brieven-print" totaal={personen.length} />
            {zonderAdres.length > 0 && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
                {zonderAdres.length} {zonderAdres.length === 1 ? 'brief heeft' : 'brieven hebben'} geen volledig adres: {zonderAdres.slice(0, 6).map((p) => p.bedrijfsnaam).join(', ')}{zonderAdres.length > 6 ? ' en meer' : ''}. Vul adres en postcode in bij de prospect, anders komt de brief niet aan.
              </p>
            )}
          </div>

          <div id="brieven-print" className="mt-5 flex flex-col items-center gap-6 bg-mist py-6 print:bg-white">
            {personen.map((p) => (
              <BriefPagina key={p.id} ontwerp={ontwerp} persoon={p} datum={datum} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
