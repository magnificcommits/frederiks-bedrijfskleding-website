'use client';

/**
 * Herbruikbare invoervelden voor het instellingenpaneel: kleur, getal met -/+,
 * padding per zijde, uitlijning, verbergen, aan/uit-schakelaar.
 * Groot genoeg om prettig mee te werken, met Nederlandse labels.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { HUISSTIJL, type Padding, type Uitlijning, type Verbergen } from '@/lib/nieuwsbrief/types';
import { IcoonComputer, IcoonLinks, IcoonMidden, IcoonMin, IcoonNiets, IcoonPlus, IcoonRechts, IcoonTelefoon } from './iconen';

/** Eén regel in het paneel: label links, invoer rechts (of eronder bij `onder`). */
export function Rij({ label, hint, children, onder = false }: { label: string; hint?: ReactNode; children: ReactNode; onder?: boolean }) {
  return (
    <div className="border-b border-line px-4 py-3">
      <div className={onder ? 'flex flex-col gap-2' : 'flex items-center justify-between gap-3'}>
        <span className="text-[13px] font-semibold text-ink-800">{label}</span>
        <div className={onder ? '' : 'flex shrink-0 items-center gap-2'}>{children}</div>
      </div>
      {hint && <p className="mt-1.5 text-[12px] leading-snug text-warm">{hint}</p>}
    </div>
  );
}

export function Groepkop({ children }: { children: ReactNode }) {
  return <p className="border-b border-line bg-mist px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-warm">{children}</p>;
}

/* ------------------------------------------------------------------ */
/* Kleur                                                               */
/* ------------------------------------------------------------------ */

const PRESETS = [HUISSTIJL.charcoal, HUISSTIJL.oranje, HUISSTIJL.tekst, HUISSTIJL.grijs, HUISSTIJL.lijn, HUISSTIJL.zand, '#fbf4ef', HUISSTIJL.wit];

function naarHex6(v: string): string {
  const s = v.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{3}$/.test(s)) return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  return '#ffffff';
}

/**
 * Kleurkiezer. `leeg` = wat een lege waarde betekent ('Transparant' of
 * 'Standaard'); zonder `leeg` is een kleur verplicht.
 */
export function KleurVeld({
  waarde,
  onChange,
  leeg,
  label,
}: {
  waarde: string;
  onChange: (v: string) => void;
  leeg?: string;
  label: string;
}) {
  const [tekst, setTekst] = useState(waarde);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => setTekst(waarde), [waarde]);
  useEffect(() => {
    if (!open) return;
    const dicht = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', dicht);
    return () => document.removeEventListener('mousedown', dicht);
  }, [open]);

  const commit = (v: string) => {
    const s = v.trim();
    if (!s && leeg) return onChange('');
    const metHekje = s.startsWith('#') ? s : `#${s}`;
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(metHekje)) onChange(metHekje.toLowerCase());
    else setTekst(waarde);
  };

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={`${label}: kies een kleur`}
          aria-expanded={open}
          className="h-8 w-8 shrink-0 rounded-md border border-ink-200 shadow-inner"
          style={
            waarde
              ? { backgroundColor: waarde }
              : { backgroundImage: 'linear-gradient(45deg,#ddd 25%,transparent 25%,transparent 75%,#ddd 75%),linear-gradient(45deg,#ddd 25%,#fff 25%,#fff 75%,#ddd 75%)', backgroundSize: '8px 8px', backgroundPosition: '0 0,4px 4px' }
          }
        />
        <input
          value={tekst}
          onChange={(e) => setTekst(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
          }}
          placeholder={leeg ?? '#000000'}
          aria-label={label}
          className="veld w-[104px] font-mono text-[13px]"
        />
      </div>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-56 rounded-lg border border-line bg-white p-3 shadow-card">
          <div className="grid grid-cols-8 gap-1.5">
            {PRESETS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  onChange(k);
                  setOpen(false);
                }}
                aria-label={`Kleur ${k}`}
                title={k}
                className={`h-6 w-6 rounded border ${waarde === k ? 'ring-2 ring-blue-500 ring-offset-1' : 'border-ink-200'}`}
                style={{ backgroundColor: k }}
              />
            ))}
          </div>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-[13px] text-ink-800">
            <input type="color" value={naarHex6(waarde || '#ffffff')} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-line" />
            Andere kleur kiezen
          </label>
          {leeg && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className="knop-stil mt-2 w-full justify-center"
            >
              {leeg}
            </button>
          )}
          <button type="button" onClick={() => setOpen(false)} className="knop-tekst mt-1 w-full justify-center">
            Sluiten
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Getallen                                                            */
/* ------------------------------------------------------------------ */

