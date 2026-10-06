import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';
import { getInkooporder, portaalLink, INKOOPORDER_BADGE, INKOOPORDER_LABEL } from '@/lib/kms/inkoop';
import BevestigKnop from '../../voorraad/BevestigKnop';
import {
  annuleerInkooporderActie,
  boekAllesActie,
  boekOntvangstActie,
  regelUitOrderActie,
  verstuurInkooporderActie,
  werkInkooporderActie,
} from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Inkooporder', robots: { index: false, follow: false } };

const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
const datumLang = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'long' }) : '-';
const telLink = (n: string) => `tel:${n.replace(/[^\d+]/g, '')}`;

const STAPPEN = [
  { code: 'concept', label: 'Concept' },
  { code: 'verstuurd', label: 'Verstuurd' },
  { code: 'deels_ontvangen', label: 'Deels ontvangen' },
  { code: 'ontvangen', label: 'Ontvangen' },
];

type Zoek = { melding?: string; stuks?: string; voorraad?: string; klant?: string };

function meldingTekst(sp: Zoek): { tekst: string; soort: 'ok' | 'let-op' | 'fout' } | null {
  const n = Number(sp.stuks) || 0;
  switch (sp.melding) {
    case 'concept':
      return { tekst: 'Concept-inkooporder gemaakt. Controleer de regels en de verwachte datum, en verstuur hem dan.', soort: 'ok' };
    case 'verstuurd':
      return { tekst: 'Op verstuurd gezet. De regels staan op besteld en de klantorders zijn bijgewerkt.', soort: 'ok' };
    case 'gemaild':
      return { tekst: 'Bestelmail verstuurd en de inkooporder staat op verstuurd.', soort: 'ok' };
    case 'mail_niet':
      return {
        tekst: 'De inkooporder staat op verstuurd, maar de mail is niet weggegaan (mail is nog niet ingesteld of er is geen adres). Bestel via het portaal of stuur de bestelling zelf.',
        soort: 'let-op',
      };
    case 'ontvangen': {
      const waar = sp.voorraad === '1' ? 'en bij de voorraad opgeteld' : sp.klant && sp.klant !== '0' ? 'en de klantorder is bijgewerkt' : '';
      return { tekst: `${n} ${n === 1 ? 'stuk' : 'stuks'} ontvangen geboekt ${waar}.`.replace(' .', '.'), soort: 'ok' };
    }
    case 'alles':
      return { tekst: n ? `Alles binnen: ${n} stuks geboekt.` : 'Er stond niets meer open.', soort: n ? 'ok' : 'let-op' };
    case 'opgeslagen':
      return { tekst: 'Opgeslagen.', soort: 'ok' };
    case 'geannuleerd':
      return { tekst: 'Geannuleerd. Regels waar nog niets van binnen was, staan weer bij te bestellen.', soort: 'let-op' };
    case 'regel_terug':
      return { tekst: 'De regel staat weer bij te bestellen.', soort: 'ok' };
    case 'mislukt':
      return { tekst: 'Dat is niet gelukt. Probeer het nog een keer.', soort: 'fout' };
    default:
      return null;
  }
}

