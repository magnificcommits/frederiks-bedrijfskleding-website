'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import type { Taak, TaakVelden, KlantKeuze } from '@/lib/kms/taken';
import type { TaakStatus } from '@/lib/kms/taakStatussen';
import type { TaakPersoon } from '@/lib/kms/taakPersonen';
import {
  werkTaakBijActie,
  vinkTaakActie,
  bewaarTaakActie,
  verwijderTaakActie,
  herstelTaakActie,
  archiveerTaakActie,
  verwijderDefinitiefActie,
  leegPrullenbakActie,
  type TaakResultaat,
} from './actions';
import TaakModal, { type ModalOpen } from './TaakModal';
import AgendaWeek from './AgendaWeek';
import {
  StatusPill,
  PersoonChip,
  BronBadge,
  GroeiTekst,
  MeldingBalk,
  BevestigKnop,
  IcoonAfspraak,
  IcoonTaak,
  IcoonPijl,
  IcoonPrullenbak,
  IcoonPotlood,
  IcoonBel,
  IcoonHerhaal,
  IcoonLocatie,
  IcoonArchief,
  IcoonKlok,
  type Melding,
} from './onderdelen';
import {
  plusDagen,
  maandagVan,
  datumRelatief,
  datumKort,
  tijdKort,
  tijdvak,
  verschilDagen,
  herinneringTekst,
  MAANDEN_KORT,
} from './tijd';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type Weergave = 'lijst' | 'agenda' | 'archief' | 'prullenbak';

export type TakenFilters = {
  status: string; // '' = alles behalve afgerond, '__alles' = echt alles, anders één status
  persoon: string; // '' = iedereen, '__niemand' = niemand, anders persoon-id
  soort: string; // '' | 'taak' | 'afspraak'
  bron: string; // '' | 'handmatig' | 'order' | 'portaal' | 'prospect'
  wanneer: string; // '' | 'verlopen' | 'vandaag' | 'week' | 'zonder'
  q: string;
  sort: SortKolom;
  dir: 'asc' | 'desc';
};

export type SortKolom = 'datum' | 'klant' | 'status' | 'persoon' | 'bron';

type Props = {
  weergave: Weergave;
  taken: Taak[];
  statussen: TaakStatus[];
  personen: TaakPersoon[];
  klanten: KlantKeuze[];
  vandaag: string;
  begin: TakenFilters;
  inclusiefAfgerond: boolean;
  week: string;
  herinneringen: Taak[];
  standaardPersoonId: string | null;
  beginStatus: string;
  afgerondStatus: string;
  v2: boolean;
  openTaak: Taak | null;
  startNieuw: 'taak' | 'afspraak' | null;
};

const normaal = (s: string | null | undefined) => String(s ?? '').trim().toLowerCase();

/** Groep in de lijst bij sorteren op datum (zoals Todoist en Microsoft To Do). */
function datumGroep(t: Taak, vandaag: string): string {
  const d = t.vervaldatum;
  if (!d) return 'Zonder datum';
  if (d < vandaag) return t.status === 'klaar' ? 'Eerder' : 'Verlopen';
  if (d === vandaag) return 'Vandaag';
  if (d === plusDagen(vandaag, 1)) return 'Morgen';
  const zondag = plusDagen(maandagVan(vandaag), 6);
  if (d <= zondag) return 'Later deze week';
  if (d <= plusDagen(zondag, 7)) return 'Volgende week';
  return 'Later';
}

function weekLabel(maandag: string): string {
  const zondag = plusDagen(maandag, 6);
  const [j1, m1, d1] = maandag.split('-').map(Number);
  const [j2, m2, d2] = zondag.split('-').map(Number);
  if (m1 === m2) return `${d1} – ${d2} ${MAANDEN_KORT[m2 - 1]} ${j2}`;
  return `${d1} ${MAANDEN_KORT[m1 - 1]}${j1 !== j2 ? ` ${j1}` : ''} – ${d2} ${MAANDEN_KORT[m2 - 1]} ${j2}`;
}

/* ------------------------------------------------------------------ */
/* Hoofdcomponent                                                      */
/* ------------------------------------------------------------------ */