export function Stapper({
  waarde,
  onChange,
  min = 0,
  max = 200,
  stap = 1,
  label,
  eenheid,
}: {
  waarde: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  stap?: number;
  label: string;
  eenheid?: string;
}) {
  const [tekst, setTekst] = useState(String(waarde));
  // Alleen bijwerken als de waarde van buitenaf verandert (bv. ongedaan maken),
  // niet tijdens het typen van "1," of "1.".
  useEffect(() => setTekst((t) => (Number(t.replace(',', '.')) === waarde ? t : String(waarde))), [waarde]);
  const zet = (n: number) => {
    const afgerond = Math.round(Math.min(max, Math.max(min, n)) * 100) / 100;
    onChange(afgerond);
    setTekst(String(afgerond));
  };
  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={() => zet(waarde - stap)}
        disabled={waarde <= min}
        aria-label={`${label} kleiner`}
        className="flex h-8 w-8 items-center justify-center rounded-l-md border border-line bg-white text-ink-700 hover:bg-mist disabled:opacity-40"
      >
        <IcoonMin className="h-3.5 w-3.5" />
      </button>
      <input
        value={tekst}
        inputMode="decimal"
        onChange={(e) => {
          setTekst(e.target.value);
          const n = Number(e.target.value.replace(',', '.'));
          if (e.target.value.trim() !== '' && Number.isFinite(n) && n >= min && n <= max) onChange(n);
        }}
        onBlur={() => setTekst(String(waarde))}
        aria-label={label}
        className="h-8 w-14 border-y border-line bg-white text-center text-[13px] tabular-nums text-ink-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
      />
      <button
        type="button"
        onClick={() => zet(waarde + stap)}
        disabled={waarde >= max}
        aria-label={`${label} groter`}
        className="flex h-8 w-8 items-center justify-center rounded-r-md border border-line bg-white text-ink-700 hover:bg-mist disabled:opacity-40"
      >
        <IcoonPlus className="h-3.5 w-3.5" />
      </button>
      {eenheid && <span className="ml-1.5 text-[12px] text-warm">{eenheid}</span>}
    </div>
  );
}