export default async function InkooporderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Zoek> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  if (!kmsAdmin()) redirect('/dashboard/inkoop');
  const { id } = await params;
  const sp = await searchParams;
  const d = await getInkooporder(id);
  if (!d) notFound();

  const o = d.order;
  const portaal = portaalLink(d.partij.bestelportaal_url);
  const concept = o.status === 'concept';
  const open = o.status === 'verstuurd' || o.status === 'deels_ontvangen';
  const stapIndex = STAPPEN.findIndex((s) => s.code === o.status);
  const m = meldingTekst(sp);
  const zonderPrijs = d.regels.filter((r) => r.prijs === null).length;

  return (
    <main className="container-app pb-12">
      <div className="dash-kop flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/dashboard/inkoop?tab=orders" className="knop-tekst !px-1" aria-label="Terug naar inkooporders">&larr;</Link>
          <h1 className="dash-h1 truncate">
            Inkooporder {o.nummer ?? ''} <span className="font-medium text-warm">· {o.inkoop_partij ?? 'onbekend'}</span>
          </h1>
          <span className={INKOOPORDER_BADGE[o.status] ?? 'badge-rust'}>{INKOOPORDER_LABEL[o.status] ?? o.status}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {portaal && (concept || open) && (
            <a href={portaal} target="_blank" rel="noopener noreferrer" className="knop-stil">Bestelportaal openen</a>
          )}
          {concept && (
            <form action={verstuurInkooporderActie} className="flex gap-2">
              <input type="hidden" name="id" value={o.id} />
              {d.partij.email && (
                <BevestigKnop
                  vraag={`Bestelmail met ${o.aantalRegels} regels sturen naar ${d.partij.email}?`}
                  name="mail"
                  value="1"
                  className="knop-primair"
                >
                  Mailen naar leverancier
                </BevestigKnop>
              )}
              <button type="submit" name="mail" value="" className={d.partij.email ? 'knop-donker' : 'knop-primair'}>
                {portaal ? 'Besteld in portaal' : 'Markeer als verstuurd'}
              </button>
            </form>
          )}
          {open && (
            <form action={boekAllesActie}>
              <input type="hidden" name="poId" value={o.id} />
              <BevestigKnop vraag="Alles wat nog openstaat als ontvangen boeken?" className="knop-primair">Alles ontvangen</BevestigKnop>
            </form>
          )}
        </div>
      </div>

      {m && (
        <p
          role="status"
          className={`mt-3 rounded-md border px-3 py-2 text-[13px] font-semibold ${
            m.soort === 'ok' ? 'border-green-200 bg-green-50 text-green-800' : m.soort === 'let-op' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {m.tekst}
        </p>
      )}

      {o.status !== 'geannuleerd' && (
        <ol aria-label="Voortgang" className="mt-4 grid grid-cols-4 gap-1">
          {STAPPEN.map((s, i) => {
            const klaar = i < stapIndex || o.status === 'ontvangen';
            const nu = i === stapIndex;
            return (
              <li key={s.code} className="flex flex-col gap-1.5">
                <span className={`h-1.5 rounded-full ${klaar ? 'bg-ink-900' : nu ? 'bg-amber-500' : 'bg-ink-100'}`} aria-hidden />
                <span className={`text-[12px] ${nu ? 'font-bold text-ink-900' : klaar ? 'text-ink-700' : 'text-ink-400'}`}>
                  {s.label}
                  {nu && <span className="sr-only"> (huidige stap)</span>}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1fr_340px]">
        <section className="panel min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-2.5">
            <h2 className="font-display text-[14px] font-bold text-ink-900">Regels</h2>
            <p className="text-[12px] text-warm">
              {o.stuks} stuks · {o.ontvangenStuks} binnen · {euro.format(o.waarde)}
              {zonderPrijs > 0 && ` · ${zonderPrijs} zonder inkoopprijs`}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Artikel</th>
                  <th>Kleur / maat</th>
                  <th>Voor</th>
                  <th className="text-right">Besteld</th>
                  <th className="text-right">Binnen</th>
                  <th className="text-right">Prijs</th>
                  <th className="text-right">Waarde</th>
                  <th>{open ? 'Ontvangst boeken' : <span className="sr-only">Actie</span>}</th>
                </tr>
              </thead>
              <tbody>
                {d.regels.map((r) => {
                  const binnen = Number(r.geleverd_aantal) || 0;
                  return (
                    <tr key={r.id} className={r.rest === 0 ? 'text-ink-500' : ''}>
                      <td className="min-w-[180px]">
                        <span className="font-semibold text-ink-900">{r.item_naam ?? '-'}</span>
                        {r.merk && <span className="block text-[11px] text-warm">{r.merk}</span>}
                      </td>
                      <td className="whitespace-nowrap stil">{[r.kleur, r.maat].filter(Boolean).join(' / ') || '-'}</td>
                      <td className="stil">
                        {r.order_id ? (
                          <Link href={`/dashboard/orders/${r.order_id}`} className="rij-link" title={r.klant_naam ?? undefined}>
                            {r.ordernummer ? `order ${r.ordernummer}` : 'klantorder'}
                          </Link>
                        ) : (
                          'voorraad'
                        )}
                        {r.klant_naam && <span className="block text-[11px]">{r.klant_naam}</span>}
                      </td>
                      <td className="num">{r.aantal}</td>
                      <td className={`num ${r.rest === 0 ? 'text-green-700' : binnen > 0 ? 'font-semibold text-amber-700' : ''}`}>{binnen}</td>
                      <td className="num stil">{r.prijs === null ? 'onbekend' : euro.format(r.prijs)}</td>
                      <td className="num">{r.waarde === null ? '-' : euro.format(r.waarde)}</td>
                      <td>
                        {open && r.rest > 0 && (
                          <form action={boekOntvangstActie} className="flex items-center gap-1">
                            <input type="hidden" name="poId" value={o.id} />
                            <input type="hidden" name="regelId" value={r.id} />
                            <label className="sr-only" htmlFor={`ontv-${r.id}`}>Aantal dat nu binnen is</label>
                            <input
                              id={`ontv-${r.id}`}
                              name="ontvangen_nu"
                              type="number"
                              min={0}
                              step={1}
                              defaultValue={r.rest}
                              className="w-16 rounded-md border border-line px-2 py-1 text-right text-[13px] tabular-nums"
                            />
                            <button type="submit" className="knop-donker !px-2 !py-1 text-[12px]">Boek</button>
                          </form>
                        )}
                        {open && r.rest === 0 && <span className="badge-klaar">binnen</span>}
                        {concept && (
                          <form action={regelUitOrderActie}>
                            <input type="hidden" name="regelId" value={r.id} />
                            <button type="submit" className="knop-tekst !px-1.5 text-[12px]">Uit deze order</button>
                          </form>
                        )}
                        {o.status === 'ontvangen' && r.ontvangen_op && <span className="text-[12px] text-warm">{datumLang(r.ontvangen_op)}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {open && (
            <p className="border-t border-line px-4 py-2 text-[12px] text-warm">
              Regels voor een klantorder gaan niet de voorraad in: de klantorder schuift op naar deellevering of compleet geleverd.
              Regels voor voorraad worden bij de voorraad opgeteld, met een ontvangst in de historie.
            </p>
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-5">
          <section className="panel">
            <h2 className="border-b border-line px-4 py-2.5 font-display text-[14px] font-bold text-ink-900">Gegevens</h2>
            <form action={werkInkooporderActie} className="flex flex-col gap-3 px-4 py-3">
              <input type="hidden" name="id" value={o.id} />
              <dl className="grid grid-cols-2 gap-2 text-[13px]">
                <div>
                  <dt className="veld-label">Besteld op</dt>
                  <dd className="text-ink-900">{datumLang(o.besteld_op)}</dd>
                </div>
                <div>
                  <dt className="veld-label">Ontvangen op</dt>
                  <dd className="text-ink-900">{datumLang(o.ontvangen_op)}</dd>
                </div>
              </dl>
              <div>
                <label className="veld-label" htmlFor="po-verwacht">Verwachte leverdatum</label>
                <input id="po-verwacht" type="date" name="verwacht_op" defaultValue={o.verwacht_op ?? ''} className={`veld ${o.teLaat ? 'border-red-300' : ''}`} />
                <p className="veld-hint">
                  {o.teLaat && o.dagenTeLaat !== null
                    ? `${o.dagenTeLaat} ${o.dagenTeLaat === 1 ? 'dag' : 'dagen'} te laat.`
                    : d.partij.levertijd_dagen
                      ? `Afgesproken levertijd ${d.partij.levertijd_dagen} dagen; leeg = vanzelf ingevuld bij versturen.`
                      : 'Vul in wat de leverancier bevestigt. Daarmee meet je de leverbetrouwbaarheid.'}
                </p>
              </div>
              <div>
                <label className="veld-label" htmlFor="po-ref">Referentie leverancier</label>
                <input id="po-ref" name="referentie" defaultValue={o.referentie ?? ''} placeholder="Ordernummer of bevestiging" className="veld" />
              </div>
              <div>
                <label className="veld-label" htmlFor="po-not">Notitie</label>
                <textarea id="po-not" name="notitie" rows={3} defaultValue={o.notitie ?? ''} className="veld" />
              </div>
              <button type="submit" className="self-start knop-stil">Opslaan</button>
            </form>
          </section>

          <section className="panel">
            <h2 className="border-b border-line px-4 py-2.5 font-display text-[14px] font-bold text-ink-900">{o.inkoop_partij ?? 'Leverancier'}</h2>
            <dl className="divide-y divide-line px-4 py-1 text-[13px]">
              <div className="grid grid-cols-[100px_1fr] gap-2 py-1.5">
                <dt className="text-warm">Bestelwijze</dt>
                <dd className="text-ink-900">{d.partij.bestelwijze ?? (portaal ? 'Via het portaal' : '-')}</dd>
              </div>
              <div className="grid grid-cols-[100px_1fr] gap-2 py-1.5">
                <dt className="text-warm">Mail</dt>
                <dd className="truncate">{d.partij.email ? <a href={`mailto:${d.partij.email}`} className="font-semibold text-ink-900 hover:text-amber-700">{d.partij.email}</a> : '-'}</dd>
              </div>
              <div className="grid grid-cols-[100px_1fr] gap-2 py-1.5">
                <dt className="text-warm">Contact</dt>
                <dd className="text-ink-900">
                  {d.partij.contactpersoon ?? '-'}
                  {d.partij.telefoon && <a href={telLink(d.partij.telefoon)} className="block hover:text-amber-700">{d.partij.telefoon}</a>}
                </dd>
              </div>
            </dl>
            {o.leverancier_id && (
              <p className="border-t border-line px-4 py-2">
                <Link href={`/dashboard/leveranciers/${o.leverancier_id}`} className="knop-tekst !px-0 text-[12px]">Naar leverancier</Link>
              </p>
            )}
          </section>

          {(concept || o.status === 'verstuurd') && (
            <form action={annuleerInkooporderActie}>
              <input type="hidden" name="id" value={o.id} />
              <BevestigKnop
                vraag={concept ? 'Dit concept weggooien? De regels gaan terug naar nog te bestellen.' : 'Deze inkooporder annuleren? Regels waar nog niets van binnen is, gaan terug naar nog te bestellen.'}
                className="knop-tekst text-[12px] hover:!text-red-700"
              >
                {concept ? 'Concept weggooien' : 'Inkooporder annuleren'}
              </BevestigKnop>
            </form>
          )}
        </aside>
      </div>
    </main>
  );
}
