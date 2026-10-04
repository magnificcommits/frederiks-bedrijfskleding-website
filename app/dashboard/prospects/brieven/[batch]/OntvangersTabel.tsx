'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { useShiftSelectie } from '../_ui/selectie';
import { bulkOntvangerStatusActie, verwijderOntvangersActie, vulAdresAanActie, zetOntvangerStatusActie } from '../actions';
import VerzendKnop from '@/components/dashboard/VerzendKnop';
import AutoSubmitSelect from '@/components/dashboard/AutoSubmitSelect';
import { ONTVANGER_BADGE, ONTVANGER_LABEL, ONTVANGER_STATUSSEN, isOntvangerStatus } from '@/lib/prospect/briefStatus';

export type OntvangerWeergave = {
  id: string;
  prospectId: string;
  bedrijfsnaam: string;
  contactpersoon: string | null;
  plaats: string | null;
  telefoon: string | null;
  website: string | null;
  adres: string | null;
  postcode: string | null;
  heeftAdres: boolean;
  logoUrl: string | null;
  status: string;
  verstuurdOp: string | null;
  qrScans: number;
  eersteScan: string | null;
  laatsteScan: string | null;
  portaal: number;
  aanvragen: number;
  bezoeken: { soort: string; pad: string | null; op: string }[];
  taak: { open: boolean; vervaldatum: string | null } | null;
  afgemeld: boolean;
};

const SOORT: Record<string, string> = { qr: 'QR gescand', link: 'Pagina via link', portaal: 'Demo-portaal', aanvraag: 'Pasdag aangevraagd' };

