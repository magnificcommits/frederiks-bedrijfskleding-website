'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Taak } from '@/lib/kms/taken';
import type { TaakStatus } from '@/lib/kms/taakStatussen';
import type { TaakPersoon } from '@/lib/kms/taakPersonen';
import { kleurKlassen, initialen } from './statusKleur';

/* ------------------------------------------------------------------ */
/* Iconen (inline, geen extra pakketten)                               */
/* ------------------------------------------------------------------ */

type IcoonProps = { className?: string };
const svg = (className: string, children: ReactNode, strokeWidth = 1.7) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={strokeWidth} className={className} aria-hidden="true">
    {children}
  </svg>
);

export const IcoonAfspraak = ({ className = 'h-4 w-4' }: IcoonProps) =>
  svg(className, <><rect x="3" y="4.5" width="14" height="12.5" rx="2" /><path d="M3 8.5h14M7 2.5v4M13 2.5v4" strokeLinecap="round" /></>);
export const IcoonTaak = ({ className = 'h-4 w-4' }: IcoonProps) =>
  svg(className, <><rect x="3" y="3" width="14" height="14" rx="3" /><path d="M6.5 10.2l2.4 2.4 4.6-5" strokeLinecap="round" strokeLinejoin="round" /></>);
export const IcoonPijl = ({ className = 'h-3.5 w-3.5' }: IcoonProps) =>
  svg(className, <path d="M7 13l6-6M8 7h5v5" strokeLinecap="round" strokeLinejoin="round" />, 1.8);
export const IcoonPrullenbak = ({ className = 'h-4 w-4' }: IcoonProps) =>
  svg(className, <path d="M4 6h12M8 6V4h4v2M6 6l.8 10h6.4L14 6" strokeLinecap="round" strokeLinejoin="round" />);
export const IcoonPotlood = ({ className = 'h-4 w-4' }: IcoonProps) =>
  svg(className, <path d="M12.5 4.5l3 3L8 15H5v-3l7.5-7.5z" strokeLinejoin="round" />);
export const IcoonBel = ({ className = 'h-3.5 w-3.5' }: IcoonProps) =>
  svg(className, <><path d="M5.5 13.5V9a4.5 4.5 0 019 0v4.5l1.5 1.5h-12l1.5-1.5z" strokeLinejoin="round" /><path d="M8.5 17h3" strokeLinecap="round" /></>);
export const IcoonHerhaal = ({ className = 'h-3.5 w-3.5' }: IcoonProps) =>
  svg(className, <path d="M4 9a6 6 0 0110.5-3.5L16 7M16 3v4h-4M16 11a6 6 0 01-10.5 3.5L4 13M4 17v-4h4" strokeLinecap="round" strokeLinejoin="round" />);
export const IcoonLocatie = ({ className = 'h-3.5 w-3.5' }: IcoonProps) =>
  svg(className, <><path d="M10 17s5-4.6 5-8.5A5 5 0 005 8.5C5 12.4 10 17 10 17z" strokeLinejoin="round" /><circle cx="10" cy="8.5" r="1.8" /></>);
