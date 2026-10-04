'use client';

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import ZoekKeuze from './ZoekKeuze';
import {
  DATUM_PRESETS,
  MELDINGEN,
  sleutelsVan,
  type FilterContext,
  type FilterDef,
} from '@/lib/filterBalk';

/**
 * Filterbalk voor een lijstscherm. Alles staat in de URL, dus een gefilterde
 * lijst is te delen, te bookmarken en overleeft verversen. De server leest de
 * parameters met de helpers uit lib/filterBalk.ts.
 *
 * - Live: elke wijziging werkt de URL meteen bij (bedragen na een korte pauze).
 *   Geen Filter-knop. Zoekterm, status en sortering blijven staan; de
 *   paginering gaat terug naar 1.
 * - Filters met `hoofd: true` staan in de balk, de rest onder "Meer filters".
 * - Elk actief filter staat als chip onder de balk, met × om het te wissen.
 *   "Alles wissen" haalt alle filters weg (plus wat je in `wisOok` noemt).
 * - "Mijn weergaven": de huidige combinatie onder een naam bewaren, per
 *   gebruiker in localStorage. Werkt niet in een privévenster zonder opslag;
 *   dan blijft het menu leeg en gaat er verder niets mis.
 *
 * Gebruik:
 * ```tsx
 * <FilterBalk opslag="orders" gebruiker={admin?.email} wisOok={['status', 'zoek']} filters={[
 *   { soort: 'zoek', param: 'klant', label: 'Klant', hoofd: true, zoek: zoekKlantenVoorFilter, huidigLabel },
 *   { soort: 'datum', param: 'datum', label: 'Besteldatum', hoofd: true },
 *   { soort: 'bedrag', param: 'bedrag', label: 'Bedrag' },
 * ]}>
 *   <Zoekbalk placeholder="Zoek op klant of ordernummer" />
 * </FilterBalk>
 * ```
 */
