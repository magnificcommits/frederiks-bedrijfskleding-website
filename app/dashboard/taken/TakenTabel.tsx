'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { Taak, TaakVelden } from '@/lib/kms/taken';
import { statusKleur, PILL_KLASSEN } from './statusKleur';
import { werkTaakBijActie, maakSnelleTaakActie, verwijderTaakInlineActie, type TaakResultaat } from './actions';

/* ------------------------------------------------------------------ */
/* Types en hulpjes                                                    */
/* ------------------------------------------------------------------ */

export type Org = { id: string; naam: string };

export type TakenFilters = {
  status: string; // '' = alles behalve Afgerond, '__alles' = echt alles, anders één werkstatus
  persoon: string; // '' = iedereen, '__niemand' = niemand toegewezen
  soort: string; // '' | 'taak' | 'afspraak'
  bron: string; // '' | 'handmatig' | 'order' | 'portaal'
  q: string;
  sort: SortKolom;
  dir: 'asc' | 'desc';
};

export type SortKolom = 'datum' | 'klant' | 'status' | 'persoon' | 'bron';

type Props = {
  taken: Taak[];
  organisaties: Org[];
  personen: string[];
  werkstatussen: readonly string[];
  /** Zitten afgeronde taken in de geladen lijst? Zo niet, dan moet de server ze ophalen. */
  inclusiefAfgerond: boolean;
  vandaag: string;
  begin: TakenFilters;
};

const DAGEN = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const MAANDEN = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

/** "di 6 okt" — kort en leesbaar, zoals in Notion. */
function datumKort(iso: string | null): string {
  if (!iso) return '';
  const [j, m, d] = iso.split('-').map(Number);
  if (!j || !m || !d) return '';
  const dt = new Date(Date.UTC(j, m - 1, d));
  return `${DAGEN[dt.getUTCDay()]} ${d} ${MAANDEN[m - 1]}${j !== new Date().getFullYear() ? ` ${j}` : ''}`;
}

const normaal = (s: string | null | undefined) => String(s ?? '').trim().toLowerCase();

function zoekOrg(organisaties: Org[], naam: string): Org | undefined {
  const n = normaal(naam);
  if (!n) return undefined;
  return organisaties.find((o) => normaal(o.naam) === n);
}

/* ------------------------------------------------------------------ */
/* Iconen (inline, geen extra pakketten)                                */
/* ------------------------------------------------------------------ */

function IcoonAfspraak({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} className={className} aria-hidden="true">
      <rect x="3" y="4.5" width="14" height="12.5" rx="2" />
      <path d="M3 8.5h14M7 2.5v4M13 2.5v4" strokeLinecap="round" />
    </svg>
  );
}
function IcoonTaak({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} className={className} aria-hidden="true">
      <rect x="3" y="3" width="14" height="14" rx="3" />
      <path d="M6.5 10.2l2.4 2.4 4.6-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IcoonPijl() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M7 13l6-6M8 7h5v5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IcoonPrullenbak() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-4 w-4" aria-hidden="true">
      <path d="M4 6h12M8 6V4h4v2M6 6l.8 10h6.4L14 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Bewerkbare cellen                                                   */
/* ------------------------------------------------------------------ */

const celInvoer =
  'w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-[14px] text-ink-900 ' +
  'placeholder:text-ink-300 hover:border-line focus:border-amber-400 focus:bg-white focus:outline-none ' +
  'focus:ring-2 focus:ring-amber-200 disabled:opacity-60';

/** Eén regel tekst; opslaan bij Enter of wegklikken, Escape zet terug. */
function TekstCel({
  waarde,
  onOpslaan,
  placeholder,
  list,
  label,
  disabled,
  vet,
}: {
  waarde: string | null;
  onOpslaan: (v: string) => void;
  placeholder?: string;
  list?: string;
  label: string;
  disabled?: boolean;
  vet?: boolean;
}) {
  const [concept, setConcept] = useState(waarde ?? '');
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) setConcept(waarde ?? '');
  }, [waarde, focus]);

  const opslaan = () => {
    if (concept.trim() !== (waarde ?? '').trim()) onOpslaan(concept.trim());
  };
  return (
    <input
      type="text"
      value={concept}
      list={list}
      aria-label={label}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => setConcept(e.target.value)}
      onFocus={() => setFocus(true)}
      onBlur={() => {
        setFocus(false);
        opslaan();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
          setConcept(waarde ?? '');
          setTimeout(() => (e.target as HTMLInputElement).blur(), 0);
        }
      }}
      className={`${celInvoer} ${vet ? 'font-semibold' : ''}`}
    />
  );
}

/** Meerregelige tekst die meegroeit. Opslaan bij wegklikken; Escape zet terug. */
function MeerregeligCel({
  waarde,
  onOpslaan,
  label,
  placeholder,
  disabled,
}: {
  waarde: string | null;
  onOpslaan: (v: string) => void;
  label: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [concept, setConcept] = useState(waarde ?? '');
  const [focus, setFocus] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!focus) setConcept(waarde ?? '');
  }, [waarde, focus]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [concept]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={concept}
      aria-label={label}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => setConcept(e.target.value)}
      onFocus={() => setFocus(true)}
      onBlur={() => {
        setFocus(false);
        if (concept.trim() !== (waarde ?? '').trim()) onOpslaan(concept);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setConcept(waarde ?? '');
          setTimeout(() => (e.target as HTMLTextAreaElement).blur(), 0);
        }
        // Ctrl/Cmd+Enter: klaar met typen.
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) (e.target as HTMLTextAreaElement).blur();
      }}
      className={`${celInvoer} block min-h-[36px] resize-none overflow-hidden whitespace-pre-wrap leading-snug`}
    />
  );
}

