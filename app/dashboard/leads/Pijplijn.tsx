'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { verplaatsLeadActie } from './actions';
import { OpvolgLabel, ScoreBadge, STATUS_RAND, WachtLabel } from './onderdelen';
import {
  LEAD_STATUSSEN,
  OPEN_STATUSSEN,
  VERLOREN,
  VERLOREN_REDENEN,
  euro,
  statusLabel,
  type OpvolgStand,
} from '@/lib/kms/leadsModel';

export type PijplijnKaart = {
  id: string;
  naam: string;
  bedrijf: string | null;
  status: string;
  score: number;
  wachtUren: number | null;
  opvolg: OpvolgStand;
  opvolgdatum: string | null;
  volgendeStap: string | null;
  waarde: number;
  geschat: boolean;
  kans: number;
  kanaal: string;
  branche: string | null;
  aantal: string | null;
  dubbel: boolean;
  eigenaar: string | null;
};

/** Volgorde binnen een kolom: eerst wat aandacht vraagt, dan de beste leads. */
function aandacht(k: PijplijnKaart): number {
  if (k.opvolg === 'verlopen') return 0;
  if ((k.wachtUren ?? 0) >= 24) return 1;
  if (k.opvolg === 'vandaag') return 2;
  if (k.wachtUren != null) return 3;
  return 4;
}