function tijd(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function dag(d: string | null): string {
  if (!d) return '-';
  return new Date(`${d}T12:00:00`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

/**
 * Ontvangers van een verzending. Modus 'ontvangers': adres en logo nakijken,
 * mensen weghalen. Modus 'volgen': statussen per rij of in bulk, scans en
 * bekeken pagina's. Shift-klik selecteert een reeks.
 */
export default function OntvangersTabel({
  batchId,
  rijen,
  modus,
  terug,
  vandaag,
}: {
  batchId: string;
  rijen: OntvangerWeergave[];
  modus: 'ontvangers' | 'volgen';
  terug: string;
  vandaag: string;
}) {
  const { gekozen, klik, zet, leeg } = useShiftSelectie();
  const [open, setOpen] = useState<{ id: string; soort: 'adres' | 'scans' } | null>(null);
  const [bulkStatus, setBulkStatus] = useState<string>('verstuurd');
  const zichtbaar = useMemo(() => rijen.map((r) => r.id), [rijen]);
  const geselecteerd = zichtbaar.filter((id) => gekozen.has(id));
  const allesAan = zichtbaar.length > 0 && geselecteerd.length === zichtbaar.length;
  const kolommen = modus === 'volgen' ? 8 : 7;

  return (
    <div className="panel overflow-hidden">
      {/* Bulkbalk */}
      <div className={`flex flex-wrap items-center gap-2 border-b border-line px-3 py-2 ${geselecteerd.length ? 'bg-amber-50' : ''}`}>
        <span className="text-[13px] text-ink-800">
          {geselecteerd.length ? <strong>{geselecteerd.length} geselecteerd</strong> : <span className="text-warm">Vink rijen aan (shift-klik voor een reeks) voor een actie op allemaal tegelijk.</span>}
        </span>
        {geselecteerd.length > 0 && (
          <>
            {modus === 'volgen' ? (
              <form action={bulkOntvangerStatusActie} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="batch" value={batchId} />
                <input type="hidden" name="terug" value={terug} />
                {geselecteerd.map((id) => <input key={id} type="hidden" name="id" value={id} />)}
                <label className="flex items-center gap-1.5 text-[13px]">
                  Markeer als
                  <select name="status" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className="veld w-auto py-1 text-[13px]">
                    {ONTVANGER_STATUSSEN.map((s) => <option key={s} value={s}>{ONTVANGER_LABEL[s].toLowerCase()}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-1.5 text-[13px]">
                  op
                  <input type="date" name="datum" defaultValue={vandaag} max={vandaag} className="veld w-auto py-1 text-[13px]" />
                </label>
                <VerzendKnop className="knop-donker py-1.5 text-[13px]" bezigTekst="Bijwerken…">Toepassen</VerzendKnop>
              </form>
            ) : (
              <form action={verwijderOntvangersActie}>
                <input type="hidden" name="batch" value={batchId} />
                <input type="hidden" name="terug" value={terug} />
                {geselecteerd.map((id) => <input key={id} type="hidden" name="id" value={id} />)}
                <VerzendKnop className="knop-stil py-1.5 text-[13px] text-red-700" bezigTekst="Weghalen…">Uit deze verzending halen</VerzendKnop>
              </form>
            )}
            <button type="button" onClick={leeg} className="knop-tekst py-1 text-[12px]">Selectie wissen</button>
          </>
        )}
      </div>

      {rijen.length === 0 ? (
        <p className="px-3 py-10 text-center text-[13px] text-warm">Niemand gevonden met dit filter.</p>
      ) : (
        <div className="max-h-[65vh] overflow-auto">
          <table className="tbl select-none">
            <thead className="thead-sticky">
              <tr>
                <th className="w-9">
                  <input type="checkbox" checked={allesAan} onChange={() => zet(zichtbaar, !allesAan)} aria-label="Alles selecteren" className="h-4 w-4 accent-amber-500" />
                </th>
                <th>Bedrijf</th>
                {modus === 'ontvangers' ? (
                  <>
                    <th>Adres</th>
                    <th className="hidden md:table-cell">Logo</th>
                    <th>Status</th>
                    <th className="hidden lg:table-cell">Telefoon</th>
                    <th className="hidden lg:table-cell">Contactpersoon</th>
                  </>
                ) : (
                  <>
                    <th>Status</th>
                    <th className="hidden md:table-cell">Verstuurd</th>
                    <th>Scans</th>
                    <th className="hidden lg:table-cell">Bekeken</th>
                    <th className="hidden md:table-cell">Taak</th>
                    <th className="hidden xl:table-cell">Telefoon</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {rijen.map((r) => {
                const aan = gekozen.has(r.id);
                const statusKeuze = (
                  <form action={zetOntvangerStatusActie} onClick={(e) => e.stopPropagation()}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="batch" value={batchId} />
                    <input type="hidden" name="terug" value={terug} />
                    <AutoSubmitSelect
                      name="status"
                      defaultValue={r.status}
                      aria-label={`Status ${r.bedrijfsnaam}`}
                      className={`rounded border-0 py-0.5 pl-1.5 pr-6 text-[11px] font-semibold focus:ring-2 focus:ring-amber-300 ${isOntvangerStatus(r.status) ? ONTVANGER_BADGE[r.status] : 'badge-rust'}`}
                      options={ONTVANGER_STATUSSEN.map((s) => ({ value: s, label: ONTVANGER_LABEL[s] }))}
                    />
                  </form>
                );
                return (
                  <Fragment key={r.id}>
                    <tr
                      className={`cursor-pointer ${aan ? 'bg-amber-50/60' : ''}`}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('a,button,input,select,form')) return;
                        klik(r.id, zichtbaar, e.shiftKey);
                      }}
                    >
                      <td>
                        <input type="checkbox" checked={aan} onChange={(e) => klik(r.id, zichtbaar, (e.nativeEvent as MouseEvent).shiftKey === true)} aria-label={`Selecteer ${r.bedrijfsnaam}`} className="h-4 w-4 accent-amber-500" />
                      </td>
                      <td>
                        <Link href={`/dashboard/prospects/${r.prospectId}`} className="rij-link">{r.bedrijfsnaam}</Link>
                        {r.afgemeld && <span className="ml-2 badge bg-red-50 text-red-700">afgemeld</span>}
                        {r.plaats && <span className="block text-[12px] text-warm">{r.plaats}</span>}
                      </td>
                      {modus === 'ontvangers' ? (
                        <>
                          <td>
                            {r.heeftAdres ? (
                              <span className="text-[12px] text-ink-800">{r.adres}, {r.postcode}</span>
                            ) : (
                              <button type="button" onClick={() => setOpen(open?.id === r.id ? null : { id: r.id, soort: 'adres' })} className="inline-flex items-center gap-1 text-[12px] font-semibold text-amber-800" aria-expanded={open?.id === r.id}>
                                <span className="badge-actie">adres ontbreekt</span>
                                <span className="underline underline-offset-2">aanvullen</span>
                              </button>
                            )}
                          </td>
                          <td className="hidden md:table-cell">
                            {r.logoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={r.logoUrl} alt={`Logo ${r.bedrijfsnaam}`} referrerPolicy="no-referrer" className="h-6 w-12 object-contain" />
                            ) : (
                              <Link href={`/dashboard/prospects/${r.prospectId}#logo`} className="text-[12px] text-warm hover:text-ink-900">
                                <span className="badge-rust">naam</span> <span className="underline underline-offset-2">logo kiezen</span>
                              </Link>
                            )}
                          </td>
                          <td>{statusKeuze}</td>
                          <td className="stil hidden lg:table-cell">{r.telefoon ?? '-'}</td>
                          <td className="stil hidden lg:table-cell">{r.contactpersoon ?? <span className="text-ink-300">t.a.v. de directie</span>}</td>
                        </>
                      ) : (
                        <>
                          <td>{statusKeuze}</td>
                          <td className="stil hidden whitespace-nowrap md:table-cell">{dag(r.verstuurdOp)}</td>
                          <td className="whitespace-nowrap">
                            {r.qrScans > 0 || r.bezoeken.length > 0 ? (
                              <button type="button" onClick={() => setOpen(open?.id === r.id ? null : { id: r.id, soort: 'scans' })} className="text-left" aria-expanded={open?.id === r.id}>
                                <span className="badge-actie">{r.qrScans}x</span>
                                <span className="ml-1.5 text-[12px] text-warm underline-offset-2 hover:underline">{tijd(r.laatsteScan ?? r.bezoeken[r.bezoeken.length - 1]?.op ?? null)}</span>
                              </button>
                            ) : (
                              <span className="text-[12px] text-ink-300">niet gescand</span>
                            )}
                          </td>
                          <td className="hidden lg:table-cell">
                            <span className="flex flex-wrap gap-1">
                              {r.portaal > 0 && <span className="badge-actie">demo-portaal</span>}
                              {r.aanvragen > 0 && <span className="badge-klaar">pasdag</span>}
                              {r.portaal === 0 && r.aanvragen === 0 && <span className="text-[12px] text-ink-300">-</span>}
                            </span>
                          </td>
                          <td className="hidden md:table-cell">
                            {r.taak ? (
                              <Link href="/dashboard/taken" className={`text-[12px] ${r.taak.open ? 'font-semibold text-ink-800' : 'text-warm'}`}>
                                {r.taak.open ? `open${r.taak.vervaldatum ? `, ${dag(r.taak.vervaldatum)}` : ''}` : 'afgerond'}
                              </Link>
                            ) : (
                              <span className="text-[12px] text-ink-300">-</span>
                            )}
                          </td>
                          <td className="stil hidden whitespace-nowrap xl:table-cell">{r.telefoon ? <a href={`tel:${r.telefoon.replace(/[^0-9+]/g, '')}`} className="hover:text-ink-900">{r.telefoon}</a> : '-'}</td>
                        </>
                      )}
                    </tr>
                    {open?.id === r.id && open.soort === 'adres' && (
                      <tr className="bg-mist">
                        <td />
                        <td colSpan={kolommen - 1}>
                          <form action={vulAdresAanActie} className="flex flex-wrap items-end gap-2 py-1.5">
                            <input type="hidden" name="id" value={r.prospectId} />
                            <input type="hidden" name="terug" value={terug} />
                            <label className="grow basis-56">
                              <span className="veld-label">Straat en huisnummer</span>
                              <input name="adres" defaultValue={r.adres ?? ''} required autoFocus className="veld py-1 text-[13px]" autoComplete="off" />
                            </label>
                            <label className="w-28">
                              <span className="veld-label">Postcode</span>
                              <input name="postcode" defaultValue={r.postcode ?? ''} required placeholder="7255 AG" className="veld py-1 text-[13px]" autoComplete="off" />
                            </label>
                            <label className="w-40">
                              <span className="veld-label">Plaats</span>
                              <input name="plaats" defaultValue={r.plaats ?? ''} className="veld py-1 text-[13px]" autoComplete="off" />
                            </label>
                            <label className="w-44">
                              <span className="veld-label">Contactpersoon</span>
                              <input name="contactpersoon" defaultValue={r.contactpersoon ?? ''} placeholder="leeg = t.a.v. de directie" className="veld py-1 text-[13px]" autoComplete="off" />
                            </label>
                            <VerzendKnop className="knop-donker py-1.5 text-[13px]" bezigTekst="Opslaan…">Opslaan</VerzendKnop>
                            <button type="button" onClick={() => setOpen(null)} className="knop-tekst text-[13px]">Annuleren</button>
                            {r.website && (
                              <a href={/^https?:\/\//.test(r.website) ? r.website : `https://${r.website}`} target="_blank" rel="noopener noreferrer" className="text-[12px] font-semibold text-amber-700 hover:text-amber-800">
                                Adres opzoeken op de website
                              </a>
                            )}
                          </form>
                        </td>
                      </tr>
                    )}
                    {open?.id === r.id && open.soort === 'scans' && (
                      <tr className="bg-mist">
                        <td />
                        <td colSpan={kolommen - 1}>
                          <ol className="space-y-1 py-1.5">
                            {r.bezoeken.map((b, i) => (
                              <li key={i} className="flex flex-wrap items-center gap-2 text-[12px]">
                                <span className="w-32 shrink-0 tabular-nums text-warm">{tijd(b.op)}</span>
                                <span className={b.soort === 'qr' ? 'badge-actie' : b.soort === 'aanvraag' ? 'badge-klaar' : 'badge-rust'}>{SOORT[b.soort] ?? b.soort}</span>
                                {b.pad && <span className="truncate text-ink-400">{b.pad.replace(/[0-9a-f]{10}/i, '…')}</span>}
                              </li>
                            ))}
                          </ol>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
