'use client';

import type { MouseEvent } from 'react';
import type { Taak } from '@/lib/kms/taken';
import type { TaakStatus } from '@/lib/kms/taakStatussen';
import type { TaakPersoon } from '@/lib/kms/taakPersonen';
import { kleurKlassen } from './statusKleur';
import { Avatar, IcoonLocatie, IcoonBel, IcoonHerhaal } from './onderdelen';
import { DAGEN_KORT, MAANDEN_KORT, datumLang, minutenVan, plusMinuten, tijdKort } from './tijd';

/**
 * Weekagenda: zeven dagkolommen. Bovenaan per dag de taken zonder tijd (en
 * afspraken zonder tijd), daaronder een tijdbalk waarin afspraken als blokken
 * staan van begin- tot eindtijd. Taken met een tijd staan als smal blokje van
 * een half uur. Klik op een lege plek om op dat tijdstip een afspraak te maken,
 * klik op een blok om hem te openen. Op de telefoon: een lijst per dag.
 */

const UUR_HOOGTE = 48; // px per uur

type Blok = { taak: Taak; start: number; eind: number; baan: number; banen: number };

function blokkenVanDag(taken: Taak[]): Blok[] {
  const items = taken
    .filter((t) => tijdKort(t.tijd))
    .map((t) => {
      const start = minutenVan(tijdKort(t.tijd));
      const eindTijd = t.soort === 'afspraak' && tijdKort(t.eind_tijd) ? tijdKort(t.eind_tijd) : plusMinuten(tijdKort(t.tijd), 30);
      const eind = Math.max(minutenVan(eindTijd), start + 20);
      return { taak: t, start, eind, baan: 0, banen: 1 };
    })
    .sort((a, b) => a.start - b.start || b.eind - a.eind);

  // Overlappende blokken naast elkaar zetten (eenvoudige banen per cluster).
  let cluster: Blok[] = [];
  let clusterEind = -1;
  const banenEind: number[] = [];
  const sluit = () => {
    const n = Math.max(1, ...cluster.map((b) => b.baan + 1));
    cluster.forEach((b) => (b.banen = n));
    cluster = [];
    banenEind.length = 0;
  };
  for (const b of items) {
    if (cluster.length && b.start >= clusterEind) sluit();
    let baan = banenEind.findIndex((e) => e <= b.start);
    if (baan === -1) baan = banenEind.length;
    banenEind[baan] = b.eind;
    b.baan = baan;
    cluster.push(b);
    clusterEind = Math.max(clusterEind, b.eind);
  }
  if (cluster.length) sluit();
  return items;
}

function dagKop(datum: string): { dag: string; nummer: number; maand: string } {
  const [j, m, d] = datum.split('-').map(Number);
  const wd = new Date(Date.UTC(j, m - 1, d)).getUTCDay();
  return { dag: DAGEN_KORT[wd], nummer: d, maand: MAANDEN_KORT[m - 1] };
}