/** Status als gekleurde pill met keuzelijst. */
function StatusPill({
  waarde,
  opties,
  onKies,
  disabled,
  label = 'Status',
}: {
  waarde: string | null;
  opties: readonly string[];
  onKies: (v: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  const w = waarde || 'Niet gestart';
  const k = PILL_KLASSEN[statusKleur(w)];
  return (
    <span className={`relative inline-flex max-w-full items-center gap-1.5 rounded-full py-1 pl-2.5 pr-1 text-[13px] font-semibold ${k.pill}`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${k.dot}`} aria-hidden="true" />
      <select
        value={w}
        aria-label={label}
        disabled={disabled}
        onChange={(e) => onKies(e.target.value)}
        className="max-w-[13rem] cursor-pointer appearance-none truncate bg-transparent pr-5 font-semibold focus:outline-none"
      >
        {opties.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <svg viewBox="0 0 20 20" className="pointer-events-none absolute right-2 h-3 w-3 opacity-60" aria-hidden="true">
        <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      </svg>
    </span>
  );
}

function BronBadge({ taak }: { taak: Taak }) {
  if (taak.bron === 'order' && taak.order_id) {
    return (
      <Link
        href={`/dashboard/orders/${taak.order_id}`}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded bg-amber-50 px-1.5 py-0.5 text-[12px] font-semibold text-amber-800 hover:bg-amber-100 hover:underline"
      >
        Order #{taak.ordernummer ?? '…'}
        <IcoonPijl />
      </Link>
    );
  }
  if (taak.bron === 'portaal') {
    const inhoud = (
      <>
        Portaalbestelling
        {taak.organisatie_id && <IcoonPijl />}
      </>
    );
    return taak.organisatie_id ? (
      <Link
        href={`/dashboard/klanten/${taak.organisatie_id}`}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded bg-sky-50 px-1.5 py-0.5 text-[12px] font-semibold text-sky-800 hover:bg-sky-100 hover:underline"
      >
        {inhoud}
      </Link>
    ) : (
      <span className="inline-flex whitespace-nowrap rounded bg-sky-50 px-1.5 py-0.5 text-[12px] font-semibold text-sky-800">
        {inhoud}
      </span>
    );
  }
  if (taak.bron === 'prospect' && taak.prospect_id) {
    return (
      <Link
        href={`/dashboard/prospects/${taak.prospect_id}`}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded bg-emerald-50 px-1.5 py-0.5 text-[12px] font-semibold text-emerald-800 hover:bg-emerald-100 hover:underline"
      >
        Prospect
        <IcoonPijl />
      </Link>
    );
  }
  if (taak.bron === 'offerte') return <span className="badge-rust">Offerte</span>;
  if (taak.bron === 'inkoop') return <span className="badge-rust">Inkoop</span>;
  return <span className="badge-rust">Zelf gemaakt</span>;
}

/** Klantnaam bewerken; bij een bekende klant wordt hij gekoppeld en komt er een link. */
function KlantCel({
  taak,
  organisaties,
  onOpslaan,
  disabled,
}: {
  taak: Taak;
  organisaties: Org[];
  onOpslaan: (velden: TaakVelden, optimistisch: Partial<Taak>) => void;
  disabled?: boolean;
}) {
  const orgNaam = taak.organisatie_naam ?? null;
  return (
    <div className="min-w-0">
      <TekstCel
        waarde={taak.titel}
        label="Klant of onderwerp"
        list="taken-klanten"
        disabled={disabled}
        vet
        onOpslaan={(v) => {
          if (!v) return;
          const org = zoekOrg(organisaties, v);
          onOpslaan(
            { titel: org?.naam ?? v, organisatie_id: org?.id ?? null },
            { titel: org?.naam ?? v, organisatie_id: org?.id ?? null, organisatie_naam: org?.naam ?? null },
          );
        }}
      />
      {taak.organisatie_id && (
        <Link
          href={`/dashboard/klanten/${taak.organisatie_id}`}
          className="ml-2 inline-flex items-center gap-1 text-[12px] font-semibold text-warm hover:text-amber-700 hover:underline"
        >
          {orgNaam && normaal(orgNaam) !== normaal(taak.titel) ? orgNaam : 'Klantkaart'}
          <IcoonPijl />
        </Link>
      )}
    </div>
  );
}

function SoortCel({
  taak,
  onOpslaan,
  disabled,
}: {
  taak: Taak;
  onOpslaan: (velden: TaakVelden, optimistisch: Partial<Taak>) => void;
  disabled?: boolean;
}) {
  const afspraak = taak.soort === 'afspraak';
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={afspraak ? 'text-sky-700' : 'text-ink-400'}>
        {afspraak ? <IcoonAfspraak /> : <IcoonTaak />}
      </span>
      <select
        value={taak.soort}
        aria-label="Taak of afspraak"
        disabled={disabled}
        onChange={(e) => {
          const soort = e.target.value === 'afspraak' ? 'afspraak' : 'taak';
          onOpslaan({ soort }, { soort, tijd: soort === 'taak' ? null : taak.tijd });
        }}
        className="rounded-md border border-transparent bg-transparent px-1 py-1 text-[14px] text-ink-800 hover:border-line focus:border-amber-400 focus:outline-none"
      >
        <option value="taak">Taak</option>
        <option value="afspraak">Afspraak</option>
      </select>
      {afspraak && (
        <input
          type="time"
          value={taak.tijd ?? ''}
          aria-label="Tijd van de afspraak"
          disabled={disabled}
          onChange={(e) => onOpslaan({ tijd: e.target.value || null }, { tijd: e.target.value || null })}
          className="rounded-md border border-line bg-white px-1.5 py-1 text-[14px] tabular-nums text-ink-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
        />
      )}
    </div>
  );
}

function DatumCel({
  taak,
  vandaag,
  onOpslaan,
  disabled,
}: {
  taak: Taak;
  vandaag: string;
  onOpslaan: (velden: TaakVelden, optimistisch: Partial<Taak>) => void;
  disabled?: boolean;
}) {
  const verlopen = taak.status === 'open' && !!taak.vervaldatum && taak.vervaldatum < vandaag;
  const isVandaag = taak.vervaldatum === vandaag;
  return (
    <div>
      <input
        type="date"
        value={taak.vervaldatum ?? ''}
        aria-label="Datum gepland"
        disabled={disabled}
        onChange={(e) => onOpslaan({ vervaldatum: e.target.value || null }, { vervaldatum: e.target.value || null })}
        className={`${celInvoer} w-auto tabular-nums ${verlopen ? 'font-semibold text-red-700' : ''}`}
      />
      {(verlopen || isVandaag) && (
        <span className={`ml-2 text-[12px] font-semibold ${verlopen ? 'text-red-700' : 'text-amber-700'}`}>
          {verlopen ? 'Verlopen' : 'Vandaag'}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hoofdcomponent                                                      */
/* ------------------------------------------------------------------ */

type Nieuw = {
  titel: string;
  omschrijving: string;
  vervaldatum: string;
  werkstatus: string;
  toegewezen_aan: string;
  soort: 'taak' | 'afspraak';
  tijd: string;
};

const LEEG_NIEUW: Nieuw = {
  titel: '',
  omschrijving: '',
  vervaldatum: '',
  werkstatus: 'Niet gestart',
  toegewezen_aan: '',
  soort: 'taak',
  tijd: '',
};

export default function TakenTabel({
  taken,
  organisaties,
  personen,
  werkstatussen,
  inclusiefAfgerond,
  vandaag,
  begin,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [rijen, setRijen] = useState<Taak[]>(taken);
  const [filters, setFilters] = useState<TakenFilters>(begin);
  const [melding, setMelding] = useState<{ tekst: string; soort: 'ok' | 'fout' } | null>(null);
  const [nieuw, setNieuw] = useState<Nieuw>(LEEG_NIEUW);
  const nieuwKlantRef = useRef<HTMLInputElement>(null);
  const nieuwMobielRef = useRef<HTMLInputElement>(null);

  // Lopende acties per taak: zolang er iets onderweg is, wint de lokale versie.
  const bezig = useRef(new Map<string, number>());
  // Net afgevinkte taken blijven zichtbaar tot de volgende keer laden (handig om terug te draaien).
  const netAfgevinkt = useRef(new Set<string>());
  const verwijderd = useRef(new Set<string>());

  // Nieuwe serverdata samenvoegen met wat lokaal nog onderweg is.
  useEffect(() => {
    setRijen((huidig) => {
      const lokaal = new Map(huidig.map((r) => [r.id, r]));
      const uit: Taak[] = [];
      const gezien = new Set<string>();
      for (const t of taken) {
        if (verwijderd.current.has(t.id)) continue;
        gezien.add(t.id);
        uit.push(bezig.current.get(t.id) ? (lokaal.get(t.id) ?? t) : t);
      }
      for (const r of huidig) {
        if (gezien.has(r.id) || verwijderd.current.has(r.id)) continue;
        if (r.id.startsWith('tmp-') || bezig.current.get(r.id) || netAfgevinkt.current.has(r.id)) uit.push(r);
      }
      return uit;
    });
  }, [taken]);

  // Melding na een paar seconden weg.
  useEffect(() => {
    if (!melding) return;
    const t = setTimeout(() => setMelding(null), melding.soort === 'fout' ? 6000 : 2500);
    return () => clearTimeout(t);
  }, [melding]);

  const telBezig = (id: string, d: 1 | -1) => {
    const n = (bezig.current.get(id) ?? 0) + d;
    if (n <= 0) bezig.current.delete(id);
    else bezig.current.set(id, n);
  };

  /** Eén wijziging: meteen in beeld, daarna opslaan; bij een fout terugzetten. */
  const bewaar = useCallback(
    async (taak: Taak, velden: TaakVelden, optimistisch: Partial<Taak>) => {
      const id = taak.id;
      if (id.startsWith('tmp-')) return;
      const vorige = taak;
      if (optimistisch.werkstatus !== undefined) {
        const klaar = optimistisch.werkstatus === 'Afgerond';
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
        if (opgeslagen && !bezig.current.get(id)) {
          setRijen((rs) => rs.map((r) => (r.id === id ? opgeslagen : r)));
        }
      } else {
        setRijen((rs) => rs.map((r) => (r.id === id ? vorige : r)));
        setMelding({ tekst: res.fout, soort: 'fout' });
      }
    },
    [],
  );

  const verwijder = async (taak: Taak) => {
    const auto = taak.bron !== 'handmatig';
    const vraag = auto
      ? 'Deze taak komt uit een order of portaalbestelling en komt anders vanzelf terug. Wil je hem afronden?'
      : `"${taak.titel}" verwijderen? Dit kan niet ongedaan worden gemaakt.`;
    if (!window.confirm(vraag)) return;
    if (auto) {
      await bewaar(taak, { werkstatus: 'Afgerond' }, { werkstatus: 'Afgerond' });
      return;
    }
    verwijderd.current.add(taak.id);
    setRijen((rs) => rs.filter((r) => r.id !== taak.id));
    let res: TaakResultaat;
    try {
      res = await verwijderTaakInlineActie(taak.id);
    } catch {
      res = { ok: false, fout: 'Geen verbinding. De taak is niet verwijderd.' };
    }
    if (!res.ok) {
      verwijderd.current.delete(taak.id);
      setRijen((rs) => [...rs, taak]);
      setMelding({ tekst: res.fout, soort: 'fout' });
    } else {
      setMelding({ tekst: 'Taak verwijderd.', soort: 'ok' });
    }
  };

  /** Snel toevoegen via de lege rij onderaan. */
  const voegToe = async () => {
    const titel = nieuw.titel.trim();
    if (!titel) {
      setMelding({ tekst: 'Vul eerst een klant of onderwerp in.', soort: 'fout' });
      nieuwKlantRef.current?.focus();
      return;
    }
    const invoer = nieuw;
    const org = zoekOrg(organisaties, titel);
    const tmpId = `tmp-${Date.now()}`;
    const tijdelijk: Taak = {
      id: tmpId,
      titel: org?.naam ?? titel,
      omschrijving: invoer.omschrijving.trim() || null,
      organisatie_id: org?.id ?? null,
      organisatie_naam: org?.naam ?? null,
      status: invoer.werkstatus === 'Afgerond' ? 'klaar' : 'open',
      werkstatus: invoer.werkstatus,
      prioriteit: 'normaal',
      vervaldatum: invoer.vervaldatum || null,
      toegewezen_aan: invoer.toegewezen_aan.trim() || null,
      created_at: new Date().toISOString(),
      afgerond_op: null,
      soort: invoer.soort,
      bron: 'handmatig',
      order_id: null,
      portaal_bestelling_id: null,
      prospect_id: null,
      tijd: invoer.soort === 'afspraak' ? invoer.tijd || null : null,
      ordernummer: null,
    };
    setRijen((rs) => [...rs, tijdelijk]);
    setNieuw({ ...LEEG_NIEUW, soort: invoer.soort, vervaldatum: invoer.vervaldatum, toegewezen_aan: invoer.toegewezen_aan });

    let res: TaakResultaat;
    try {
      res = await maakSnelleTaakActie({
        titel: tijdelijk.titel,
        organisatie_id: tijdelijk.organisatie_id,
        omschrijving: tijdelijk.omschrijving,
        vervaldatum: tijdelijk.vervaldatum,
        toegewezen_aan: tijdelijk.toegewezen_aan,
        soort: tijdelijk.soort,
        tijd: tijdelijk.tijd,
        werkstatus: tijdelijk.werkstatus,
      });
    } catch {
      res = { ok: false, fout: 'Geen verbinding. De taak is niet toegevoegd.' };
    }
    if (res.ok && res.taak) {
      const echt = res.taak;
      if (echt.status === 'klaar') netAfgevinkt.current.add(echt.id);
      setRijen((rs) => {
        const zonderTmp = rs.filter((r) => r.id !== tmpId && r.id !== echt.id);
        return [...zonderTmp, echt];
      });
      setMelding({ tekst: tijdelijk.soort === 'afspraak' ? 'Afspraak toegevoegd.' : 'Taak toegevoegd.', soort: 'ok' });
    } else {
      setRijen((rs) => rs.filter((r) => r.id !== tmpId));
      setNieuw(invoer);
      setMelding({ tekst: res.ok ? 'Toevoegen is niet gelukt.' : res.fout, soort: 'fout' });
    }
  };

  const enterVoegtToe = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !(e.nativeEvent as unknown as { isComposing?: boolean }).isComposing) {
      e.preventDefault();
      void voegToe();
    }
  };

  /* ---------- Filters en sorteren ---------- */

  const zetFilter = (patch: Partial<TakenFilters>) => {
    const volgende = { ...filters, ...patch };
    setFilters(volgende);
    const params = new URLSearchParams();
    if (volgende.status) params.set('status', volgende.status);
    if (volgende.persoon) params.set('persoon', volgende.persoon);
    if (volgende.soort) params.set('soort', volgende.soort);
    if (volgende.bron) params.set('bron', volgende.bron);
    if (volgende.q) params.set('q', volgende.q);
    if (volgende.sort !== 'datum') params.set('sort', volgende.sort);
    if (volgende.dir !== 'asc') params.set('dir', volgende.dir);
    const url = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    const heeftAfgerondNodig = volgende.status === '__alles' || volgende.status === 'Afgerond';
    if (heeftAfgerondNodig && !inclusiefAfgerond) {
      // Afgeronde taken zijn nog niet geladen: de server haalt ze op.
      router.replace(url, { scroll: false });
    } else {
      window.history.replaceState(null, '', url);
    }
  };

  const sorteer = (kolom: SortKolom) => {
    if (filters.sort === kolom) zetFilter({ dir: filters.dir === 'asc' ? 'desc' : 'asc' });
    else zetFilter({ sort: kolom, dir: 'asc' });
  };

  const zichtbaar = useMemo(() => {
    const q = normaal(filters.q);
    const lijst = rijen.filter((t) => {
      if (filters.status === '') {
        if (t.status === 'klaar' && !netAfgevinkt.current.has(t.id)) return false;
      } else if (filters.status !== '__alles') {
        if ((t.werkstatus || 'Niet gestart') !== filters.status && !netAfgevinkt.current.has(t.id)) return false;
      }
      if (filters.persoon === '__niemand' && t.toegewezen_aan) return false;
      if (filters.persoon && filters.persoon !== '__niemand' && normaal(t.toegewezen_aan) !== normaal(filters.persoon))
        return false;
      if (filters.soort && t.soort !== filters.soort) return false;
      if (filters.bron && t.bron !== filters.bron) return false;
      if (q) {
        const hooiberg = [t.titel, t.omschrijving, t.organisatie_naam, t.toegewezen_aan, t.ordernummer ? `#${t.ordernummer} ${t.ordernummer}` : '']
          .map(normaal)
          .join(' ');
        if (!hooiberg.includes(q)) return false;
      }
      return true;
    });

    const factor = filters.dir === 'asc' ? 1 : -1;
    const tekst = (a: string, b: string) => a.localeCompare(b, 'nl', { sensitivity: 'base' });
    const opDatum = (a: Taak, b: Taak) => {
      // Lege datum altijd onderaan, welke richting ook.
      if (a.vervaldatum !== b.vervaldatum) {
        if (!a.vervaldatum) return 1;
        if (!b.vervaldatum) return -1;
        return (a.vervaldatum < b.vervaldatum ? -1 : 1) * factor;
      }
      if (a.tijd !== b.tijd) {
        if (!a.tijd) return 1;
        if (!b.tijd) return -1;
        return (a.tijd < b.tijd ? -1 : 1) * factor;
      }
      return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
    };
    const statusIndex = (t: Taak) => werkstatussen.indexOf(t.werkstatus || 'Niet gestart');
    lijst.sort((a, b) => {
      let v = 0;
      if (filters.sort === 'klant') v = tekst(a.titel, b.titel) * factor;
      else if (filters.sort === 'status') v = (statusIndex(a) - statusIndex(b)) * factor;
      else if (filters.sort === 'persoon') {
        if (!a.toegewezen_aan !== !b.toegewezen_aan) return a.toegewezen_aan ? -1 : 1;
        v = tekst(a.toegewezen_aan ?? '', b.toegewezen_aan ?? '') * factor;
      } else if (filters.sort === 'bron') v = tekst(a.bron, b.bron) * factor;
      return v !== 0 ? v : opDatum(a, b);
    });
    // Nieuwe (nog niet opgeslagen) rijen onderaan, waar je ze net intypte.
    return [...lijst.filter((t) => !t.id.startsWith('tmp-')), ...lijst.filter((t) => t.id.startsWith('tmp-'))];
  }, [rijen, filters, werkstatussen]);

  const openRijen = rijen.filter((t) => t.status === 'open');
  const aantalVerlopen = openRijen.filter((t) => t.vervaldatum && t.vervaldatum < vandaag).length;
  const aantalVandaag = openRijen.filter((t) => t.vervaldatum === vandaag).length;
  const filtersAan =
    filters.status !== '' || filters.persoon !== '' || filters.soort !== '' || filters.bron !== '' || filters.q !== '';

  const kop = (label: string, kolom: SortKolom | null, className = '') => {
    if (!kolom) return <th className={className}>{label}</th>;
    const actief = filters.sort === kolom;
    return (
      <th className={className} aria-sort={actief ? (filters.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button
          type="button"
          onClick={() => sorteer(kolom)}
          className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide hover:text-ink-900"
        >
          {label}
          <span aria-hidden="true" className={`text-[10px] ${actief ? 'text-amber-600' : 'text-ink-300'}`}>
            {actief ? (filters.dir === 'asc' ? '▲' : '▼') : '↕'}
          </span>
        </button>
      </th>
    );
  };

  const afvinken = (t: Taak, klaar: boolean) =>
    bewaar(t, { werkstatus: klaar ? 'Afgerond' : 'Niet gestart' }, { werkstatus: klaar ? 'Afgerond' : 'Niet gestart' });

  const nieuweAfspraak = () => {
    setNieuw((n) => ({ ...n, soort: 'afspraak' }));
    const mobiel = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
    const el = mobiel ? nieuwMobielRef.current : nieuwKlantRef.current;
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => el?.focus(), 250);
  };
  const nieuweTaak = () => {
    setNieuw((n) => ({ ...n, soort: 'taak' }));
    const mobiel = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
    const el = mobiel ? nieuwMobielRef.current : nieuwKlantRef.current;
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => el?.focus(), 250);
  };

  /* ---------- Weergave ---------- */

  const filterSelect = 'veld w-auto min-w-[9rem] py-2 text-[14px]';

  const leegTekst: ReactNode = filtersAan
    ? 'Geen taken die bij deze filters passen.'
    : 'Niets te doen. Nieuwe orders en portaalbestellingen verschijnen hier vanzelf.';

  return (
    <div>
      {/* Lijsten voor suggesties */}
      <datalist id="taken-klanten">
        {organisaties.map((o) => (
          <option key={o.id} value={o.naam} />
        ))}
      </datalist>
      <datalist id="taken-personen">
        {personen.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      {/* Samenvatting + knoppen */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-warm">
          <span className="font-semibold text-ink-900">{openRijen.length}</span> open
          {aantalVandaag > 0 && (
            <>
              {' · '}
              <span className="font-semibold text-amber-700">{aantalVandaag} vandaag</span>
            </>
          )}
          {aantalVerlopen > 0 && (
            <>
              {' · '}
              <span className="font-semibold text-red-700">{aantalVerlopen} verlopen</span>
            </>
          )}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={nieuweTaak} className="knop-stil py-2 text-[14px]">
            <IcoonTaak /> Nieuwe taak
          </button>
          <button type="button" onClick={nieuweAfspraak} className="knop-primair py-2 text-[14px]">
            <IcoonAfspraak /> Nieuwe afspraak
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-mist p-3">
        <label className="flex min-w-[12rem] flex-1 flex-col">
          <span className="veld-label">Zoeken</span>
          <input
            type="search"
            value={filters.q}
            onChange={(e) => zetFilter({ q: e.target.value })}
            placeholder="Klant, bestelling, ordernummer…"
            className="veld py-2 text-[14px]"
          />
        </label>
        <label className="flex flex-col">
          <span className="veld-label">Status</span>
          <select value={filters.status} onChange={(e) => zetFilter({ status: e.target.value })} className={filterSelect}>
            <option value="">Alles behalve Afgerond</option>
            <option value="__alles">Alles, ook afgerond</option>
            <optgroup label="Alleen deze status">
              {werkstatussen.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <label className="flex flex-col">
          <span className="veld-label">Persoon</span>
          <select value={filters.persoon} onChange={(e) => zetFilter({ persoon: e.target.value })} className={filterSelect}>
            <option value="">Iedereen</option>
            <option value="__niemand">Nog niemand</option>
            {personen.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col">
          <span className="veld-label">Soort</span>
          <select value={filters.soort} onChange={(e) => zetFilter({ soort: e.target.value })} className={filterSelect}>
            <option value="">Taken en afspraken</option>
            <option value="taak">Alleen taken</option>
            <option value="afspraak">Alleen afspraken</option>
          </select>
        </label>
        <label className="flex flex-col">
          <span className="veld-label">Herkomst</span>
          <select value={filters.bron} onChange={(e) => zetFilter({ bron: e.target.value })} className={filterSelect}>
            <option value="">Alles</option>
            <option value="handmatig">Zelf gemaakt</option>
            <option value="order">Uit orders</option>
            <option value="portaal">Uit het klantportaal</option>
            <option value="prospect">Uit prospect-brieven</option>
          </select>
        </label>
        {filtersAan && (
          <button
            type="button"
            onClick={() => zetFilter({ status: '', persoon: '', soort: '', bron: '', q: '' })}
            className="knop-tekst py-2 text-[14px]"
          >
            Filters wissen
          </button>
        )}
      </div>

      {/* Tabel (computer en tablet) */}
      <div className="mt-4 hidden overflow-x-auto rounded-lg border border-line bg-white md:block">
        <table className="tbl min-w-[1100px] text-[14px]">
          <thead>
            <tr>
              <th className="w-10" aria-label="Afgerond">
                <span aria-hidden="true">✓</span>
              </th>
              {kop('Klant', 'klant', 'w-[16rem]')}
              {kop('Bestelling', null, 'min-w-[18rem]')}
              {kop('Datum gepland', 'datum', 'w-[11rem]')}
              {kop('Status', 'status', 'w-[13rem]')}
              {kop('Persoon', 'persoon', 'w-[9rem]')}
              <th className="w-[11rem]">Soort</th>
              {kop('Herkomst', 'bron', 'w-[10rem]')}
              <th className="w-10" aria-label="Acties" />
            </tr>
          </thead>
          <tbody>
            {zichtbaar.length === 0 && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-warm">
                  {leegTekst}
                </td>
              </tr>
            )}
            {zichtbaar.map((t) => {
              const tmp = t.id.startsWith('tmp-');
              const klaar = t.status === 'klaar';
              return (
                <tr key={t.id} className={`${klaar ? 'opacity-60' : ''} ${tmp ? 'animate-pulse' : ''}`}>
                  <td className="!align-top !pt-3">
                    <input
                      type="checkbox"
                      checked={klaar}
                      disabled={tmp}
                      onChange={(e) => afvinken(t, e.target.checked)}
                      aria-label={klaar ? `${t.titel} weer openzetten` : `${t.titel} afronden`}
                      className="h-5 w-5 cursor-pointer rounded border-ink-300 accent-green-600"
                    />
                  </td>
                  <td className="!align-top">
                    <KlantCel
                      taak={t}
                      organisaties={organisaties}
                      disabled={tmp}
                      onOpslaan={(v, o) => bewaar(t, v, o)}
                    />
                  </td>
                  <td className="!align-top">
                    <MeerregeligCel
                      waarde={t.omschrijving}
                      label="Bestelling of omschrijving"
                      placeholder="Wat moet er gebeuren?"
                      disabled={tmp}
                      onOpslaan={(v) => bewaar(t, { omschrijving: v }, { omschrijving: v.trim() || null })}
                    />
                  </td>
                  <td className="!align-top">
                    <DatumCel taak={t} vandaag={vandaag} disabled={tmp} onOpslaan={(v, o) => bewaar(t, v, o)} />
                  </td>
                  <td className="!align-top !pt-2.5">
                    <StatusPill
                      waarde={t.werkstatus}
                      opties={werkstatussen}
                      disabled={tmp}
                      onKies={(w) => bewaar(t, { werkstatus: w }, { werkstatus: w })}
                    />
                  </td>
                  <td className="!align-top">
                    <TekstCel
                      waarde={t.toegewezen_aan}
                      label="Persoon"
                      list="taken-personen"
                      placeholder="Niemand"
                      disabled={tmp}
                      onOpslaan={(v) => bewaar(t, { toegewezen_aan: v || null }, { toegewezen_aan: v || null })}
                    />
                  </td>
                  <td className="!align-top">
                    <SoortCel taak={t} disabled={tmp} onOpslaan={(v, o) => bewaar(t, v, o)} />
                  </td>
                  <td className="!align-top !pt-3">
                    <BronBadge taak={t} />
                  </td>
                  <td className="!align-top !pt-2">
                    {!tmp && (
                      <button
                        type="button"
                        onClick={() => verwijder(t)}
                        title={t.bron === 'handmatig' ? 'Verwijderen' : 'Afronden'}
                        aria-label={t.bron === 'handmatig' ? `${t.titel} verwijderen` : `${t.titel} afronden`}
                        className="rounded-md p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-700"
                      >
                        <IcoonPrullenbak />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}

            {/* Nieuwe rij */}
            <tr className="bg-amber-50/40 hover:!bg-amber-50/40">
              <td className="!align-top !pt-3 text-center text-[18px] font-bold text-amber-700" aria-hidden="true">
                +
              </td>
              <td className="!align-top">
                <input
                  ref={nieuwKlantRef}
                  type="text"
                  value={nieuw.titel}
                  list="taken-klanten"
                  aria-label="Nieuwe taak: klant of onderwerp"
                  placeholder={nieuw.soort === 'afspraak' ? 'Nieuwe afspraak: klant…' : 'Nieuwe taak: klant…'}
                  onChange={(e) => setNieuw({ ...nieuw, titel: e.target.value })}
                  onKeyDown={enterVoegtToe}
                  className="veld py-2 text-[14px]"
                />
              </td>
              <td className="!align-top">
                <textarea
                  rows={1}
                  value={nieuw.omschrijving}
                  aria-label="Nieuwe taak: bestelling of omschrijving"
                  placeholder="Wat moet er gebeuren? (Enter = toevoegen, Shift+Enter = nieuwe regel)"
                  onChange={(e) => setNieuw({ ...nieuw, omschrijving: e.target.value })}
                  onKeyDown={enterVoegtToe}
                  className="veld min-h-[38px] resize-y py-2 text-[14px]"
                />
              </td>
              <td className="!align-top">
                <input
                  type="date"
                  value={nieuw.vervaldatum}
                  aria-label="Nieuwe taak: datum gepland"
                  onChange={(e) => setNieuw({ ...nieuw, vervaldatum: e.target.value })}
                  onKeyDown={enterVoegtToe}
                  className="veld py-2 text-[14px]"
                />
              </td>
              <td className="!align-top !pt-2.5">
                <StatusPill
                  waarde={nieuw.werkstatus}
                  opties={werkstatussen}
                  label="Nieuwe taak: status"
                  onKies={(w) => setNieuw({ ...nieuw, werkstatus: w })}
                />
              </td>
              <td className="!align-top">
                <input
                  type="text"
                  value={nieuw.toegewezen_aan}
                  list="taken-personen"
                  aria-label="Nieuwe taak: persoon"
                  placeholder="Persoon"
                  onChange={(e) => setNieuw({ ...nieuw, toegewezen_aan: e.target.value })}
                  onKeyDown={enterVoegtToe}
                  className="veld py-2 text-[14px]"
                />
              </td>
              <td className="!align-top">
                <div className="flex flex-wrap items-center gap-1.5">
                  <select
                    value={nieuw.soort}
                    aria-label="Nieuwe taak: taak of afspraak"
                    onChange={(e) => setNieuw({ ...nieuw, soort: e.target.value === 'afspraak' ? 'afspraak' : 'taak' })}
                    className="veld w-auto py-2 text-[14px]"
                  >
                    <option value="taak">Taak</option>
                    <option value="afspraak">Afspraak</option>
                  </select>
                  {nieuw.soort === 'afspraak' && (
                    <input
                      type="time"
                      value={nieuw.tijd}
                      aria-label="Nieuwe afspraak: tijd"
                      onChange={(e) => setNieuw({ ...nieuw, tijd: e.target.value })}
                      onKeyDown={enterVoegtToe}
                      className="veld w-auto py-2 text-[14px]"
                    />
                  )}
                </div>
              </td>
              <td className="!align-top" colSpan={2}>
                <button type="button" onClick={() => void voegToe()} className="knop-donker w-full py-2 text-[14px]">
                  Toevoegen
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Kaarten (telefoon) */}
      <div className="mt-4 space-y-3 md:hidden">
        {zichtbaar.length === 0 && (
          <p className="rounded-lg border border-dashed border-line bg-mist px-4 py-6 text-center text-[14px] text-warm">
            {leegTekst}
          </p>
        )}
        {zichtbaar.map((t) => {
          const tmp = t.id.startsWith('tmp-');
          const klaar = t.status === 'klaar';
          return (
            <div
              key={t.id}
              className={`rounded-lg border border-line bg-white p-3 ${klaar ? 'opacity-60' : ''} ${tmp ? 'animate-pulse' : ''}`}
            >
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={klaar}
                  disabled={tmp}
                  onChange={(e) => afvinken(t, e.target.checked)}
                  aria-label={klaar ? `${t.titel} weer openzetten` : `${t.titel} afronden`}
                  className="mt-2.5 h-6 w-6 shrink-0 cursor-pointer accent-green-600"
                />
                <div className="min-w-0 flex-1">
                  <KlantCel taak={t} organisaties={organisaties} disabled={tmp} onOpslaan={(v, o) => bewaar(t, v, o)} />
                </div>
                <div className="pt-1.5">
                  <BronBadge taak={t} />
                </div>
              </div>
              <div className="mt-1">
                <MeerregeligCel
                  waarde={t.omschrijving}
                  label="Bestelling of omschrijving"
                  placeholder="Wat moet er gebeuren?"
                  disabled={tmp}
                  onOpslaan={(v) => bewaar(t, { omschrijving: v }, { omschrijving: v.trim() || null })}
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusPill
                  waarde={t.werkstatus}
                  opties={werkstatussen}
                  disabled={tmp}
                  onKies={(w) => bewaar(t, { werkstatus: w }, { werkstatus: w })}
                />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <span className="veld-label">Datum gepland</span>
                  <DatumCel taak={t} vandaag={vandaag} disabled={tmp} onOpslaan={(v, o) => bewaar(t, v, o)} />
                  {t.vervaldatum && <span className="ml-2 text-[12px] text-warm">{datumKort(t.vervaldatum)}</span>}
                </div>
                <div>
                  <span className="veld-label">Persoon</span>
                  <TekstCel
                    waarde={t.toegewezen_aan}
                    label="Persoon"
                    list="taken-personen"
                    placeholder="Niemand"
                    disabled={tmp}
                    onOpslaan={(v) => bewaar(t, { toegewezen_aan: v || null }, { toegewezen_aan: v || null })}
                  />
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <SoortCel taak={t} disabled={tmp} onOpslaan={(v, o) => bewaar(t, v, o)} />
                {!tmp && (
                  <button
                    type="button"
                    onClick={() => verwijder(t)}
                    className="rounded-md px-2 py-1.5 text-[13px] font-semibold text-red-700 hover:bg-red-50"
                  >
                    {t.bron === 'handmatig' ? 'Verwijderen' : 'Afronden'}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Nieuwe taak (telefoon) */}
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
          <p className="font-display text-[15px] font-bold text-ink-900">
            {nieuw.soort === 'afspraak' ? 'Nieuwe afspraak' : 'Nieuwe taak'}
          </p>
          <div className="mt-2 space-y-2">
            <input
              ref={nieuwMobielRef}
              type="text"
              value={nieuw.titel}
              list="taken-klanten"
              aria-label="Klant of onderwerp"
              placeholder="Klant of onderwerp"
              onChange={(e) => setNieuw({ ...nieuw, titel: e.target.value })}
              onKeyDown={enterVoegtToe}
              className="veld py-2.5 text-[15px]"
            />
            <textarea
              rows={2}
              value={nieuw.omschrijving}
              aria-label="Bestelling of omschrijving"
              placeholder="Wat moet er gebeuren?"
              onChange={(e) => setNieuw({ ...nieuw, omschrijving: e.target.value })}
              className="veld py-2.5 text-[15px]"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={nieuw.vervaldatum}
                aria-label="Datum gepland"
                onChange={(e) => setNieuw({ ...nieuw, vervaldatum: e.target.value })}
                className="veld py-2.5 text-[15px]"
              />
              <input
                type="text"
                value={nieuw.toegewezen_aan}
                list="taken-personen"
                aria-label="Persoon"
                placeholder="Persoon"
                onChange={(e) => setNieuw({ ...nieuw, toegewezen_aan: e.target.value })}
                className="veld py-2.5 text-[15px]"
              />
              <select
                value={nieuw.soort}
                aria-label="Taak of afspraak"
                onChange={(e) => setNieuw({ ...nieuw, soort: e.target.value === 'afspraak' ? 'afspraak' : 'taak' })}
                className="veld py-2.5 text-[15px]"
              >
                <option value="taak">Taak</option>
                <option value="afspraak">Afspraak</option>
              </select>
              {nieuw.soort === 'afspraak' ? (
                <input
                  type="time"
                  value={nieuw.tijd}
                  aria-label="Tijd"
                  onChange={(e) => setNieuw({ ...nieuw, tijd: e.target.value })}
                  className="veld py-2.5 text-[15px]"
                />
              ) : (
                <span />
              )}
            </div>
            <StatusPill
              waarde={nieuw.werkstatus}
              opties={werkstatussen}
              label="Status"
              onKies={(w) => setNieuw({ ...nieuw, werkstatus: w })}
            />
            <button type="button" onClick={() => void voegToe()} className="knop-donker w-full py-2.5 text-[15px]">
              Toevoegen
            </button>
          </div>
        </div>
      </div>

      {/* Melding */}
      {melding && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 md:left-auto md:right-6 md:translate-x-0">
          <div
            role="status"
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold shadow-card ${
              melding.soort === 'fout' ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-800'
            }`}
          >
            <span>{melding.tekst}</span>
            <button type="button" onClick={() => setMelding(null)} aria-label="Sluiten" className="opacity-60 hover:opacity-100">
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
