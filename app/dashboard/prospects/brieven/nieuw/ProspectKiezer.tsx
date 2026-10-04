'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useShiftSelectie } from '../_ui/selectie';
import { maakBatchActie, voegOntvangersToeActie, vulAdresAanActie } from '../actions';
import { bulkLogosOphalenActie } from '../../actions';
import VerzendKnop from '@/components/dashboard/VerzendKnop';
import { ONTVANGER_BADGE, ONTVANGER_LABEL, isOntvangerStatus } from '@/lib/prospect/briefStatus';

export type KiesRij = {
  id: string;
  bedrijfsnaam: string;
  contactpersoon: string | null;
  plaats: string | null;
  branche: string;
  adres: string | null;
  postcode: string | null;
  heeftAdres: boolean;
  logoUrl: string | null;
  website: string | null;
  /** Laatste brief in een verzending, als die er is. */
  vorige: { batchId: string; batchNaam: string; status: string } | null;
  briefVerstuurdOp: string | null;
  inDezeBatch: boolean;
};

type TemplateKeuze = { waarde: string; label: string };

/**
 * Stap 1: prospects kiezen. Klik een vinkje, shift-klik voor een hele reeks.
 * De keuze blijft staan als je het filter verandert. Per rij zie je of het adres
 * en het logo er zijn, met de oplossing ernaast.
 */