/** Padding per zijde, met een schakelaar "alle zijdes gelijk". */
export function PaddingVeld({ waarde, onChange, label = 'Ruimte binnenin (padding)' }: { waarde: Padding; onChange: (p: Padding) => void; label?: string }) {
  const gelijk = waarde.boven === waarde.rechts && waarde.rechts === waarde.onder && waarde.onder === waarde.links;
  const [apart, setApart] = useState(!gelijk);
  return (
    <div className="border-b border-line px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-semibold text-ink-800">{label}</span>
        <label className="flex cursor-pointer items-center gap-2 text-[12px] text-warm">
          Per zijde
          <Schakelaar aan={apart} onChange={setApart} label="Padding per zijde instellen" />
        </label>
      </div>
      {apart ? (
        <div className="mt-2 grid gap-2">
          {(
            [
              ['boven', 'Boven'],
              ['onder', 'Onder'],
              ['links', 'Links'],
              ['rechts', 'Rechts'],
            ] as const
          ).map(([k, l]) => (
            <div key={k} className="flex items-center justify-between">
              <span className="text-[13px] text-warm">{l}</span>
              <Stapper waarde={waarde[k]} onChange={(n) => onChange({ ...waarde, [k]: n })} label={`Padding ${l.toLowerCase()}`} max={200} eenheid="px" />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[13px] text-warm">Alle zijdes</span>
          <Stapper
            waarde={Math.max(waarde.boven, waarde.rechts, waarde.onder, waarde.links)}
            onChange={(n) => onChange({ boven: n, rechts: n, onder: n, links: n })}
            label="Padding alle zijdes"
            max={200}
            eenheid="px"
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Keuzes                                                              */
/* ------------------------------------------------------------------ */

export function Segment<T extends string | number>({
  waarde,
  opties,
  onChange,
  label,
}: {
  waarde: T;
  opties: { waarde: T; label: string; icoon?: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex overflow-hidden rounded-md border border-line">
      {opties.map((o) => {
        const aan = o.waarde === waarde;
        return (
          <button
            key={String(o.waarde)}
            type="button"
            role="radio"
            aria-checked={aan}
            aria-label={o.icoon ? o.label : undefined}
            title={o.label}
            onClick={() => onChange(o.waarde)}
            className={`flex h-8 min-w-[2rem] items-center justify-center border-l border-line px-2 text-[12px] font-semibold first:border-l-0 ${
              aan ? 'bg-blue-50 text-blue-700' : 'bg-white text-ink-600 hover:bg-mist'
            }`}
          >
            {o.icoon ?? o.label}
          </button>
        );
      })}
    </div>
  );
}

export function UitlijningKeuze({ waarde, onChange }: { waarde: Uitlijning; onChange: (u: Uitlijning) => void }) {
  return (
    <Segment
      label="Uitlijning"
      waarde={waarde}
      onChange={onChange}
      opties={[
        { waarde: 'links', label: 'Links uitlijnen', icoon: <IcoonLinks /> },
        { waarde: 'midden', label: 'Centreren', icoon: <IcoonMidden /> },
        { waarde: 'rechts', label: 'Rechts uitlijnen', icoon: <IcoonRechts /> },
      ]}
    />
  );
}

export function VerbergenKeuze({ waarde, onChange }: { waarde: Verbergen; onChange: (v: Verbergen) => void }) {
  return (
    <Rij
      label="Element verbergen"
      hint={waarde === 'desktop' ? 'Alleen zichtbaar op een telefoon.' : waarde === 'mobiel' ? 'Alleen zichtbaar op een computer.' : undefined}
    >
      <Segment
        label="Element verbergen"
        waarde={waarde}
        onChange={onChange}
        opties={[
          { waarde: 'geen', label: 'Altijd tonen', icoon: <IcoonNiets /> },
          { waarde: 'desktop', label: 'Verbergen op een computer', icoon: <IcoonComputer /> },
          { waarde: 'mobiel', label: 'Verbergen op een telefoon', icoon: <IcoonTelefoon /> },
        ]}
      />
    </Rij>
  );
}

export function Schakelaar({ aan, onChange, label }: { aan: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={aan}
      aria-label={label}
      onClick={() => onChange(!aan)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${aan ? 'bg-blue-600' : 'bg-ink-200'}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${aan ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

/** Tekstveld over de volle breedte van het paneel. */
export function TekstVeld({
  label,
  waarde,
  onChange,
  placeholder,
  hint,
  meerRegels = false,
  type = 'text',
}: {
  label: string;
  waarde: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: ReactNode;
  meerRegels?: boolean;
  type?: 'text' | 'url' | 'email';
}) {
  const id = useId();
  return (
    <div className="border-b border-line px-4 py-3">
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-ink-800">
        {label}
      </label>
      {meerRegels ? (
        <textarea id={id} value={waarde} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className="veld text-[14px]" />
      ) : (
        <input id={id} type={type} value={waarde} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="veld text-[14px]" />
      )}
      {hint && <p className="mt-1.5 text-[12px] leading-snug text-warm">{hint}</p>}
    </div>
  );
}