export default function AgendaWeek({
  taken,
  dagen,
  vandaag,
  statussen,
  personen,
  onOpen,
  onNieuw,
  onVink,
}: {
  taken: Taak[];
  dagen: string[];
  vandaag: string;
  statussen: TaakStatus[];
  personen: TaakPersoon[];
  onOpen: (t: Taak) => void;
  onNieuw: (datum: string, tijd: string | null, soort: 'taak' | 'afspraak') => void;
  onVink: (t: Taak, klaar: boolean) => void;
}) {
  const perDag = new Map<string, Taak[]>(dagen.map((d) => [d, []]));
  for (const t of taken) if (t.vervaldatum && perDag.has(t.vervaldatum)) perDag.get(t.vervaldatum)!.push(t);

  const metTijd = taken.filter((t) => t.vervaldatum && perDag.has(t.vervaldatum) && tijdKort(t.tijd));
  const vroegste = Math.min(7 * 60, ...metTijd.map((t) => minutenVan(tijdKort(t.tijd))));
  const laatste = Math.max(19 * 60, ...metTijd.map((t) => minutenVan(tijdKort(t.eind_tijd) || plusMinuten(tijdKort(t.tijd), 30))));
  const beginUur = Math.max(0, Math.floor(vroegste / 60));
  const eindUur = Math.min(24, Math.ceil(laatste / 60));
  const uren = Array.from({ length: eindUur - beginUur }, (_, i) => beginUur + i);
  const kleurVan = (t: Taak) => kleurKlassen(statussen.find((s) => s.naam === t.werkstatus)?.kleur ?? 'grijs');
  const persoonVan = (t: Taak) => personen.find((p) => p.id === t.persoon_id) ?? null;

  const klikInKolom = (e: MouseEvent<HTMLDivElement>, datum: string) => {
    if ((e.target as HTMLElement).closest('[data-blok]')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const minuten = beginUur * 60 + Math.floor(((e.clientY - rect.top) / UUR_HOOGTE) * 2) * 30;
    const u = Math.min(23, Math.floor(minuten / 60));
    onNieuw(datum, `${String(u).padStart(2, '0')}:${minuten % 60 === 30 ? '30' : '00'}`, 'afspraak');
  };

  const zonderTijdKaart = (t: Taak) => {
    const k = kleurVan(t);
    const klaar = t.status === 'klaar';
    const afspraak = t.soort === 'afspraak';
    return (
      <div
        key={t.id}
        data-blok
        className={`group flex items-start gap-1.5 rounded-md border px-1.5 py-1 text-[12px] leading-tight ${
          afspraak ? 'border-sky-200 bg-sky-50' : 'border-line bg-white'
        } ${klaar ? 'opacity-50' : ''}`}
      >
        <input
          type="checkbox"
          checked={klaar}
          onChange={(e) => onVink(t, e.target.checked)}
          aria-label={klaar ? `${t.titel} weer openzetten` : `${t.titel} afronden`}
          className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-green-600"
        />
        <button type="button" onClick={() => onOpen(t)} className="min-w-0 flex-1 text-left">
          <span className={`block truncate font-semibold text-ink-900 ${klaar ? 'line-through' : ''}`}>{t.titel}</span>
          {t.omschrijving && <span className="block truncate text-warm">{t.omschrijving}</span>}
          <span className="mt-0.5 flex items-center gap-1">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${k.dot}`} aria-hidden="true" />
            <span className="truncate text-[11px] text-warm">{t.werkstatus}</span>
          </span>
        </button>
      </div>
    );
  };

  return (
    <div>
      {/* Computer en tablet */}
      <div className="hidden overflow-x-auto rounded-lg border border-line bg-white md:block">
        <div className="min-w-[900px]">
          {/* Daghoofden */}
          <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-line bg-mist">
            <div />
            {dagen.map((d) => {
              const k = dagKop(d);
              const isVandaag = d === vandaag;
              return (
                <div key={d} className="border-l border-line px-2 py-2 text-center">
                  <div className={`text-[11px] font-semibold uppercase tracking-wide ${isVandaag ? 'text-amber-700' : 'text-warm'}`}>{k.dag}</div>
                  <div
                    className={`mx-auto mt-0.5 flex h-8 w-8 items-center justify-center rounded-full font-display text-[16px] font-bold ${
                      isVandaag ? 'bg-amber-500 text-ink-900' : 'text-ink-900'
                    }`}
                    title={datumLang(d)}
                  >
                    {k.nummer}
                  </div>
                  <div className="text-[11px] text-warm">{k.maand}</div>
                </div>
              );
            })}
          </div>

          {/* Zonder tijd */}
          <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b-2 border-line">
            <div className="px-1 py-2 text-right text-[10px] font-semibold uppercase leading-tight text-warm">Hele dag</div>
            {dagen.map((d) => {
              const lijst = (perDag.get(d) ?? []).filter((t) => !tijdKort(t.tijd));
              return (
                <div key={d} className={`min-h-[3rem] space-y-1 border-l border-line p-1 ${d === vandaag ? 'bg-amber-50/40' : ''}`}>
                  {lijst.map(zonderTijdKaart)}
                  <button
                    type="button"
                    onClick={() => onNieuw(d, null, 'taak')}
                    className="w-full rounded px-1 py-0.5 text-left text-[11px] font-semibold text-ink-300 hover:bg-mist hover:text-ink-700"
                  >
                    + Taak
                  </button>
                </div>
              );
            })}
          </div>

          {/* Tijdbalk */}
          <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
            <div className="relative" style={{ height: uren.length * UUR_HOOGTE }}>
              {uren.map((u, i) => (
                <div key={u} className="absolute right-1 -translate-y-1/2 text-[11px] tabular-nums text-warm" style={{ top: i * UUR_HOOGTE }}>
                  {i === 0 ? '' : `${String(u).padStart(2, '0')}:00`}
                </div>
              ))}
            </div>
            {dagen.map((d) => {
              const blokken = blokkenVanDag(perDag.get(d) ?? []);
              return (
                <div
                  key={d}
                  onClick={(e) => klikInKolom(e, d)}
                  className={`relative cursor-cell border-l border-line ${d === vandaag ? 'bg-amber-50/30' : ''}`}
                  style={{ height: uren.length * UUR_HOOGTE }}
                  title="Klik om hier een afspraak te maken"
                >
                  {uren.map((u, i) => (
                    <div key={u} className="pointer-events-none absolute left-0 right-0 border-t border-line/70" style={{ top: i * UUR_HOOGTE }} />
                  ))}
                  {blokken.map((b) => {
                    const t = b.taak;
                    const afspraak = t.soort === 'afspraak';
                    const klaar = t.status === 'klaar';
                    const p = persoonVan(t);
                    const top = ((b.start - beginUur * 60) / 60) * UUR_HOOGTE;
                    const hoogte = Math.max(((b.eind - b.start) / 60) * UUR_HOOGTE - 2, 20);
                    const breedte = 100 / b.banen;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        data-blok
                        onClick={() => onOpen(t)}
                        className={`absolute overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-left text-[12px] leading-tight shadow-sm transition hover:z-10 hover:shadow-card focus:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                          afspraak ? 'border-sky-600 bg-sky-100 text-sky-950' : `border-amber-500 bg-white text-ink-900 ring-1 ring-line`
                        } ${klaar ? 'opacity-50' : ''}`}
                        style={{ top, height: hoogte, left: `calc(${b.baan * breedte}% + 2px)`, width: `calc(${breedte}% - 4px)` }}
                        title={`${tijdKort(t.tijd)}${afspraak && t.eind_tijd ? `–${tijdKort(t.eind_tijd)}` : ''} ${t.titel}`}
                      >
                        {hoogte < 36 ? (
                          <span className="flex items-center gap-1 truncate">
                            <span className="shrink-0 font-semibold tabular-nums">{tijdKort(t.tijd)}</span>
                            <span className={`truncate font-semibold ${klaar ? 'line-through' : ''}`}>{t.titel}</span>
                          </span>
                        ) : (
                          <>
                          <span className="flex items-center gap-1 font-semibold tabular-nums">
                            {tijdKort(t.tijd)}
                            {afspraak && t.eind_tijd ? `–${tijdKort(t.eind_tijd)}` : ''}
                            {t.herinnering_op && <IcoonBel className="h-3 w-3 opacity-70" />}
                            {t.herhaling !== 'geen' && <IcoonHerhaal className="h-3 w-3 opacity-70" />}
                            {p && (
                              <span className="ml-auto">
                                <Avatar persoon={p} klein />
                              </span>
                            )}
                          </span>
                          <span className={`block truncate font-semibold ${klaar ? 'line-through' : ''}`}>
                            {afspraak ? '' : 'Taak: '}
                            {t.titel}
                          </span>
                          {hoogte > 50 && t.locatie && afspraak && (
                            <span className="flex items-center gap-0.5 truncate text-[11px] opacity-80">
                              <IcoonLocatie className="h-3 w-3 shrink-0" />
                              {t.locatie}
                            </span>
                          )}
                          {hoogte > 64 && t.omschrijving && <span className="block truncate text-[11px] opacity-80">{t.omschrijving}</span>}
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Telefoon: lijst per dag */}
      <div className="space-y-4 md:hidden">
        {dagen.map((d) => {
          const lijst = [...(perDag.get(d) ?? [])].sort((a, b) => (tijdKort(a.tijd) || '00:00').localeCompare(tijdKort(b.tijd) || '00:00'));
          return (
            <section key={d}>
              <div className="flex items-center justify-between">
                <h3 className={`font-display text-[15px] font-bold ${d === vandaag ? 'text-amber-700' : 'text-ink-900'}`}>
                  {datumLang(d).replace(/^./, (x) => x.toUpperCase())}
                  {d === vandaag ? ' · vandaag' : ''}
                </h3>
                <button type="button" onClick={() => onNieuw(d, null, 'afspraak')} className="knop-tekst text-[13px]">
                  + Afspraak
                </button>
              </div>
              {lijst.length === 0 ? (
                <p className="mt-1 text-[13px] text-ink-300">Niets gepland</p>
              ) : (
                <ul className="mt-1 space-y-1.5">
                  {lijst.map((t) => {
                    const afspraak = t.soort === 'afspraak';
                    const klaar = t.status === 'klaar';
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => onOpen(t)}
                          className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left ${
                            afspraak ? 'border-sky-200 border-l-4 border-l-sky-600 bg-sky-50' : 'border-line bg-white'
                          } ${klaar ? 'opacity-50' : ''}`}
                        >
                          <span className="w-20 shrink-0 text-[13px] font-semibold tabular-nums text-ink-900">
                            {tijdKort(t.tijd) ? `${tijdKort(t.tijd)}${afspraak && t.eind_tijd ? `–${tijdKort(t.eind_tijd)}` : ''}` : 'Hele dag'}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={`block truncate text-[14px] font-semibold text-ink-900 ${klaar ? 'line-through' : ''}`}>{t.titel}</span>
                            {afspraak && t.locatie && <span className="block truncate text-[12px] text-warm">{t.locatie}</span>}
                            {!afspraak && t.omschrijving && <span className="block truncate text-[12px] text-warm">{t.omschrijving}</span>}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