export default function FilterBalk({
  filters,
  opslag,
  gebruiker,
  wisOok = [],
  children,
}: {
  filters: FilterDef[];
  /** Sleutel voor bewaarde weergaven en de uitklapstand, bijv. 'orders'. */
  opslag: string;
  /** E-mail van de ingelogde beheerder; weergaven zijn per persoon. */
  gebruiker?: string | null;
  /** Andere parameters die "Alles wissen" ook weghaalt, bijv. status en zoek. */
  wisOok?: string[];
  /** Links in de balk, meestal het zoekveld. */
  children?: ReactNode;
}) {
  const router = useRouter();
  const pad = usePathname();
  const sp = useSearchParams();
  const [bezig, startTransition] = useTransition();
  const [meerOpen, setMeerOpen] = useState(false);

  const uitklapSleutel = `fb.filters.open.${opslag}`;
  useEffect(() => {
    try {
      if (localStorage.getItem(uitklapSleutel) === '1') setMeerOpen(true);
    } catch {
      /* geen opslag beschikbaar */
    }
  }, [uitklapSleutel]);
  function wisselMeer() {
    setMeerOpen((o) => {
      try {
        localStorage.setItem(uitklapSleutel, o ? '0' : '1');
      } catch {
        /* geen opslag beschikbaar */
      }
      return !o;
    });
  }

  /** Huidige URL-parameters als Record, voor de context van zoekacties. */
  const context: FilterContext = useMemo(() => Object.fromEntries(sp.entries()), [sp]);

  /** Werkt de URL bij. Altijd vanaf de actuele URL: een ander veld kan net iets veranderd hebben. */
  function zet(wijzig: Record<string, string | null>) {
    const p = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(wijzig)) {
      if (v === null || v === '') p.delete(k);
      else p.set(k, v);
    }
    p.delete('pagina');
    for (const m of MELDINGEN) p.delete(m);
    const qs = p.toString();
    startTransition(() => router.replace(qs ? `${pad}?${qs}` : pad, { scroll: false }));
  }

  const actief = (def: FilterDef) => sleutelsVan(def).some((k) => sp.get(k));
  const hoofd = filters.filter((f) => f.hoofd && !(f.soort === 'multi' && f.weergave === 'chips'));
  const chipRijen = filters.filter((f) => f.soort === 'multi' && f.weergave === 'chips');
  const overig = filters.filter((f) => !f.hoofd && !(f.soort === 'multi' && f.weergave === 'chips'));
  const aantalOverigActief = overig.filter(actief).length;

  const chips = actieveChips(filters, sp);
  const extraActief = wisOok.some((k) => sp.get(k));
  const ietsActief = chips.length > 0 || extraActief || chipRijen.some(actief);

  function wisAlles() {
    const wijzig: Record<string, null> = {};
    for (const f of filters) for (const k of sleutelsVan(f)) wijzig[k] = null;
    for (const k of wisOok) wijzig[k] = null;
    zet(wijzig);
  }

  return (
    <>
      <div className="dash-filter flex-wrap gap-2">
        {children}
        {hoofd.map((f) => (
          <FilterVeld key={f.param} def={f} sp={sp} zet={zet} context={context} compact />
        ))}
        {overig.length > 0 && (
          <button
            type="button"
            onClick={wisselMeer}
            aria-expanded={meerOpen}
            className={`knop-stil ${aantalOverigActief ? 'border-ink-300' : ''}`}
          >
            {meerOpen ? 'Minder filters' : 'Meer filters'}
            {aantalOverigActief > 0 && <span className="chip-tel">{aantalOverigActief}</span>}
          </button>
        )}
        <Weergaven opslag={opslag} gebruiker={gebruiker} sp={sp} pad={pad} kanBewaren={ietsActief || Boolean(sp.get('sort'))} />
        {bezig && (
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-300 border-t-transparent" aria-hidden="true" />
        )}
        <span className="sr-only" role="status" aria-live="polite">
          {bezig ? 'Lijst wordt bijgewerkt' : ''}
        </span>
      </div>

      {chipRijen.map((f) => (
        <FilterVeld key={f.param} def={f} sp={sp} zet={zet} context={context} />
      ))}

      {meerOpen && overig.length > 0 && (
        <div className="panel mt-3 grid gap-x-4 gap-y-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
          {overig.map((f) => (
            <FilterVeld key={f.param} def={f} sp={sp} zet={zet} context={context} />
          ))}
        </div>
      )}

      {ietsActief && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Actieve filters">
          {chips.map((c) => (
            <button
              key={c.sleutel}
              type="button"
              onClick={() => zet(c.wis)}
              className="chip chip-aan"
              title="Filter wissen"
            >
              {c.label}
              <span aria-hidden="true">×</span>
              <span className="sr-only">wissen</span>
            </button>
          ))}
          <button type="button" onClick={wisAlles} className="knop-tekst">
            Alles wissen
          </button>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Losse filtervelden                                                  */
/* ------------------------------------------------------------------ */

type SP = ReturnType<typeof useSearchParams>;
type Zet = (wijzig: Record<string, string | null>) => void;

/** Label naast (in de balk) of boven (onder "Meer filters") het veld. Bewust buiten FilterVeld: anders remount elk veld bij elke render. */
function Omhulsel({ label, compact, children }: { label: string; compact: boolean; children: ReactNode }) {
  return compact ? (
    <div className="flex items-center gap-1.5 text-[13px] text-warm">
      <span className="whitespace-nowrap">{label}</span>
      {children}
    </div>
  ) : (
    <div>
      <span className="veld-label">{label}</span>
      {children}
    </div>
  );
}

function FilterVeld({ def, sp, zet, context, compact = false }: { def: FilterDef; sp: SP; zet: Zet; context: FilterContext; compact?: boolean }) {
  switch (def.soort) {
    case 'select': {
      const w = sp.get(def.param) ?? '';
      return (
        <Omhulsel label={def.label} compact={compact}>
          <select
            value={w}
            onChange={(e) => zet({ [def.param]: e.target.value || null })}
            className={`veld ${compact ? 'w-auto min-w-[9rem]' : ''}`}
            aria-label={def.label}
          >
            <option value="">{def.leegLabel ?? 'Alle'}</option>
            {w && !def.opties.some((o) => o.waarde === w) && <option value={w}>{w}</option>}
            {def.opties.map((o) => (
              <option key={o.waarde} value={o.waarde}>
                {o.label}
                {o.aantal != null ? ` (${o.aantal})` : ''}
              </option>
            ))}
          </select>
        </Omhulsel>
      );
    }
    case 'multi': {
      const gekozen = (sp.get(def.param) ?? '').split(',').filter(Boolean);
      const wissel = (waarde: string) => {
        const nieuw = gekozen.includes(waarde) ? gekozen.filter((g) => g !== waarde) : [...gekozen, waarde];
        zet({ [def.param]: nieuw.join(',') || null });
      };
      if (def.weergave === 'chips') {
        return (
          <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label={def.label}>
            {def.opties.map((o) => {
              const aan = gekozen.includes(o.waarde);
              return (
                <button key={o.waarde} type="button" onClick={() => wissel(o.waarde)} aria-pressed={aan} className={`chip ${aan ? 'chip-aan' : ''}`}>
                  {o.label}
                  {o.aantal != null && <span className="chip-tel">{o.aantal}</span>}
                </button>
              );
            })}
          </div>
        );
      }
      return (
        <Omhulsel label={def.label} compact={compact}>
          <MultiLijst def={def} gekozen={gekozen} wissel={wissel} />
        </Omhulsel>
      );
    }
    case 'datum':
      return (
        <Omhulsel label={def.label} compact={compact}>
          <DatumVeld stam={def.param} sp={sp} zet={zet} compact={compact} />
        </Omhulsel>
      );
    case 'bedrag':
      return (
        <Omhulsel label={def.label} compact={compact}>
          <BedragVeld stam={def.param} sp={sp} zet={zet} />
        </Omhulsel>
      );
    case 'aanuit': {
      const aan = sp.get(def.param) === '1';
      return (
        <label className={`flex cursor-pointer items-center gap-2 text-[13px] text-ink-800 ${compact ? '' : 'self-end pb-1.5'}`}>
          <input
            type="checkbox"
            checked={aan}
            onChange={(e) => zet({ [def.param]: e.target.checked ? '1' : null })}
            className="h-3.5 w-3.5 rounded border-line text-amber-600 focus:ring-amber-200"
          />
          {def.label}
        </label>
      );
    }
    case 'zoek': {
      const w = sp.get(def.param) ?? '';
      return (
        <Omhulsel label={def.label} compact={compact}>
          <ZoekKeuze
            zoek={def.zoek}
            context={context}
            waarde={w}
            waardeLabel={def.huidigLabel}
            placeholder={def.placeholder ?? 'Typ om te zoeken'}
            hint={def.hint}
            breedte={compact ? 'w-56' : 'w-full'}
            wisLabel={`${def.label} wissen`}
            ariaLabel={def.label}
            onKies={(o) => zet({ [def.param]: o?.waarde ?? null })}
          />
        </Omhulsel>
      );
    }
  }
}

/** Uitklaplijst met vinkjes, voor een multi-select met veel opties. */
function MultiLijst({ def, gekozen, wissel }: { def: Extract<FilterDef, { soort: 'multi' }>; gekozen: string[]; wissel: (w: string) => void }) {
  const [open, setOpen] = useState(false);
  const [zoek, setZoek] = useState('');
  const ref = useBuitenKlik<HTMLDivElement>(open, () => setOpen(false));
  const zichtbaar = def.opties.filter((o) => !zoek.trim() || o.label.toLowerCase().includes(zoek.trim().toLowerCase()));
  const samenvatting =
    gekozen.length === 0
      ? 'Alle'
      : gekozen.length === 1
        ? def.opties.find((o) => o.waarde === gekozen[0])?.label ?? gekozen[0]
        : `${gekozen.length} gekozen`;
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="veld flex min-w-[9rem] items-center justify-between gap-2 text-left">
        <span className="truncate">{samenvatting}</span>
        <span aria-hidden="true" className="text-[10px] text-warm">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 z-40 mt-1 w-64 rounded-md border border-line bg-white p-1.5 shadow-lg">
          {def.opties.length > 8 && (
            <input value={zoek} onChange={(e) => setZoek(e.target.value)} placeholder="Zoek in de lijst" className="veld mb-1" autoFocus />
          )}
          <ul className="max-h-64 overflow-y-auto text-[13px]">
            {zichtbaar.map((o) => (
              <li key={o.waarde}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-mist">
                  <input
                    type="checkbox"
                    checked={gekozen.includes(o.waarde)}
                    onChange={() => wissel(o.waarde)}
                    className="h-3.5 w-3.5 rounded border-line text-amber-600 focus:ring-amber-200"
                  />
                  <span className="flex-1 truncate text-ink-800">{o.label}</span>
                  {o.aantal != null && <span className="chip-tel">{o.aantal}</span>}
                </label>
              </li>
            ))}
            {zichtbaar.length === 0 && <li className="px-1.5 py-1 text-[12px] text-warm">Niets gevonden.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Periode: een preset, of zelf twee datums kiezen. */
function DatumVeld({ stam, sp, zet, compact }: { stam: string; sp: SP; zet: Zet; compact: boolean }) {
  const preset = sp.get(stam) ?? '';
  const van = sp.get(`${stam}_van`) ?? '';
  const tot = sp.get(`${stam}_tot`) ?? '';
  const [eigen, setEigen] = useState(Boolean(van || tot));
  // Datums van buitenaf gewist (chip, Alles wissen): terug naar de presets.
  useEffect(() => {
    if (!van && !tot) setEigen(false);
  }, [van, tot]);
  const keuze = preset || (eigen || van || tot ? 'eigen' : '');

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select
        value={keuze}
        onChange={(e) => {
          const v = e.target.value;
          if (v === 'eigen') {
            setEigen(true);
            zet({ [stam]: null });
          } else {
            setEigen(false);
            zet({ [stam]: v || null, [`${stam}_van`]: null, [`${stam}_tot`]: null });
          }
        }}
        className={`veld ${compact ? 'w-auto min-w-[9rem]' : ''}`}
        aria-label="Periode"
      >
        <option value="">Altijd</option>
        {DATUM_PRESETS.map((p) => (
          <option key={p.waarde} value={p.waarde}>
            {p.label}
          </option>
        ))}
        <option value="eigen">Zelf kiezen</option>
      </select>
      {keuze === 'eigen' && (
        <>
          <input
            type="date"
            value={van}
            max={tot || undefined}
            onChange={(e) => zet({ [`${stam}_van`]: e.target.value || null })}
            className="veld w-auto"
            aria-label="Vanaf"
          />
          <span className="text-[12px] text-warm">t/m</span>
          <input
            type="date"
            value={tot}
            min={van || undefined}
            onChange={(e) => zet({ [`${stam}_tot`]: e.target.value || null })}
            className="veld w-auto"
            aria-label="Tot en met"
          />
        </>
      )}
    </div>
  );
}

/** Bedrag van/tot. Wacht even na het typen, anders herlaadt de lijst bij elke cijfer. */
function BedragVeld({ stam, sp, zet }: { stam: string; sp: SP; zet: Zet }) {
  const urlMin = sp.get(`${stam}_min`) ?? '';
  const urlMax = sp.get(`${stam}_max`) ?? '';
  const [min, setMin] = useState(urlMin);
  const [max, setMax] = useState(urlMax);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // De URL veranderde van buitenaf (chip gewist, weergave gekozen): velden volgen.
  useEffect(() => setMin(urlMin), [urlMin]);
  useEffect(() => setMax(urlMax), [urlMax]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function plan(nMin: string, nMax: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      zet({ [`${stam}_min`]: nMin.trim() || null, [`${stam}_max`]: nMax.trim() || null });
    }, 500);
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        inputMode="decimal"
        value={min}
        onChange={(e) => {
          setMin(e.target.value);
          plan(e.target.value, max);
        }}
        placeholder="vanaf €"
        className="veld w-24"
        aria-label="Bedrag vanaf"
      />
      <span className="text-[12px] text-warm">tot</span>
      <input
        inputMode="decimal"
        value={max}
        onChange={(e) => {
          setMax(e.target.value);
          plan(min, e.target.value);
        }}
        placeholder="tot €"
        className="veld w-24"
        aria-label="Bedrag tot"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chips van actieve filters                                           */
/* ------------------------------------------------------------------ */

const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const datum = (s: string) => {
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
};

type Chip = { sleutel: string; label: string; wis: Record<string, string | null> };

function actieveChips(filters: FilterDef[], sp: SP): Chip[] {
  const uit: Chip[] = [];
  for (const f of filters) {
    switch (f.soort) {
      case 'select': {
        const w = sp.get(f.param);
        if (w) uit.push({ sleutel: f.param, label: `${f.label}: ${f.opties.find((o) => o.waarde === w)?.label ?? w}`, wis: { [f.param]: null } });
        break;
      }
      case 'multi': {
        // Chips-weergave toont de keuze al zelf; dan geen dubbele chips eronder.
        if (f.weergave === 'chips') break;
        const gekozen = (sp.get(f.param) ?? '').split(',').filter(Boolean);
        for (const g of gekozen) {
          const rest = gekozen.filter((x) => x !== g).join(',');
          uit.push({ sleutel: `${f.param}:${g}`, label: `${f.label}: ${f.opties.find((o) => o.waarde === g)?.label ?? g}`, wis: { [f.param]: rest || null } });
        }
        break;
      }
      case 'datum': {
        const preset = sp.get(f.param);
        const van = sp.get(`${f.param}_van`);
        const tot = sp.get(`${f.param}_tot`);
        const wis = { [f.param]: null, [`${f.param}_van`]: null, [`${f.param}_tot`]: null };
        if (preset) {
          uit.push({ sleutel: f.param, label: `${f.label}: ${DATUM_PRESETS.find((p) => p.waarde === preset)?.label.toLowerCase() ?? preset}`, wis });
        } else if (van || tot) {
          const tekst = van && tot ? `${datum(van)} t/m ${datum(tot)}` : van ? `vanaf ${datum(van)}` : `t/m ${datum(tot as string)}`;
          uit.push({ sleutel: f.param, label: `${f.label}: ${tekst}`, wis });
        }
        break;
      }
      case 'bedrag': {
        const min = Number(String(sp.get(`${f.param}_min`) ?? '').replace(',', '.'));
        const max = Number(String(sp.get(`${f.param}_max`) ?? '').replace(',', '.'));
        const heeftMin = Boolean(sp.get(`${f.param}_min`)) && Number.isFinite(min);
        const heeftMax = Boolean(sp.get(`${f.param}_max`)) && Number.isFinite(max);
        if (heeftMin || heeftMax) {
          const tekst = heeftMin && heeftMax ? `${euro(min)} tot ${euro(max)}` : heeftMin ? `vanaf ${euro(min)}` : `tot ${euro(max)}`;
          uit.push({ sleutel: f.param, label: `${f.label}: ${tekst}`, wis: { [`${f.param}_min`]: null, [`${f.param}_max`]: null } });
        }
        break;
      }
      case 'aanuit':
        if (sp.get(f.param) === '1') uit.push({ sleutel: f.param, label: f.chipLabel ?? f.label, wis: { [f.param]: null } });
        break;
      case 'zoek': {
        const w = sp.get(f.param);
        if (w) uit.push({ sleutel: f.param, label: `${f.label}: ${f.huidigLabel ?? 'gekozen'}`, wis: { [f.param]: null } });
        break;
      }
    }
  }
  return uit;
}

/* ------------------------------------------------------------------ */
/* Mijn weergaven                                                      */
/* ------------------------------------------------------------------ */

type Weergave = { naam: string; qs: string };

/** Querystring zonder paginering en meldingen, met vaste volgorde, zodat twee gelijke weergaven gelijk zijn. */
function normaal(qs: string): string {
  const p = new URLSearchParams(qs);
  p.delete('pagina');
  for (const m of MELDINGEN) p.delete(m);
  const paren = [...p.entries()].filter(([, v]) => v).sort(([a], [b]) => a.localeCompare(b));
  return new URLSearchParams(paren).toString();
}

function Weergaven({ opslag, gebruiker, sp, pad, kanBewaren }: { opslag: string; gebruiker?: string | null; sp: SP; pad: string; kanBewaren: boolean }) {
  const router = useRouter();
  const sleutel = `fb.weergaven.v1.${opslag}.${(gebruiker ?? 'iedereen').toLowerCase()}`;
  const [lijst, setLijst] = useState<Weergave[]>([]);
  const [open, setOpen] = useState(false);
  const [naam, setNaam] = useState('');
  const ref = useBuitenKlik<HTMLDivElement>(open, () => setOpen(false));
  const huidig = normaal(sp.toString());

  useEffect(() => {
    try {
      const ruw = localStorage.getItem(sleutel);
      const data = ruw ? (JSON.parse(ruw) as unknown) : [];
      setLijst(Array.isArray(data) ? data.filter((w): w is Weergave => !!w && typeof w.naam === 'string' && typeof w.qs === 'string') : []);
    } catch {
      setLijst([]);
    }
  }, [sleutel]);

  function bewaar(nieuw: Weergave[]) {
    setLijst(nieuw);
    try {
      localStorage.setItem(sleutel, JSON.stringify(nieuw));
    } catch {
      /* geen opslag: de weergave geldt alleen tot je de pagina verlaat */
    }
  }

  function voegToe() {
    const n = naam.trim().slice(0, 60);
    if (!n || !huidig) return;
    bewaar([...lijst.filter((w) => w.naam.toLowerCase() !== n.toLowerCase()), { naam: n, qs: huidig }].sort((a, b) => a.naam.localeCompare(b.naam, 'nl')));
    setNaam('');
  }

  const actieveWeergave = lijst.find((w) => w.qs === huidig);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="knop-tekst">
        {actieveWeergave ? actieveWeergave.naam : 'Mijn weergaven'}
        {lijst.length > 0 && !actieveWeergave && <span className="chip-tel">{lijst.length}</span>}
        <span aria-hidden="true" className="text-[10px]">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-1 w-72 rounded-md border border-line bg-white p-2 text-[13px] shadow-lg sm:left-0 sm:right-auto">
          {lijst.length === 0 ? (
            <p className="px-1 pb-2 text-[12px] leading-snug text-warm">
              Nog geen weergaven. Zet de filters zoals je ze vaak gebruikt, bijvoorbeeld alle open orders van één klant, en bewaar ze hieronder onder een naam.
            </p>
          ) : (
            <ul className="mb-2 max-h-64 overflow-y-auto">
              {lijst.map((w) => (
                <li key={w.naam} className={`flex items-center gap-1 rounded ${w.qs === huidig ? 'bg-mist' : ''}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      router.push(w.qs ? `${pad}?${w.qs}` : pad, { scroll: false });
                    }}
                    className="flex-1 truncate px-1.5 py-1 text-left text-ink-800 hover:text-ink-900 hover:underline"
                  >
                    {w.naam}
                  </button>
                  <button
                    type="button"
                    onClick={() => bewaar(lijst.filter((x) => x.naam !== w.naam))}
                    className="flex h-6 w-6 items-center justify-center rounded text-[15px] leading-none text-warm hover:bg-white hover:text-ink-900"
                    aria-label={`Weergave ${w.naam} verwijderen`}
                    title="Verwijderen"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              voegToe();
            }}
            className="flex items-center gap-1.5 border-t border-line pt-2"
          >
            <input
              value={naam}
              onChange={(e) => setNaam(e.target.value)}
              placeholder={kanBewaren ? 'Naam, bijv. Open orders Wassink' : 'Zet eerst een filter'}
              disabled={!kanBewaren}
              className="veld"
              aria-label="Naam van de weergave"
              maxLength={60}
            />
            <button type="submit" disabled={!kanBewaren || !naam.trim()} className="knop-donker shrink-0">
              Bewaar
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

/** Sluit een uitklapper bij een klik ernaast. */
function useBuitenKlik<T extends HTMLElement>(open: boolean, sluit: () => void) {
  const ref = useRef<T>(null);
  const sluitRef = useRef(sluit);
  sluitRef.current = sluit;
  useEffect(() => {
    if (!open) return;
    const weg = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) sluitRef.current();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') sluitRef.current();
    };
    document.addEventListener('mousedown', weg);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', weg);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return ref;
}