export default function ProspectKiezer({
  rijen,
  voorgekozen,
  batch,
  actief,
  templates,
  standaardNaam,
  terug,
  totaalKandidaten,
}: {
  rijen: KiesRij[];
  voorgekozen: string[];
  batch: { id: string; naam: string } | null;
  actief: boolean;
  templates: TemplateKeuze[];
  standaardNaam: string;
  terug: string;
  totaalKandidaten: number;
}) {
  const { gekozen, klik, zet, leeg } = useShiftSelectie(voorgekozen);
  const [open, setOpen] = useState<string | null>(null);
  const [naam, setNaam] = useState(standaardNaam);
  // De voorgestelde naam volgt het filter, tot je hem zelf aanpast.
  const naamAangepast = useRef(false);
  useEffect(() => {
    if (!naamAangepast.current) setNaam(standaardNaam);
  }, [standaardNaam]);
  const zichtbaar = useMemo(() => rijen.filter((r) => !r.inDezeBatch).map((r) => r.id), [rijen]);
  const zichtbaarGekozen = zichtbaar.filter((id) => gekozen.has(id)).length;
  const allesAan = zichtbaar.length > 0 && zichtbaarGekozen === zichtbaar.length;
  const gekozenLijst = [...gekozen];
  const buitenFilter = gekozenLijst.length - zichtbaarGekozen;
  const perId = useMemo(() => new Map(rijen.map((r) => [r.id, r])), [rijen]);
  const gekozenRijen = gekozenLijst.map((id) => perId.get(id)).filter((r): r is KiesRij => Boolean(r));
  const zonderAdres = gekozenRijen.filter((r) => !r.heeftAdres).length;
  const logoKandidaten = gekozenRijen.filter((r) => !r.logoUrl && r.website).map((r) => r.id);
  const zonderLogo = gekozenRijen.filter((r) => !r.logoUrl).length;

  return (
    <div className="pb-28">
      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
          <p className="text-[13px] text-ink-800">
            <strong className="text-ink-900">{rijen.length}</strong> van {totaalKandidaten} prospects in dit filter.
            <span className="ml-2 text-warm">Tip: klik een vinkje en daarna met shift een vinkje verderop.</span>
          </p>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => zet(zichtbaar, !allesAan)} className="knop-tekst px-2 py-1 text-[12px]">
              {allesAan ? 'Niets in dit filter' : `Alles in dit filter (${zichtbaar.length})`}
            </button>
            {gekozen.size > 0 && (
              <button type="button" onClick={leeg} className="knop-tekst px-2 py-1 text-[12px]">
                Keuze wissen
              </button>
            )}
          </div>
        </div>
        {rijen.length === 0 ? (
          <p className="px-3 py-10 text-center text-[13px] text-warm">Geen prospects met dit filter. Zet een filter terug op &quot;Alle&quot;.</p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="tbl select-none">
              <thead className="thead-sticky">
                <tr>
                  <th className="w-9">
                    <input type="checkbox" checked={allesAan} onChange={() => zet(zichtbaar, !allesAan)} aria-label="Alles in dit filter kiezen" className="h-4 w-4 accent-amber-500" />
                  </th>
                  <th>Bedrijf</th>
                  <th>Plaats</th>
                  <th className="hidden md:table-cell">Branche</th>
                  <th>Adres</th>
                  <th className="hidden md:table-cell">Logo</th>
                  <th className="hidden lg:table-cell">Eerdere brief</th>
                </tr>
              </thead>
              <tbody>
                {rijen.map((r) => {
                  const aan = gekozen.has(r.id) || r.inDezeBatch;
                  return (
                    <Fragment key={r.id}>
                      <tr
                        className={`${aan ? 'bg-amber-50/60' : ''} ${r.inDezeBatch ? 'opacity-60' : 'cursor-pointer'}`}
                        onClick={(e) => {
                          if (r.inDezeBatch) return;
                          const t = e.target as HTMLElement;
                          if (t.closest('a,button,input,form')) return;
                          klik(r.id, zichtbaar, e.shiftKey);
                        }}
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={aan}
                            disabled={r.inDezeBatch}
                            onChange={(e) => klik(r.id, zichtbaar, (e.nativeEvent as MouseEvent).shiftKey === true)}
                            aria-label={`Kies ${r.bedrijfsnaam}`}
                            className="h-4 w-4 accent-amber-500"
                          />
                        </td>
                        <td>
                          <Link href={`/dashboard/prospects/${r.id}`} className="rij-link">{r.bedrijfsnaam}</Link>
                          {r.inDezeBatch && <span className="ml-2 badge-rust">zit er al in</span>}
                          {r.contactpersoon && <span className="block text-[12px] text-warm">{r.contactpersoon}</span>}
                        </td>
                        <td className="stil">{r.plaats ?? '-'}</td>
                        <td className="stil hidden md:table-cell">{r.branche}</td>
                        <td>
                          {r.heeftAdres ? (
                            <span className="badge-klaar" title={`${r.adres}, ${r.postcode}`}>adres ok</span>
                          ) : (
                            <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="inline-flex items-center gap-1 text-[12px] font-semibold text-amber-800 hover:text-amber-900" aria-expanded={open === r.id}>
                              <span className="badge-actie">ontbreekt</span>
                              <span className="underline underline-offset-2">aanvullen</span>
                            </button>
                          )}
                        </td>
                        <td className="hidden md:table-cell">
                          {r.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.logoUrl} alt={`Logo ${r.bedrijfsnaam}`} referrerPolicy="no-referrer" className="h-6 w-12 object-contain" />
                          ) : (
                            <Link href={`/dashboard/prospects/${r.id}#logo`} className="text-[12px] text-warm hover:text-ink-900" title="Zonder logo zetten we de bedrijfsnaam als tekst op de kleding">
                              <span className="badge-rust">naam</span> <span className="underline underline-offset-2">logo kiezen</span>
                            </Link>
                          )}
                        </td>
                        <td className="hidden lg:table-cell">
                          {r.vorige ? (
                            <Link href={`/dashboard/prospects/brieven/${r.vorige.batchId}?stap=volgen`} className="inline-flex items-center gap-1.5 text-[12px] text-warm hover:text-ink-900">
                              <span className={isOntvangerStatus(r.vorige.status) ? ONTVANGER_BADGE[r.vorige.status] : 'badge-rust'}>
                                {isOntvangerStatus(r.vorige.status) ? ONTVANGER_LABEL[r.vorige.status] : r.vorige.status}
                              </span>
                              <span className="max-w-[10rem] truncate">{r.vorige.batchNaam}</span>
                            </Link>
                          ) : r.briefVerstuurdOp ? (
                            <span className="text-[12px] text-warm">los verstuurd {r.briefVerstuurdOp}</span>
                          ) : (
                            <span className="text-[12px] text-ink-300">-</span>
                          )}
                        </td>
                      </tr>
                      {open === r.id && (
                        <tr className="bg-mist">
                          <td />
                          <td colSpan={6}>
                            <form action={vulAdresAanActie} className="flex flex-wrap items-end gap-2 py-1.5">
                              <input type="hidden" name="id" value={r.id} />
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
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Actiebalk */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur print:hidden">
        <div className="container-app flex flex-wrap items-end gap-3 py-3">
          <div className="min-w-[12rem]">
            <p className="text-[14px] font-bold text-ink-900">
              {gekozen.size} gekozen
              {buitenFilter > 0 && <span className="ml-1 text-[12px] font-normal text-warm">({buitenFilter} buiten dit filter)</span>}
            </p>
            <p className="text-[12px] text-warm">
              {gekozen.size === 0
                ? 'Vink prospects aan om verder te gaan.'
                : [zonderAdres ? `${zonderAdres} zonder adres` : null, zonderLogo ? `${zonderLogo} zonder logo (naam op de kleding)` : null].filter(Boolean).join(' · ') || 'Adres en logo zijn compleet.'}
            </p>
          </div>

          {logoKandidaten.length > 0 && (
            <form action={bulkLogosOphalenActie}>
              <input type="hidden" name="terug" value={terug} />
              {logoKandidaten.slice(0, 20).map((id) => <input key={id} type="hidden" name="ids" value={id} />)}
              <VerzendKnop className="knop-stil text-[13px]" bezigTekst="Logo's zoeken… (tot een minuut)">
                Logo&apos;s zoeken ({Math.min(20, logoKandidaten.length)})
              </VerzendKnop>
            </form>
          )}

          <div className="ml-auto flex flex-wrap items-end gap-2">
            {batch ? (
              <form action={voegOntvangersToeActie} className="flex items-end gap-2">
                <input type="hidden" name="batch" value={batch.id} />
                {gekozenLijst.map((id) => <input key={id} type="hidden" name="id" value={id} />)}
                <Link href={`/dashboard/prospects/brieven/${batch.id}?stap=ontvangers`} className="knop-tekst">Annuleren</Link>
                <VerzendKnop className="knop-primair" disabled={gekozen.size === 0} bezigTekst="Toevoegen…">
                  Toevoegen aan &quot;{batch.naam}&quot;
                </VerzendKnop>
              </form>
            ) : actief ? (
              <form action={maakBatchActie} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="terug" value={terug} />
                {gekozenLijst.map((id) => <input key={id} type="hidden" name="id" value={id} />)}
                <label className="w-64">
                  <span className="veld-label">Naam van de verzending</span>
                  <input name="naam" value={naam} onChange={(e) => { naamAangepast.current = true; setNaam(e.target.value); }} maxLength={140} className="veld py-1.5 text-[13px]" />
                </label>
                <label className="w-44">
                  <span className="veld-label">Begin met template</span>
                  <select name="template" className="veld py-1.5 text-[13px]" defaultValue={templates[0]?.waarde}>
                    {templates.map((t) => <option key={t.waarde} value={t.waarde}>{t.label}</option>)}
                  </select>
                </label>
                <VerzendKnop className="knop-primair" disabled={gekozen.size === 0} bezigTekst="Aanmaken…">
                  Verder: brief maken
                </VerzendKnop>
              </form>
            ) : (
              <form method="get" action="/dashboard/prospects/brieven/snel" className="flex items-end gap-2">
                {gekozenLijst.slice(0, 60).map((id) => <input key={id} type="hidden" name="id" value={id} />)}
                <input type="hidden" name="toon" value="1" />
                <span className="max-w-xs text-[12px] text-warm">Verzendingen opslaan kan pas na de migratie. Je kunt de brieven wel alvast tonen en printen.</span>
                <button type="submit" disabled={gekozen.size === 0} className="knop-primair disabled:opacity-50">Brieven tonen</button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