export const IcoonTandwiel = ({ className = 'h-4 w-4' }: IcoonProps) =>
  svg(className, <><circle cx="10" cy="10" r="2.5" /><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" strokeLinecap="round" /></>);
export const IcoonArchief = ({ className = 'h-4 w-4' }: IcoonProps) =>
  svg(className, <><rect x="3" y="4" width="14" height="4" rx="1" /><path d="M4.5 8v7.5h11V8M8 11h4" strokeLinecap="round" strokeLinejoin="round" /></>);
export const IcoonKlok = ({ className = 'h-3.5 w-3.5' }: IcoonProps) =>
  svg(className, <><circle cx="10" cy="10" r="7" /><path d="M10 6v4l2.5 2" strokeLinecap="round" /></>);

const Pijltje = () => (
  <svg viewBox="0 0 20 20" className="pointer-events-none absolute right-2 h-3 w-3 opacity-60" aria-hidden="true">
    <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
  </svg>
);

/* ------------------------------------------------------------------ */
/* Status en persoon                                                   */
/* ------------------------------------------------------------------ */

/** Opties voor een keuzelijst: actieve statussen, plus de huidige als die uit staat of onbekend is. */
export function statusOpties(statussen: TaakStatus[], huidig: string | null): { naam: string; uit: boolean }[] {
  const lijst = statussen.filter((s) => s.actief).map((s) => ({ naam: s.naam, uit: false }));
  if (huidig && !lijst.some((o) => o.naam === huidig)) lijst.push({ naam: huidig, uit: true });
  return lijst;
}

/** Status als gekleurde pill met keuzelijst. */
export function StatusPill({
  waarde,
  statussen,
  onKies,
  disabled,
  label = 'Status',
}: {
  waarde: string | null;
  statussen: TaakStatus[];
  onKies: (v: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  const s = statussen.find((x) => x.naam === waarde);
  const k = kleurKlassen(s?.kleur ?? 'grijs');
  const opties = statusOpties(statussen, waarde);
  return (
    <span className={`relative inline-flex max-w-full items-center gap-1.5 rounded-full py-1 pl-2.5 pr-1 text-[13px] font-semibold ${k.pill}`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${k.dot}`} aria-hidden="true" />
      <select
        value={waarde ?? ''}
        aria-label={label}
        disabled={disabled}
        onChange={(e) => onKies(e.target.value)}
        className="min-w-0 max-w-[13rem] cursor-pointer appearance-none truncate bg-transparent pr-5 font-semibold focus:outline-none"
      >
        {!waarde && <option value="">Geen status</option>}
        {opties.map((o) => (
          <option key={o.naam} value={o.naam}>
            {o.naam}
            {o.uit ? ' (uitgezet)' : ''}
          </option>
        ))}
      </select>
      <Pijltje />
    </span>
  );
}

export function Avatar({ persoon, naam, klein }: { persoon?: TaakPersoon | null; naam?: string | null; klein?: boolean }) {
  const k = kleurKlassen(persoon?.kleur ?? 'grijs');
  const tekst = persoon?.naam ?? naam ?? '';
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${klein ? 'h-5 w-5 text-[9px]' : 'h-7 w-7 text-[11px]'} ${
        tekst ? k.avatar : 'border border-dashed border-ink-300 bg-white text-ink-300'
      }`}
      aria-hidden="true"
    >
      {tekst ? initialen(tekst) : '+'}
    </span>
  );
}

/** Persoon als avatar-chip met keuzelijst uit de vaste personen (geen vrij typen). */
export function PersoonChip({
  persoonId,
  losseNaam,
  personen,
  onKies,
  disabled,
  compact,
}: {
  persoonId: string | null;
  /** Oude, vrij getypte naam zonder koppeling. */
  losseNaam?: string | null;
  personen: TaakPersoon[];
  onKies: (id: string | null) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const huidig = personen.find((p) => p.id === persoonId) ?? null;
  const opties = personen.filter((p) => p.actief || p.id === persoonId);
  const label = huidig?.naam ?? (losseNaam ? losseNaam : 'Niemand');
  return (
    <span
      className={`relative inline-flex max-w-full items-center gap-2 rounded-full border border-transparent py-0.5 pl-0.5 pr-6 text-[13px] hover:border-line ${
        disabled ? 'opacity-60' : ''
      }`}
      title={huidig ? `Toegewezen aan ${huidig.naam}` : 'Nog niemand'}
    >
      <Avatar persoon={huidig} naam={huidig ? null : losseNaam} />
      {!compact && <span className={`truncate ${huidig ? 'font-semibold text-ink-900' : 'text-ink-400'}`}>{label}</span>}
      <select
        value={persoonId ?? ''}
        aria-label="Persoon"
        disabled={disabled}
        onChange={(e) => onKies(e.target.value || null)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        <option value="">Niemand</option>
        {opties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.naam}
            {p.actief ? '' : ' (uitgezet)'}
          </option>
        ))}
      </select>
      <Pijltje />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Herkomst                                                            */
/* ------------------------------------------------------------------ */

export function BronBadge({ taak }: { taak: Taak }) {
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
      <span className="inline-flex whitespace-nowrap rounded bg-sky-50 px-1.5 py-0.5 text-[12px] font-semibold text-sky-800">{inhoud}</span>
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

/* ------------------------------------------------------------------ */
/* Tekstvak dat meegroeit                                              */
/* ------------------------------------------------------------------ */

/** Meerregelige tekst die meegroeit. Opslaan bij wegklikken of Ctrl+Enter; Escape zet terug. */
export function GroeiTekst({
  waarde,
  onOpslaan,
  label,
  placeholder,
  disabled,
  className = '',
}: {
  waarde: string | null;
  onOpslaan: (v: string) => void;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
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
  }, [concept, focus]);

  return (
    <textarea
      ref={ref}
      rows={focus ? 3 : 1}
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
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) (e.target as HTMLTextAreaElement).blur();
      }}
      className={`block w-full resize-none overflow-hidden whitespace-pre-wrap rounded-md border border-transparent bg-transparent px-2.5 py-2 text-[14px] leading-relaxed text-ink-900 placeholder:text-ink-300 hover:border-line focus:min-h-[84px] focus:border-amber-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:opacity-60 ${className}`}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Melding onderin, met optionele knop (Ongedaan maken)                */
/* ------------------------------------------------------------------ */

export type Melding = {
  tekst: string;
  soort: 'ok' | 'fout';
  actie?: { label: string; onClick: () => void };
};

export function MeldingBalk({ melding, onSluit }: { melding: Melding | null; onSluit: () => void }) {
  useEffect(() => {
    if (!melding) return;
    const t = setTimeout(onSluit, melding.actie ? 7000 : melding.soort === 'fout' ? 6000 : 2800);
    return () => clearTimeout(t);
  }, [melding, onSluit]);
  if (!melding) return null;
  return (
    <div className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 md:left-auto md:right-6 md:translate-x-0">
      <div
        role="status"
        aria-live="polite"
        className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold shadow-card ${
          melding.soort === 'fout' ? 'border-red-200 bg-red-50 text-red-800' : 'border-ink-800 bg-ink-900 text-white'
        }`}
      >
        <span>{melding.tekst}</span>
        {melding.actie && (
          <>
            <span aria-hidden="true" className="opacity-40">·</span>
            <button
              type="button"
              onClick={() => {
                melding.actie?.onClick();
                onSluit();
              }}
              className="rounded px-1 font-bold text-amber-300 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              {melding.actie.label}
            </button>
          </>
        )}
        <button type="button" onClick={onSluit} aria-label="Sluiten" className="opacity-60 hover:opacity-100">
          ✕
        </button>
      </div>
    </div>
  );
}

/** Knop die eerst om bevestiging vraagt (twee keer klikken), in plaats van window.confirm. */
export function BevestigKnop({
  children,
  bevestig = 'Zeker weten?',
  onBevestig,
  className = 'knop-tekst text-red-700 hover:bg-red-50 hover:text-red-800',
  disabled,
}: {
  children: ReactNode;
  bevestig?: string;
  onBevestig: () => void;
  className?: string;
  disabled?: boolean;
}) {
  const [vraag, setVraag] = useState(false);
  useEffect(() => {
    if (!vraag) return;
    const t = setTimeout(() => setVraag(false), 4000);
    return () => clearTimeout(t);
  }, [vraag]);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (vraag) {
          setVraag(false);
          onBevestig();
        } else setVraag(true);
      }}
      className={`${className} ${vraag ? '!bg-red-600 !text-white' : ''}`}
    >
      {vraag ? bevestig : children}
    </button>
  );
}