export default function Pijplijn({ kaarten, verborgen }: { kaarten: PijplijnKaart[]; verborgen: Record<string, number> }) {
  const router = useRouter();
  const [lokaal, setLokaal] = useState<Record<string, string>>({});
  const [sleep, setSleep] = useState<string | null>(null);
  const [boven, setBoven] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [aankondiging, setAankondiging] = useState('');
  const [verloren, setVerloren] = useState<{ id: string; naam: string; terugFocus: boolean } | null>(null);
  const [, startTransition] = useTransition();
  const bord = useRef<HTMLDivElement>(null);
  const focusNa = useRef<string | null>(null);

  // Server heeft nieuwe data: lokale verschuivingen zijn dan verwerkt.
  useEffect(() => setLokaal({}), [kaarten]);

  const statusVan = (k: PijplijnKaart) => lokaal[k.id] ?? k.status;

  const kolommen = useMemo(() => {
    return LEAD_STATUSSEN.map((s) => {
      const lijst = kaarten
        .filter((k) => statusVan(k) === s)
        .sort((a, b) => aandacht(a) - aandacht(b) || b.score - a.score);
      const waarde = lijst.reduce((t, k) => t + k.waarde, 0);
      const gewogen = lijst.reduce((t, k) => t + (k.waarde * k.kans) / 100, 0);
      return { status: s, lijst, waarde, gewogen, geschat: lijst.some((k) => k.geschat && k.waarde > 0) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kaarten, lokaal]);

  // Focus terugzetten op de verplaatste kaart (toetsenbord).
  useEffect(() => {
    const id = focusNa.current;
    if (!id) return;
    focusNa.current = null;
    bord.current?.querySelector<HTMLElement>(`[data-kaart="${id}"]`)?.focus();
  }, [lokaal]);

  function verplaats(id: string, naar: string, reden?: string, viaToetsenbord = false) {
    const kaart = kaarten.find((k) => k.id === id);
    if (!kaart) return;
    const van = statusVan(kaart);
    if (van === naar) return;
    if (naar === VERLOREN && !reden) {
      setVerloren({ id, naam: kaart.bedrijf || kaart.naam, terugFocus: viaToetsenbord });
      return;
    }
    setFout(null);
    if (viaToetsenbord) focusNa.current = id;
    setLokaal((l) => ({ ...l, [id]: naar }));
    setAankondiging(`${kaart.bedrijf || kaart.naam} staat nu bij ${statusLabel(naar)}.`);
    startTransition(async () => {
      const uit = await verplaatsLeadActie(id, naar, reden ?? null);
      if (!uit.ok) {
        setLokaal((l) => ({ ...l, [id]: van }));
        setFout(uit.fout ?? 'Verplaatsen is niet gelukt.');
        setAankondiging(`Verplaatsen mislukt. ${kaart.bedrijf || kaart.naam} staat weer bij ${statusLabel(van)}.`);
        return;
      }
      router.refresh();
    });
  }

  function opToets(e: React.KeyboardEvent<HTMLElement>, k: PijplijnKaart) {
    const status = statusVan(k);
    const kolIdx = LEAD_STATUSSEN.indexOf(status as (typeof LEAD_STATUSSEN)[number]);
    const kol = kolommen[kolIdx];
    const rij = kol ? kol.lijst.findIndex((x) => x.id === k.id) : -1;
    const focus = (id: string | undefined) => {
      if (id) bord.current?.querySelector<HTMLElement>(`[data-kaart="${id}"]`)?.focus();
    };
    if (e.shiftKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      e.preventDefault();
      const naar = LEAD_STATUSSEN[kolIdx + (e.key === 'ArrowRight' ? 1 : -1)];
      if (naar) verplaats(k.id, naar, undefined, true);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      focus(kol?.lijst[rij + (e.key === 'ArrowDown' ? 1 : -1)]?.id);
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const stap = e.key === 'ArrowRight' ? 1 : -1;
      for (let i = kolIdx + stap; i >= 0 && i < kolommen.length; i += stap) {
        const doel = kolommen[i].lijst[Math.min(Math.max(rij, 0), kolommen[i].lijst.length - 1)];
        if (doel) { focus(doel.id); return; }
      }
      return;
    }
    if (e.key === 'Enter' && e.target === e.currentTarget) {
      e.preventDefault();
      router.push(`/dashboard/leads/${k.id}`);
    }
  }

  return (
    <div>
      <p id="pijplijn-uitleg" className="mb-2 text-[12px] text-warm">
        Sleep een kaart naar een andere kolom om de status te wijzigen. Met het toetsenbord: kies een kaart met Tab of de pijltjes en
        verplaats hem met Shift + pijl links of rechts. Enter opent de lead.
      </p>
      {fout && (
        <p role="alert" className="mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-800">{fout}</p>
      )}
      <p aria-live="polite" className="sr-only">{aankondiging}</p>

      <div
        ref={bord}
        className="-mx-5 grid auto-cols-[minmax(232px,1fr)] grid-flow-col gap-3 overflow-x-auto px-5 pb-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      >
        {kolommen.map((kol) => {
          const open = OPEN_STATUSSEN.includes(kol.status);
          const isDoel = sleep !== null && boven === kol.status;
          return (
            <section
              key={kol.status}
              aria-label={`${statusLabel(kol.status)}, ${kol.lijst.length} ${kol.lijst.length === 1 ? 'lead' : 'leads'}`}
              onDragOver={(e) => {
                if (!sleep) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (boven !== kol.status) setBoven(kol.status);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setBoven((b) => (b === kol.status ? null : b));
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain') || sleep;
                setSleep(null);
                setBoven(null);
                if (id) verplaats(id, kol.status);
              }}
              className={`flex min-h-[14rem] flex-col rounded-lg border border-t-[3px] ${STATUS_RAND[kol.status] ?? ''} transition-colors ${
                isDoel ? 'border-amber-400 bg-amber-50/60' : 'border-line bg-mist/70'
              }`}
            >
              <header className="flex items-baseline justify-between gap-2 px-3 pb-2 pt-2.5">
                <h3 className="flex items-baseline gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-700">
                  {statusLabel(kol.status)}
                  <span className="chip-tel">{kol.lijst.length}</span>
                </h3>
                <span className="text-right text-[12px] tabular-nums text-warm" title={open ? `Gewogen met de kans per lead: ${euro(kol.gewogen)}` : undefined}>
                  {kol.waarde > 0 ? `${kol.geschat ? '≈ ' : ''}${euro(kol.waarde)}` : ''}
                </span>
              </header>

              <ol className="flex flex-1 flex-col gap-2 px-2 pb-2">
                {kol.lijst.map((k) => (
                  <li key={k.id}>
                    <article
                      data-kaart={k.id}
                      tabIndex={0}
                      draggable
                      aria-describedby="pijplijn-uitleg"
                      aria-label={`${k.bedrijf || k.naam}, score ${k.score}`}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', k.id);
                        e.dataTransfer.effectAllowed = 'move';
                        setSleep(k.id);
                      }}
                      onDragEnd={() => {
                        setSleep(null);
                        setBoven(null);
                      }}
                      onKeyDown={(e) => opToets(e, k)}
                      className={`group relative cursor-grab rounded-md border bg-white p-2.5 text-[13px] outline-none transition-shadow active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-amber-400 ${
                        sleep === k.id ? 'opacity-50' : ''
                      } ${k.opvolg === 'verlopen' ? 'border-red-200' : 'border-line hover:border-ink-300'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            href={`/dashboard/leads/${k.id}`}
                            tabIndex={-1}
                            className="block truncate font-semibold text-ink-900 hover:text-amber-700"
                            draggable={false}
                          >
                            {k.bedrijf || k.naam}
                          </Link>
                          {k.bedrijf && <p className="truncate text-[12px] text-warm">{k.naam}</p>}
                        </div>
                        <ScoreBadge score={k.score} />
                      </div>

                      {(k.branche || k.aantal) && (
                        <p className="mt-1 truncate text-[12px] text-warm">
                          {[k.branche, k.aantal ? `${k.aantal.replace(/\s*medewerkers/i, '')} pers.` : null].filter(Boolean).join(' · ')}
                        </p>
                      )}

                      {(k.wachtUren != null || k.opvolg !== 'geen' || open) && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <WachtLabel uren={k.wachtUren} />
                          {k.wachtUren == null && (
                            <OpvolgLabel stand={k.opvolg} datum={k.opvolgdatum} stap={k.volgendeStap} toonGeen={open} />
                          )}
                        </div>
                      )}

                      <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-1.5 text-[11px] text-warm">
                        <span className="truncate">
                          {k.waarde > 0 ? <span className="font-semibold tabular-nums text-ink-700">{k.geschat ? '≈ ' : ''}{euro(k.waarde)}</span> : null}
                          {k.waarde > 0 ? ' · ' : ''}
                          {k.kanaal}
                          {k.dubbel ? <span className="ml-1 rounded bg-ink-100 px-1 font-semibold text-ink-600">dubbel?</span> : null}
                        </span>
                        <label className="shrink-0 md:opacity-0 md:transition-opacity md:focus-within:opacity-100 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                          <span className="sr-only">Status van {k.bedrijf || k.naam}</span>
                          <select
                            value={statusVan(k)}
                            onChange={(e) => verplaats(k.id, e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                            className="max-w-[7.5rem] cursor-pointer rounded border border-line bg-white py-0.5 pl-1 pr-5 text-[11px] text-ink-700 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-300"
                          >
                            {LEAD_STATUSSEN.map((s) => (
                              <option key={s} value={s}>{statusLabel(s)}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </article>
                  </li>
                ))}
                {kol.lijst.length === 0 && (
                  <li className="flex flex-1 items-center justify-center rounded-md border border-dashed border-ink-200 px-3 py-6 text-center text-[12px] text-ink-400">
                    {isDoel ? 'Laat hier los' : 'Leeg'}
                  </li>
                )}
                {(verborgen[kol.status] ?? 0) > 0 && (
                  <li className="px-1 pt-1 text-[11px] text-warm">
                    <Link href={`/dashboard/leads?weergave=lijst&status=${kol.status}`} className="underline-offset-2 hover:text-ink-900 hover:underline">
                      {verborgen[kol.status]} ouder dan 60 dagen in de lijst
                    </Link>
                  </li>
                )}
              </ol>
            </section>
          );
        })}
      </div>

      {verloren && (
        <VerlorenVenster
          naam={verloren.naam}
          onAnnuleer={() => {
            const id = verloren.id;
            setVerloren(null);
            bord.current?.querySelector<HTMLElement>(`[data-kaart="${id}"]`)?.focus();
          }}
          onBevestig={(reden) => {
            const { id, terugFocus } = verloren;
            setVerloren(null);
            verplaats(id, VERLOREN, reden, terugFocus);
          }}
        />
      )}
    </div>
  );
}

/** Verloren zetten vraagt om een reden; die gebruik je later om te zien waarom je verliest. */
function VerlorenVenster({ naam, onAnnuleer, onBevestig }: { naam: string; onAnnuleer: () => void; onBevestig: (reden: string) => void }) {
  const venster = useRef<HTMLDialogElement>(null);
  const [reden, setReden] = useState<string>('');
  const [toelichting, setToelichting] = useState('');

  useEffect(() => {
    const d = venster.current;
    if (d && !d.open) d.showModal();
  }, []);

  const volledig = reden && toelichting.trim() ? `${reden}: ${toelichting.trim()}` : reden || toelichting.trim();

  return (
    <dialog
      ref={venster}
      onCancel={(e) => { e.preventDefault(); onAnnuleer(); }}
      className="w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-line bg-white p-0 text-ink-900 shadow-card backdrop:bg-ink-900/30"
      aria-labelledby="verloren-kop"
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (volledig) onBevestig(volledig);
        }}
        className="p-5"
      >
        <h2 id="verloren-kop" className="font-display text-base font-bold">{naam} verloren</h2>
        <p className="mt-1 text-[13px] text-warm">Waarom? Dan zie je over een paar maanden waar het misgaat.</p>
        <fieldset className="mt-4 grid gap-1.5">
          <legend className="sr-only">Reden</legend>
          {VERLOREN_REDENEN.map((r) => (
            <label key={r} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-[13px] ${reden === r ? 'border-ink-900 bg-mist' : 'border-line hover:bg-mist'}`}>
              <input type="radio" name="reden" value={r} checked={reden === r} onChange={() => setReden(r)} className="h-4 w-4 accent-amber-600" />
              {r}
            </label>
          ))}
        </fieldset>
        <label className="mt-3 block">
          <span className="veld-label">Toelichting (mag leeg)</span>
          <input value={toelichting} onChange={(e) => setToelichting(e.target.value)} className="veld" placeholder="Bijv. andere leverancier was € 4 per polo goedkoper" />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onAnnuleer} className="knop-stil">Annuleren</button>
          <button type="submit" disabled={!volledig} className="knop-donker disabled:opacity-50">Zet op verloren</button>
        </div>
      </form>
    </dialog>
  );
}