export default function TakenWeergave(props: Props) {
  const {
    weergave,
    taken,
    statussen,
    personen,
    klanten,
    vandaag,
    begin,
    inclusiefAfgerond,
    week,
    herinneringen,
    standaardPersoonId,
    beginStatus,
    afgerondStatus,
    v2,
    openTaak,
    startNieuw,
  } = props;
  const router = useRouter();
  const pathname = usePathname();
  const [rijen, setRijen] = useState<Taak[]>(taken);
  const [filters, setFilters] = useState<TakenFilters>(begin);
  const [melding, setMelding] = useState<Melding | null>(null);
  const [modal, setModal] = useState<ModalOpen | null>(
    openTaak ? { modus: 'bewerk', taak: openTaak } : startNieuw ? { modus: 'nieuw', soort: startNieuw } : null,
  );
  const sluitMelding = useCallback(() => setMelding(null), []);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Lopende acties per taak: zolang er iets onderweg is, wint de lokale versie.
  const bezig = useRef(new Map<string, number>());
  // Net afgevinkte taken blijven zichtbaar tot de volgende keer laden (handig om terug te draaien).
  const netAfgevinkt = useRef(new Set<string>());
  const weg = useRef(new Set<string>());

  // Nieuwe serverdata samenvoegen met wat lokaal nog onderweg is.
  useEffect(() => {
    setRijen((huidig) => {
      const lokaal = new Map(huidig.map((r) => [r.id, r]));
      const uit: Taak[] = [];
      const gezien = new Set<string>();
      for (const t of taken) {
        if (weg.current.has(t.id)) continue;
        gezien.add(t.id);
        uit.push(bezig.current.get(t.id) ? (lokaal.get(t.id) ?? t) : t);
      }
      for (const r of huidig) {
        if (gezien.has(r.id) || weg.current.has(r.id)) continue;
        if (bezig.current.get(r.id) || netAfgevinkt.current.has(r.id)) uit.push(r);
      }
      return uit;
    });
  }, [taken]);

  const telBezig = (id: string, d: 1 | -1) => {
    const n = (bezig.current.get(id) ?? 0) + d;
    if (n <= 0) bezig.current.delete(id);
    else bezig.current.set(id, n);
  };

  const zetRij = (t: Taak) => setRijen((rs) => (rs.some((r) => r.id === t.id) ? rs.map((r) => (r.id === t.id ? t : r)) : [...rs, t]));
  const haalWeg = (id: string) => {
    weg.current.add(id);
    setRijen((rs) => rs.filter((r) => r.id !== id));
  };
  const zetTerug = (t: Taak) => {
    weg.current.delete(t.id);
    zetRij(t);
  };

  const isAfgerond = useCallback((naam: string | null) => statussen.find((s) => s.naam === naam)?.is_afgerond ?? false, [statussen]);

  /** Eén wijziging: meteen in beeld, daarna opslaan; bij een fout terugzetten. */
  const bewaar = useCallback(
    async (taak: Taak, velden: TaakVelden, optimistisch: Partial<Taak>) => {
      const id = taak.id;
      const vorige = taak;
      if (optimistisch.werkstatus !== undefined) {
        const klaar = isAfgerond(optimistisch.werkstatus);
        optimistisch.status = klaar ? 'klaar' : 'open';
        if (klaar) netAfgevinkt.current.add(id);
      }
      setRijen((rs) => rs.map((r) => (r.id === id ? { ...r, ...optimistisch } : r)));
      telBezig(id, 1);
      let res: TaakResultaat;
      try {
        res = await werkTaakBijActie(id, velden);
      } catch {
        res = { ok: false, fout: 'Geen verbinding. Je wijziging is niet opgeslagen.' };
      }
      telBezig(id, -1);
      if (res.ok) {
        const opgeslagen = res.taak;
        if (opgeslagen && !bezig.current.get(id)) setRijen((rs) => rs.map((r) => (r.id === id ? opgeslagen : r)));
        if (res.volgende) {
          zetRij(res.volgende);
          setMelding({ tekst: `Afgerond. De volgende staat klaar op ${datumKort(res.volgende.vervaldatum)}.`, soort: 'ok' });
        }
      } else {
        setRijen((rs) => rs.map((r) => (r.id === id ? vorige : r)));
        setMelding({ tekst: res.fout, soort: 'fout' });
      }
    },
    [isAfgerond],
  );

  /** Afvinken = afgerond; met Ongedaan maken terug naar de vorige status. */
  const afvinken = async (t: Taak, klaar: boolean) => {
    const vorigeStatus = t.werkstatus ?? beginStatus;
    const doel = klaar ? afgerondStatus : beginStatus;
    if (klaar) netAfgevinkt.current.add(t.id);
    setRijen((rs) => rs.map((r) => (r.id === t.id ? { ...r, werkstatus: doel, status: klaar ? 'klaar' : 'open' } : r)));
    telBezig(t.id, 1);
    let res: TaakResultaat;
    try {
      res = await vinkTaakActie(t.id, klaar);
    } catch {
      res = { ok: false, fout: 'Geen verbinding. Niet opgeslagen.' };
    }
    telBezig(t.id, -1);
    if (!res.ok) {
      setRijen((rs) => rs.map((r) => (r.id === t.id ? t : r)));
      setMelding({ tekst: res.fout, soort: 'fout' });
      return;
    }
    const bijgewerkt = res.taak ?? t;
    if (res.taak) zetRij(res.taak);
    const volgende = res.volgende ?? null;
    if (volgende) zetRij(volgende);
    if (!klaar) return;
    setMelding({
      tekst: volgende ? `Afgerond. Volgende keer: ${datumKort(volgende.vervaldatum)}` : `“${t.titel}” afgerond`,
      soort: 'ok',
      actie: {
        label: 'Ongedaan maken',
        onClick: async () => {
          await bewaar(bijgewerkt, { werkstatus: vorigeStatus }, { werkstatus: vorigeStatus });
          if (volgende) {
            haalWeg(volgende.id);
            const r = await verwijderTaakActie(volgende.id);
            if (r.ok) await verwijderDefinitiefActie(volgende.id);
          }
        },
      },
    });
  };

  const verwijder = async (t: Taak) => {
    if (!v2) {
      setMelding({ tekst: 'De prullenbak werkt pas na de database-update.', soort: 'fout' });
      return;
    }
    haalWeg(t.id);
    let res: TaakResultaat;
    try {
      res = await verwijderTaakActie(t.id);
    } catch {
      res = { ok: false, fout: 'Geen verbinding. De taak is niet verwijderd.' };
    }
    if (!res.ok) {
      zetTerug(t);
      setMelding({ tekst: res.fout, soort: 'fout' });
      return;
    }
    setMelding({
      tekst: t.soort === 'afspraak' ? 'Afspraak verwijderd' : 'Taak verwijderd',
      soort: 'ok',
      actie: {
        label: 'Ongedaan maken',
        onClick: async () => {
          const r = await herstelTaakActie(t.id);
          if (r.ok) zetTerug(r.taak ?? t);
          else setMelding({ tekst: r.fout, soort: 'fout' });
        },
      },
    });
  };

  const archiveer = async (t: Taak, archiveren: boolean) => {
    haalWeg(t.id);
    const res = await archiveerTaakActie(t.id, archiveren);
    if (!res.ok) {
      zetTerug(t);
      setMelding({ tekst: res.fout, soort: 'fout' });
      return;
    }
    setMelding({
      tekst: archiveren ? 'Naar het archief' : 'Terug in de lijst',
      soort: 'ok',
      actie: {
        label: 'Ongedaan maken',
        onClick: async () => {
          const r = await archiveerTaakActie(t.id, !archiveren);
          if (r.ok) zetTerug(r.taak ?? t);
        },
      },
    });
  };

  const herstel = async (t: Taak) => {
    haalWeg(t.id);
    const res = await herstelTaakActie(t.id);
    if (!res.ok) {
      zetTerug(t);
      setMelding({ tekst: res.fout, soort: 'fout' });
    } else setMelding({ tekst: 'Teruggezet in de lijst', soort: 'ok' });
  };

  const definitief = async (t: Taak) => {
    haalWeg(t.id);
    const res = await verwijderDefinitiefActie(t.id);
    if (!res.ok) {
      zetTerug(t);
      setMelding({ tekst: res.fout, soort: 'fout' });
    } else setMelding({ tekst: t.bron === 'handmatig' ? 'Definitief verwijderd' : 'Automatische taak naar het archief gezet', soort: 'ok' });
  };

  const leegmaken = async () => {
    const ids = rijen.map((r) => r.id);
    ids.forEach((id) => weg.current.add(id));
    setRijen([]);
    const res = await leegPrullenbakActie();
    if (!res.ok) {
      setMelding({ tekst: res.fout, soort: 'fout' });
      router.refresh();
    } else setMelding({ tekst: 'Prullenbak leeggemaakt', soort: 'ok' });
  };

  /* ---------- Popup ---------- */

  const openModal = (t: Taak) => setModal({ modus: 'bewerk', taak: t });
  const nieuw = useCallback((soort: 'taak' | 'afspraak', datum?: string, tijd?: string) => setModal({ modus: 'nieuw', soort, datum, tijd }), []);

  const opslaanUitModal = async (id: string | null, velden: TaakVelden): Promise<string | null> => {
    let res: TaakResultaat;
    try {
      res = await bewaarTaakActie(id, velden);
    } catch {
      return 'Geen verbinding. Probeer het nog eens.';
    }
    if (!res.ok) return res.fout;
    if (res.taak) {
      if (isAfgerond(res.taak.werkstatus)) netAfgevinkt.current.add(res.taak.id);
      weg.current.delete(res.taak.id);
      zetRij(res.taak);
    }
    if (res.volgende) zetRij(res.volgende);
    setModal(null);
    const afspraak = velden.soort === 'afspraak';
    setMelding({ tekst: id ? 'Opgeslagen' : afspraak ? 'Afspraak toegevoegd' : 'Taak toegevoegd', soort: 'ok' });
    return null;
  };

  // Sneltoetsen: N = nieuwe taak, A = nieuwe afspraak (niet tijdens typen).
  useEffect(() => {
    const opToets = (e: KeyboardEvent) => {
      if (modal || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        nieuw('taak');
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        nieuw('afspraak');
      }
    };
    window.addEventListener('keydown', opToets);
    return () => window.removeEventListener('keydown', opToets);
  }, [modal, nieuw]);

  /* ---------- Filters en sorteren ---------- */

  const zetFilter = (patch: Partial<TakenFilters>) => {
    const volgende = { ...filters, ...patch };
    setFilters(volgende);
    const params = new URLSearchParams();
    if (weergave !== 'lijst') params.set('weergave', weergave);
    if (weergave === 'agenda' && week !== maandagVan(vandaag)) params.set('week', week);
    if (volgende.status) params.set('status', volgende.status);
    if (volgende.persoon) params.set('persoon', volgende.persoon);
    if (volgende.soort) params.set('soort', volgende.soort);
    if (volgende.bron) params.set('bron', volgende.bron);
    if (volgende.wanneer) params.set('wanneer', volgende.wanneer);
    if (volgende.q) params.set('q', volgende.q);
    if (volgende.sort !== 'datum') params.set('sort', volgende.sort);
    if (volgende.dir !== 'asc') params.set('dir', volgende.dir);
    const url = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    const heeftAfgerondNodig = volgende.status === '__alles' || isAfgerond(volgende.status);
    if (weergave === 'lijst' && heeftAfgerondNodig && !inclusiefAfgerond) router.replace(url, { scroll: false });
    else window.history.replaceState(null, '', url);
  };

  const sorteer = (kolom: SortKolom) => {
    if (filters.sort === kolom) zetFilter({ dir: filters.dir === 'asc' ? 'desc' : 'asc' });
    else zetFilter({ sort: kolom, dir: 'asc' });
  };

  const persoonNaam = useCallback((t: Taak) => personen.find((p) => p.id === t.persoon_id)?.naam ?? t.toegewezen_aan ?? '', [personen]);

  const zichtbaar = useMemo(() => {
    const q = normaal(filters.q);
    const lijstFilters = weergave === 'lijst';
    const zondag = plusDagen(maandagVan(vandaag), 6);
    const lijst = rijen.filter((t) => {
      if (lijstFilters) {
        if (filters.status === '') {
          if (t.status === 'klaar' && !netAfgevinkt.current.has(t.id)) return false;
        } else if (filters.status !== '__alles') {
          if ((t.werkstatus ?? '') !== filters.status && !netAfgevinkt.current.has(t.id)) return false;
        }
        if (filters.wanneer === 'verlopen' && !(t.vervaldatum && t.vervaldatum < vandaag && t.status === 'open')) return false;
        if (filters.wanneer === 'vandaag' && t.vervaldatum !== vandaag) return false;
        if (filters.wanneer === 'week' && !(t.vervaldatum && t.vervaldatum <= zondag)) return false;
        if (filters.wanneer === 'zonder' && t.vervaldatum) return false;
      }
      if (weergave === 'lijst' || weergave === 'agenda') {
        if (filters.persoon === '__niemand' && (t.persoon_id || t.toegewezen_aan)) return false;
        if (filters.persoon && filters.persoon !== '__niemand' && t.persoon_id !== filters.persoon) return false;
        if (filters.soort && t.soort !== filters.soort) return false;
        if (filters.bron && t.bron !== filters.bron) return false;
      }
      if (q) {
        const hooiberg = [
          t.titel,
          t.omschrijving,
          t.organisatie_naam,
          t.organisatie_plaats,
          t.locatie,
          persoonNaam(t),
          t.werkstatus,
          t.ordernummer ? `#${t.ordernummer} ${t.ordernummer}` : '',
        ]
          .map(normaal)
          .join(' ');
        if (!q.split(/\s+/).every((w) => hooiberg.includes(w))) return false;
      }
      return true;
    });
    if (weergave !== 'lijst') return lijst;

    const factor = filters.dir === 'asc' ? 1 : -1;
    const tekst = (a: string, b: string) => a.localeCompare(b, 'nl', { sensitivity: 'base' });
    const opDatum = (a: Taak, b: Taak) => {
      if (a.vervaldatum !== b.vervaldatum) {
        if (!a.vervaldatum) return 1;
        if (!b.vervaldatum) return -1;
        return (a.vervaldatum < b.vervaldatum ? -1 : 1) * factor;
      }
      const ta = tijdKort(a.tijd);
      const tb = tijdKort(b.tijd);
      if (ta !== tb) {
        if (!ta) return -1;
        if (!tb) return 1;
        return (ta < tb ? -1 : 1) * factor;
      }
      return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
    };
    const volgorde = new Map(statussen.map((s, i) => [s.naam, i]));
    lijst.sort((a, b) => {
      let v = 0;
      if (filters.sort === 'klant') v = tekst(a.titel, b.titel) * factor;
      else if (filters.sort === 'status') v = ((volgorde.get(a.werkstatus ?? '') ?? 999) - (volgorde.get(b.werkstatus ?? '') ?? 999)) * factor;
      else if (filters.sort === 'persoon') {
        const pa = persoonNaam(a);
        const pb = persoonNaam(b);
        if (!pa !== !pb) return pa ? -1 : 1;
        v = tekst(pa, pb) * factor;
      } else if (filters.sort === 'bron') v = tekst(a.bron, b.bron) * factor;
      return v !== 0 ? v : opDatum(a, b);
    });
    return lijst;
  }, [rijen, filters, weergave, vandaag, statussen, persoonNaam]);

  const openRijen = rijen.filter((t) => t.status === 'open');
  const aantalVerlopen = openRijen.filter((t) => t.vervaldatum && t.vervaldatum < vandaag).length;
  const aantalVandaag = openRijen.filter((t) => t.vervaldatum === vandaag).length;
  const filtersAan =
    filters.status !== '' || filters.persoon !== '' || filters.soort !== '' || filters.bron !== '' || filters.q !== '' || filters.wanneer !== '';
  const metGroepen = weergave === 'lijst' && filters.sort === 'datum' && filters.dir === 'asc';

  /* ---------- Weergave-onderdelen ---------- */

  const tabHref = (w: Weergave) => {
    const p = new URLSearchParams();
    if (w !== 'lijst') p.set('weergave', w);
    if (filters.persoon && (w === 'lijst' || w === 'agenda')) p.set('persoon', filters.persoon);
    return p.toString() ? `${pathname}?${p.toString()}` : pathname;
  };
  const agendaHref = (maandag: string) => {
    const p = new URLSearchParams({ weergave: 'agenda' });
    if (maandag !== maandagVan(vandaag)) p.set('week', maandag);
    if (filters.persoon) p.set('persoon', filters.persoon);
    if (filters.soort) p.set('soort', filters.soort);
    return `${pathname}?${p.toString()}`;
  };

  const rijKlik = (e: MouseEvent, t: Taak) => {
    if ((e.target as HTMLElement).closest('input, select, textarea, button, a, label, [data-geen-open]')) return;
    openModal(t);
  };

  const kop = (label: string, kolom: SortKolom | null, className = '') => {
    if (!kolom) return <th className={className}>{label}</th>;
    const actief = filters.sort === kolom;
    return (
      <th className={className} aria-sort={actief ? (filters.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button type="button" onClick={() => sorteer(kolom)} className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide hover:text-ink-900">
          {label}
          <span aria-hidden="true" className={`text-[10px] ${actief ? 'text-amber-600' : 'text-ink-300'}`}>
            {actief ? (filters.dir === 'asc' ? '▲' : '▼') : '↕'}
          </span>
        </button>
      </th>
    );
  };

  /** Datum en tijd als tekst, met signalen (verlopen, vandaag, herinnering, herhaling). */
  const wanneerCel = (t: Taak) => {
    const verlopen = t.status === 'open' && !!t.vervaldatum && t.vervaldatum < vandaag;
    const isVandaag = t.vervaldatum === vandaag;
    const afspraak = t.soort === 'afspraak';
    if (!t.vervaldatum) return <span className="text-[13px] text-ink-300">Geen datum</span>;
    return (
      <div className="leading-snug">
        <span className={`text-[14px] font-semibold ${verlopen ? 'text-red-700' : isVandaag ? 'text-amber-700' : 'text-ink-900'}`}>
          {datumRelatief(t.vervaldatum, vandaag)}
        </span>
        {tijdKort(t.tijd) && (
          <span className="ml-1.5 whitespace-nowrap text-[13px] tabular-nums text-ink-700">
            {tijdKort(t.tijd)}
            {afspraak && t.eind_tijd ? `–${tijdKort(t.eind_tijd)}` : ''}
          </span>
        )}
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-warm">
          {verlopen && <span className="font-semibold text-red-700">Verlopen</span>}
          {t.herinnering_op && (
            <span className="inline-flex items-center gap-0.5" title={`Herinnering ${herinneringTekst(t.herinnering_op, vandaag)}`}>
              <IcoonBel className="h-3 w-3" />
              {herinneringTekst(t.herinnering_op, vandaag)}
            </span>
          )}
          {t.herhaling !== 'geen' && (
            <span className="inline-flex items-center gap-0.5" title="Herhalend">
              <IcoonHerhaal className="h-3 w-3" />
              {t.herhaling === 'dagelijks' ? 'elke dag' : t.herhaling === 'wekelijks' ? 'elke week' : 'elke maand'}
            </span>
          )}
        </div>
      </div>
    );
  };

  const titelBlok = (t: Taak, opties: { metTijdvak?: boolean; metBron?: boolean } = {}) => {
    const afspraak = t.soort === 'afspraak';
    const klaar = t.status === 'klaar';
    return (
      <div className="flex min-w-0 items-start gap-2">
        {afspraak && (
          <span className="mt-0.5 shrink-0 text-sky-700" title="Afspraak">
            <IcoonAfspraak />
          </span>
        )}
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => openModal(t)}
            className={`text-left text-[14px] font-semibold leading-snug text-ink-900 underline-offset-2 hover:underline ${klaar ? 'line-through decoration-ink-300' : ''}`}
          >
            {t.titel}
          </button>
          {t.prioriteit === 'hoog' && <span className="badge ml-1.5 bg-red-100 align-middle text-red-800">Hoog</span>}
          {afspraak && opties.metTijdvak && (
            <div className="mt-0.5 text-[13px] font-semibold text-sky-800">{tijdvak(t.vervaldatum, t.tijd, t.eind_tijd, vandaag)}</div>
          )}
          {afspraak && t.locatie && (
            <div className="mt-0.5 flex items-center gap-1 text-[12px] text-warm">
              <IcoonLocatie className="h-3 w-3 shrink-0" />
              <span className="truncate">{t.locatie}</span>
            </div>
          )}
          {t.organisatie_id && (
            <div className="mt-0.5">
              <Link
                href={`/dashboard/klanten/${t.organisatie_id}`}
                className="text-[12px] font-semibold text-warm hover:text-amber-700 hover:underline"
              >
                {t.organisatie_naam && normaal(t.organisatie_naam) !== normaal(t.titel) ? t.organisatie_naam : 'Klantkaart'}
                {t.organisatie_plaats ? ` · ${t.organisatie_plaats}` : ''}
                <IcoonPijl className="ml-0.5 inline-block h-3 w-3 align-[-1px]" />
              </Link>
            </div>
          )}
          {opties.metBron && (
            <div className="mt-1">
              <BronBadge taak={t} />
            </div>
          )}
        </div>
      </div>
    );
  };

  const leegTekst: ReactNode = filtersAan
    ? 'Geen taken die bij deze filters passen.'
    : 'Niets te doen. Nieuwe orders en portaalbestellingen verschijnen hier vanzelf.';

  const filterSelect = 'veld w-auto min-w-[9rem] py-2 text-[14px]';
  // Op de telefoon staan de keuzelijsten achter "Filters"; zoeken blijft altijd zichtbaar.
  const opTelefoon = filtersOpen ? '' : 'max-md:hidden';

  /* ---------- Lijst ---------- */

  const lijstWeergave = () => {
    const regels: ReactNode[] = [];
    const kaarten: ReactNode[] = [];
    let vorigeGroep = '';
    for (const t of zichtbaar) {
      const klaar = t.status === 'klaar';
      const afspraak = t.soort === 'afspraak';
      if (metGroepen) {
        const g = datumGroep(t, vandaag);
        if (g !== vorigeGroep) {
          vorigeGroep = g;
          const aantal = zichtbaar.filter((x) => datumGroep(x, vandaag) === g).length;
          const kleur = g === 'Verlopen' ? 'text-red-700' : g === 'Vandaag' ? 'text-amber-700' : 'text-ink-900';
          regels.push(
            <tr key={`groep-${g}`} className="hover:!bg-transparent">
              <td colSpan={7} className="!bg-white !pb-1 !pl-5 !pt-4">
                <span className={`font-display text-[14px] font-bold ${kleur}`}>{g}</span>
                <span className="ml-2 text-[12px] text-warm">{aantal}</span>
              </td>
            </tr>,
          );
          kaarten.push(
            <h3 key={`groep-${g}`} className={`px-1 pt-3 font-display text-[14px] font-bold ${kleur}`}>
              {g} <span className="text-[12px] font-normal text-warm">{aantal}</span>
            </h3>,
          );
        }
      }
      regels.push(
        <tr
          key={t.id}
          onClick={(e) => rijKlik(e, t)}
          className={`cursor-pointer ${afspraak ? 'bg-sky-50/70' : ''} ${klaar ? 'opacity-60' : ''}`}
        >
          <td className={`!py-3 !pl-5 !pr-2 !align-top ${afspraak ? 'border-l-4 border-l-sky-500' : 'border-l-4 border-l-transparent'}`}>
            <input
              type="checkbox"
              checked={klaar}
              onChange={(e) => afvinken(t, e.target.checked)}
              aria-label={klaar ? `${t.titel} weer openzetten` : `${t.titel} afronden`}
              className="mt-0.5 h-5 w-5 cursor-pointer rounded border-ink-300 accent-green-600"
            />
          </td>
          <td className="!py-3 !pl-3 !align-top">{titelBlok(t, { metBron: t.bron !== 'handmatig' })}</td>
          <td className="!py-2 !align-top">
            <GroeiTekst
              waarde={t.omschrijving}
              label="Wat moet er gebeuren?"
              placeholder="Wat moet er gebeuren?"
              onOpslaan={(v) => bewaar(t, { omschrijving: v }, { omschrijving: v.trim() || null })}
            />
          </td>
          <td className="!py-3 !align-top">{wanneerCel(t)}</td>
          <td className="!py-2.5 !align-top">
            <StatusPill waarde={t.werkstatus} statussen={statussen} onKies={(w) => bewaar(t, { werkstatus: w }, { werkstatus: w })} />
          </td>
          <td className="!py-2 !align-top">
            <PersoonChip
              persoonId={t.persoon_id}
              losseNaam={t.toegewezen_aan}
              personen={personen}
              disabled={!v2}
              onKies={(id) =>
                bewaar(t, { persoon_id: id }, { persoon_id: id, toegewezen_aan: personen.find((p) => p.id === id)?.naam ?? null })
              }
            />
          </td>
          <td className="!py-2 !pr-4 !align-top">
            <div className="flex justify-end gap-0.5">
              <button type="button" onClick={() => openModal(t)} title="Openen" aria-label={`${t.titel} openen`} className="rounded-md p-1.5 text-ink-400 hover:bg-mist hover:text-ink-900">
                <IcoonPotlood />
              </button>
              <button
                type="button"
                onClick={() => verwijder(t)}
                title="Naar prullenbak"
                aria-label={`${t.titel} verwijderen`}
                className="rounded-md p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-700"
              >
                <IcoonPrullenbak />
              </button>
            </div>
          </td>
        </tr>,
      );
      kaarten.push(
        <div
          key={t.id}
          onClick={(e) => rijKlik(e, t)}
          className={`cursor-pointer rounded-lg border p-3 pl-4 ${afspraak ? 'border-sky-200 border-l-4 border-l-sky-500 bg-sky-50/70' : 'border-line bg-white'} ${
            klaar ? 'opacity-60' : ''
          }`}
        >
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={klaar}
              onChange={(e) => afvinken(t, e.target.checked)}
              aria-label={klaar ? `${t.titel} weer openzetten` : `${t.titel} afronden`}
              className="mt-0.5 h-6 w-6 shrink-0 cursor-pointer accent-green-600"
            />
            <div className="min-w-0 flex-1">{titelBlok(t, { metTijdvak: true })}</div>
            <div className="shrink-0">
              <BronBadge taak={t} />
            </div>
          </div>
          <div className="mt-1.5">
            <GroeiTekst
              waarde={t.omschrijving}
              label="Wat moet er gebeuren?"
              placeholder="Wat moet er gebeuren?"
              onOpslaan={(v) => bewaar(t, { omschrijving: v }, { omschrijving: v.trim() || null })}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            {!afspraak ? wanneerCel(t) : <span />}
            <PersoonChip
              persoonId={t.persoon_id}
              losseNaam={t.toegewezen_aan}
              personen={personen}
              disabled={!v2}
              onKies={(id) => bewaar(t, { persoon_id: id }, { persoon_id: id, toegewezen_aan: personen.find((p) => p.id === id)?.naam ?? null })}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <StatusPill waarde={t.werkstatus} statussen={statussen} onKies={(w) => bewaar(t, { werkstatus: w }, { werkstatus: w })} />
            <button type="button" onClick={() => verwijder(t)} className="rounded-md px-2 py-1.5 text-[13px] font-semibold text-red-700 hover:bg-red-50">
              Verwijderen
            </button>
          </div>
        </div>,
      );
    }

    return (
      <>
        <div className="mt-4 hidden overflow-x-auto rounded-lg border border-line bg-white md:block">
          <table className="tbl min-w-[1000px] table-fixed text-[14px]">
            <thead>
              <tr>
                <th className="w-[3.5rem] !pl-6" aria-label="Afgerond">
                  <span aria-hidden="true">✓</span>
                </th>
                {kop('Klant / onderwerp', 'klant', 'w-[15.5rem] !pl-3')}
                {kop('Wat moet er gebeuren?', null, '')}
                {kop('Wanneer', 'datum', 'w-[10rem]')}
                {kop('Status', 'status', 'w-[12rem]')}
                {kop('Persoon', 'persoon', 'w-[9.5rem]')}
                <th className="w-[5rem]" aria-label="Acties" />
              </tr>
            </thead>
            <tbody>
              {zichtbaar.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-warm">
                    {leegTekst}
                  </td>
                </tr>
              ) : (
                regels
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 space-y-3 md:hidden">
          {zichtbaar.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line bg-mist px-4 py-6 text-center text-[14px] text-warm">{leegTekst}</p>
          ) : (
            kaarten
          )}
        </div>
      </>
    );
  };

  /* ---------- Archief en prullenbak ---------- */

  const bakWeergave = (soort: 'archief' | 'prullenbak') => {
    const isBak = soort === 'prullenbak';
    return (
      <div className="mt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-[13px] text-warm">
            {isBak
              ? 'Verwijderde taken blijven hier 30 dagen staan. Daarna worden ze vanzelf definitief verwijderd. Automatische taken (uit orders of prospects) gaan dan naar het archief, anders komen ze terug.'
              : 'Afgeronde taken komen hier 14 dagen na het afronden vanzelf terecht. Je kunt ook zelf een taak archiveren vanuit het venster.'}
          </p>
          {isBak && rijen.length > 0 && (
            <BevestigKnop onBevestig={leegmaken} bevestig="Alles definitief weg?" className="knop-stil text-red-700">
              Prullenbak leegmaken
            </BevestigKnop>
          )}
        </div>
        {!v2 && <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[14px]">Dit werkt zodra de database is bijgewerkt (migratie taken v2).</p>}
        <div className="overflow-x-auto rounded-lg border border-line bg-white">
          <table className="tbl min-w-[860px] text-[14px]">
            <thead>
              <tr>
                <th className="!pl-5">Klant / onderwerp</th>
                <th>Omschrijving</th>
                <th className="w-[9rem]">Datum</th>
                <th className="w-[11rem]">Status</th>
                <th className="w-[10rem]">{isBak ? 'Verwijderd' : 'Gearchiveerd'}</th>
                <th className="w-[15rem]" aria-label="Acties" />
              </tr>
            </thead>
            <tbody>
              {zichtbaar.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-warm">
                    {filters.q ? 'Niets gevonden.' : isBak ? 'De prullenbak is leeg.' : 'Het archief is nog leeg.'}
                  </td>
                </tr>
              )}
              {zichtbaar.map((t) => {
                const moment = (isBak ? t.verwijderd_op : t.gearchiveerd_op) ?? '';
                const dag = moment ? moment.slice(0, 10) : '';
                const nogDagen = isBak && dag ? Math.max(0, 30 - verschilDagen(dag, vandaag)) : null;
                return (
                  <tr key={t.id}>
                    <td className="!py-2.5 !pl-5 !align-top">
                      <div className="flex items-start gap-2">
                        {t.soort === 'afspraak' && (
                          <span className="mt-0.5 text-sky-700">
                            <IcoonAfspraak />
                          </span>
                        )}
                        <div>
                          <p className="font-semibold text-ink-900">{t.titel}</p>
                          <div className="mt-0.5">
                            <BronBadge taak={t} />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="!py-2.5 !align-top text-warm">
                      <p className="line-clamp-2 whitespace-pre-line">{t.omschrijving}</p>
                    </td>
                    <td className="!py-2.5 !align-top">{t.vervaldatum ? datumKort(t.vervaldatum) : '–'}</td>
                    <td className="!py-2.5 !align-top">
                      <span className="text-[13px]">{t.werkstatus}</span>
                    </td>
                    <td className="!py-2.5 !align-top text-[13px]">
                      {dag ? datumKort(dag) : '–'}
                      {nogDagen !== null && <span className="block text-[12px] text-warm">nog {nogDagen} {nogDagen === 1 ? 'dag' : 'dagen'}</span>}
                    </td>
                    <td className="!py-2 !align-top">
                      <div className="flex flex-wrap justify-end gap-1">
                        {isBak ? (
                          <>
                            <button type="button" onClick={() => herstel(t)} className="knop-stil">
                              Terugzetten
                            </button>
                            <BevestigKnop onBevestig={() => definitief(t)} bevestig="Definitief?">
                              Definitief verwijderen
                            </BevestigKnop>
                          </>
                        ) : (
                          <>
                            <button type="button" onClick={() => archiveer(t, false)} className="knop-stil">
                              Terugzetten
                            </button>
                            <button type="button" onClick={() => verwijder(t)} className="knop-tekst text-red-700 hover:bg-red-50">
                              Verwijderen
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  /* ---------- Opbouw ---------- */

  const dagen = Array.from({ length: 7 }, (_, i) => plusDagen(week, i));
  const tabs: { w: Weergave; label: string; icoon: ReactNode }[] = [
    { w: 'lijst', label: 'Lijst', icoon: <IcoonTaak /> },
    { w: 'agenda', label: 'Agenda', icoon: <IcoonAfspraak /> },
    { w: 'archief', label: 'Archief', icoon: <IcoonArchief /> },
    { w: 'prullenbak', label: 'Prullenbak', icoon: <IcoonPrullenbak /> },
  ];

  return (
    <div>
      {/* Weergaven + knoppen */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="inline-flex max-w-full overflow-x-auto rounded-lg border border-line bg-mist p-0.5" aria-label="Weergave">
          {tabs.map((t) => (
            <Link
              key={t.w}
              href={tabHref(t.w)}
              aria-current={weergave === t.w ? 'page' : undefined}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-semibold sm:px-3 ${
                weergave === t.w ? 'bg-white text-ink-900 shadow-sm' : 'text-warm hover:text-ink-900'
              }`}
            >
              <span className="hidden sm:inline-flex">{t.icoon}</span>
              {t.label}
            </Link>
          ))}
        </nav>
        <div className="flex gap-2">
          <button type="button" onClick={() => nieuw('taak')} className="knop-donker py-2 text-[14px]" title="Sneltoets: N">
            <IcoonTaak /> Nieuwe taak
          </button>
          <button type="button" onClick={() => nieuw('afspraak')} className="knop bg-sky-600 py-2 text-[14px] text-white hover:bg-sky-700" title="Sneltoets: A">
            <IcoonAfspraak /> Nieuwe afspraak
          </button>
        </div>
      </div>

      {/* Herinneringen van vandaag */}
      {(weergave === 'lijst' || weergave === 'agenda') && <HerinneringBanner taken={herinneringen} vandaag={vandaag} onOpen={openModal} />}

      {/* Samenvatting */}
      {weergave === 'lijst' && (
        <p className="mt-4 text-[14px] text-warm">
          <span className="font-semibold text-ink-900">{openRijen.length}</span> open
          {aantalVandaag > 0 && (
            <>
              {' · '}
              <button type="button" onClick={() => zetFilter({ wanneer: filters.wanneer === 'vandaag' ? '' : 'vandaag' })} className="font-semibold text-amber-700 hover:underline">
                {aantalVandaag} vandaag
              </button>
            </>
          )}
          {aantalVerlopen > 0 && (
            <>
              {' · '}
              <button type="button" onClick={() => zetFilter({ wanneer: filters.wanneer === 'verlopen' ? '' : 'verlopen' })} className="font-semibold text-red-700 hover:underline">
                {aantalVerlopen} verlopen
              </button>
            </>
          )}
        </p>
      )}

      {/* Filters */}
      <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-mist p-3">
        <label className="flex min-w-[12rem] flex-1 flex-col">
          <span className="veld-label">Zoeken</span>
          <input
            type="search"
            value={filters.q}
            onChange={(e) => zetFilter({ q: e.target.value })}
            placeholder="Klant, omschrijving, ordernummer…"
            className="veld py-2 text-[14px]"
          />
        </label>
        {weergave !== 'archief' && weergave !== 'prullenbak' && (
          <button type="button" onClick={() => setFiltersOpen((v) => !v)} className="knop-stil py-2 text-[14px] md:hidden" aria-expanded={filtersOpen}>
            {filtersOpen ? 'Minder filters' : `Filters${filtersAan ? ' (aan)' : ''}`}
          </button>
        )}
        {weergave === 'lijst' && (
          <>
            <label className={`flex flex-col ${opTelefoon}`}>
              <span className="veld-label">Status</span>
              <select value={filters.status} onChange={(e) => zetFilter({ status: e.target.value })} className={filterSelect}>
                <option value="">Alles behalve afgerond</option>
                <option value="__alles">Alles, ook afgerond</option>
                <optgroup label="Alleen deze status">
                  {statussen.map((s) => (
                    <option key={s.id} value={s.naam}>
                      {s.naam}
                      {s.actief ? '' : ' (uitgezet)'}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
            <label className={`flex flex-col ${opTelefoon}`}>
              <span className="veld-label">Wanneer</span>
              <select value={filters.wanneer} onChange={(e) => zetFilter({ wanneer: e.target.value })} className={filterSelect}>
                <option value="">Altijd</option>
                <option value="verlopen">Verlopen</option>
                <option value="vandaag">Vandaag</option>
                <option value="week">T/m deze week</option>
                <option value="zonder">Zonder datum</option>
              </select>
            </label>
          </>
        )}
        {(weergave === 'lijst' || weergave === 'agenda') && (
          <>
            <label className={`flex flex-col ${opTelefoon}`}>
              <span className="veld-label">Persoon</span>
              <select value={filters.persoon} onChange={(e) => zetFilter({ persoon: e.target.value })} className={filterSelect}>
                <option value="">Iedereen</option>
                <option value="__niemand">Nog niemand</option>
                {personen.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.naam}
                    {p.actief ? '' : ' (uitgezet)'}
                  </option>
                ))}
              </select>
            </label>
            <label className={`flex flex-col ${opTelefoon}`}>
              <span className="veld-label">Soort</span>
              <select value={filters.soort} onChange={(e) => zetFilter({ soort: e.target.value })} className={filterSelect}>
                <option value="">Taken en afspraken</option>
                <option value="taak">Alleen taken</option>
                <option value="afspraak">Alleen afspraken</option>
              </select>
            </label>
            <label className={`flex flex-col ${opTelefoon}`}>
              <span className="veld-label">Herkomst</span>
              <select value={filters.bron} onChange={(e) => zetFilter({ bron: e.target.value })} className={filterSelect}>
                <option value="">Alles</option>
                <option value="handmatig">Zelf gemaakt</option>
                <option value="order">Uit orders</option>
                <option value="portaal">Uit het klantportaal</option>
                <option value="prospect">Uit prospect-brieven</option>
              </select>
            </label>
          </>
        )}
        {filtersAan && (
          <button
            type="button"
            onClick={() => zetFilter({ status: '', persoon: '', soort: '', bron: '', wanneer: '', q: '' })}
            className="knop-tekst py-2 text-[14px]"
          >
            Filters wissen
          </button>
        )}
      </div>

      {weergave === 'lijst' && lijstWeergave()}

      {weergave === 'agenda' && (
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Link href={agendaHref(plusDagen(week, -7))} className="knop-stil px-2.5" aria-label="Vorige week">
                ‹
              </Link>
              <Link href={agendaHref(maandagVan(vandaag))} className="knop-stil">
                Deze week
              </Link>
              <Link href={agendaHref(plusDagen(week, 7))} className="knop-stil px-2.5" aria-label="Volgende week">
                ›
              </Link>
              <h2 className="ml-3 font-display text-[16px] font-bold text-ink-900">{weekLabel(week)}</h2>
            </div>
            <p className="flex items-center gap-3 text-[12px] text-warm">
              <span className="inline-flex items-center gap-1">
                <span className="h-3 w-3 rounded-sm border-l-4 border-sky-600 bg-sky-100" aria-hidden="true" /> Afspraak
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-3 w-3 rounded-sm border-l-4 border-amber-500 bg-white ring-1 ring-line" aria-hidden="true" /> Taak met tijd
              </span>
              <span className="hidden items-center gap-1 lg:inline-flex">
                <IcoonKlok /> Klik in de agenda om een afspraak te maken
              </span>
            </p>
          </div>
          <AgendaWeek
            taken={zichtbaar}
            dagen={dagen}
            vandaag={vandaag}
            statussen={statussen}
            personen={personen}
            onOpen={openModal}
            onNieuw={(datum, tijd, soort) => nieuw(soort, datum, tijd ?? undefined)}
            onVink={afvinken}
          />
        </div>
      )}

      {weergave === 'archief' && bakWeergave('archief')}
      {weergave === 'prullenbak' && bakWeergave('prullenbak')}

      {modal && (
        <TaakModal
          key={modal.modus === 'bewerk' ? modal.taak.id : `nieuw-${modal.soort}-${modal.datum ?? ''}-${modal.tijd ?? ''}`}
          open={modal}
          onSluit={() => setModal(null)}
          onOpslaan={opslaanUitModal}
          onVerwijder={(t) => {
            setModal(null);
            void verwijder(t);
          }}
          onArchiveer={(t) => {
            setModal(null);
            void archiveer(t, true);
          }}
          klanten={klanten}
          statussen={statussen}
          personen={personen}
          vandaag={vandaag}
          beginStatus={beginStatus}
          standaardPersoonId={standaardPersoonId}
          v2={v2}
        />
      )}

      <MeldingBalk melding={melding} onSluit={sluitMelding} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Banner met herinneringen van vandaag                                */
/* ------------------------------------------------------------------ */

const GEZIEN_SLEUTEL = 'fb-taken-herinneringen-gezien';

function HerinneringBanner({ taken, vandaag, onOpen }: { taken: Taak[]; vandaag: string; onOpen: (t: Taak) => void }) {
  const [gezien, setGezien] = useState<Set<string>>(new Set());
  const [nu, setNu] = useState<number>(0);
  useEffect(() => {
    try {
      const ruw = window.localStorage.getItem(GEZIEN_SLEUTEL);
      if (ruw) setGezien(new Set(JSON.parse(ruw) as string[]));
    } catch {
      // Geen opslag beschikbaar: dan alles tonen.
    }
    setNu(Date.now());
    const t = setInterval(() => setNu(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const sleutel = (t: Taak) => `${t.id}|${t.herinnering_op}`;
  const lijst = taken.filter((t) => !gezien.has(sleutel(t)));
  if (lijst.length === 0) return null;

  const markeer = (keys: string[]) => {
    const volgende = new Set(gezien);
    keys.forEach((k) => volgende.add(k));
    setGezien(volgende);
    try {
      window.localStorage.setItem(GEZIEN_SLEUTEL, JSON.stringify([...volgende].slice(-200)));
    } catch {
      // negeren
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[14px] font-bold text-ink-900">
          <IcoonBel className="h-4 w-4 text-amber-700" />
          Herinneringen vandaag ({lijst.length})
        </p>
        <button type="button" onClick={() => markeer(lijst.map(sleutel))} className="knop-tekst text-[13px]">
          Alles gezien
        </button>
      </div>
      <ul className="mt-2 space-y-1">
        {lijst.map((t) => {
          const nuAl = nu > 0 && t.herinnering_op ? new Date(t.herinnering_op).getTime() <= nu : false;
          return (
            <li key={t.id} className="flex flex-wrap items-center gap-2 text-[14px]">
              <span className={`w-28 shrink-0 text-[13px] font-semibold tabular-nums ${nuAl ? 'text-red-700' : 'text-amber-800'}`}>
                {nuAl ? 'Nu' : herinneringTekst(t.herinnering_op, vandaag)}
              </span>
              <button type="button" onClick={() => onOpen(t)} className="min-w-0 flex-1 truncate text-left font-semibold text-ink-900 hover:underline">
                {t.soort === 'afspraak' ? 'Afspraak: ' : ''}
                {t.titel}
                {t.vervaldatum && <span className="ml-2 font-normal text-warm">{tijdvak(t.vervaldatum, t.tijd, t.soort === 'afspraak' ? t.eind_tijd : null, vandaag)}</span>}
              </button>
              <button type="button" onClick={() => markeer([sleutel(t)])} className="knop-tekst py-0.5 text-[12px]">
                Gezien
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
