'use client';

import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  KLEURGROEPEN,
  alleMaten,
  kleurSleutel,
  normaliseerKleur,
  normaliseerMaat,
  type VariantLijsten,
} from '@/lib/kms/variantenStandaard';

/**
 * Keuzeveld voor maat en kleur uit de vaste lijst (Instellingen > Varianten).
 *
 * De lijst gaat één keer via <VariantLijstBron> naar de browser; elk veld leest
 * hem uit de context. Zo hoeft een product met 200 varianten de lijst niet 400
 * keer mee te sturen.
 *
 * Typ om te zoeken; "black" vindt ook Zwart, omdat aliassen meetellen. Een
 * waarde die niet in de lijst staat kan alleen na een duidelijke vraag, en wordt
 * dan niet aan de lijst toegevoegd. Een bestaande leverancierswaarde blijft
 * staan zolang je hem niet aanraakt.
 */

const LijstCtx = createContext<VariantLijsten | null>(null);

export function VariantLijstBron({ lijst, children }: { lijst: VariantLijsten; children: ReactNode }) {
  return <LijstCtx.Provider value={lijst}>{children}</LijstCtx.Provider>;
}

type Optie = { waarde: string; sub: string; zoek: string[]; hex?: string; hex2?: string | null };

const groepNaam = new Map<string, string>(KLEURGROEPEN.map((g) => [g.id, g.naam]));
const groepVolgorde = new Map<string, number>(KLEURGROEPEN.map((g, i) => [g.id, i]));
const plat = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

function opties(lijst: VariantLijsten, soort: 'kleur' | 'maat'): Optie[] {
  if (soort === 'kleur') {
    return lijst.kleuren
      .filter((k) => k.actief !== false)
      .sort((a, b) => (groepVolgorde.get(a.groep) ?? 99) - (groepVolgorde.get(b.groep) ?? 99) || a.volgorde - b.volgorde)
      .map((k) => ({
        waarde: k.naam,
        sub: groepNaam.get(k.groep) ?? k.groep,
        zoek: [plat(k.naam), ...k.aliassen.map(plat)],
        hex: k.hex,
        hex2: k.hex2,
      }));
  }
  const perMaat = new Map<string, Optie>();
  for (const m of alleMaten(lijst)) {
    const o = perMaat.get(m.maat);
    if (o) o.sub = `${o.sub}, ${m.reeks}`;
    else perMaat.set(m.maat, { waarde: m.maat, sub: m.reeks, zoek: [plat(m.maat)] });
  }
  return [...perMaat.values()];
}

export function KleurStaal({ hex, hex2, className = 'h-3.5 w-3.5' }: { hex?: string | null; hex2?: string | null; className?: string }) {
  if (!hex) return null;
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-sm border border-ink-300 ${className}`}
      style={{ background: hex2 ? `linear-gradient(135deg, ${hex} 50%, ${hex2} 50%)` : hex }}
    />
  );
}

export default function VariantKiezer({
  soort,
  name,
  defaultValue = '',
  placeholder,
  className = '',
  ariaLabel,
}: {
  soort: 'kleur' | 'maat';
  name: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const lijst = useContext(LijstCtx);
  const alle = useMemo(() => (lijst ? opties(lijst, soort) : []), [lijst, soort]);
  const [tekst, setTekst] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [actief, setActief] = useState(0);
  const [vrijBevestigd, setVrijBevestigd] = useState<string | null>(null);
  const invoer = useRef<HTMLInputElement>(null);
  const id = useId();
  const lijstId = `${id}-lijst`;

  const inLijst = useMemo(() => new Set(alle.map((o) => o.waarde)), [alle]);
  const standaard = useMemo(() => {
    if (!lijst || !tekst.trim() || inLijst.has(tekst.trim())) return null;
    const u = soort === 'kleur' ? normaliseerKleur(tekst, lijst) : normaliseerMaat(tekst, lijst);
    return u.zeker ? u.naam : null;
  }, [lijst, tekst, inLijst, soort]);

  const gefilterd = useMemo(() => {
    const t = plat(tekst);
    if (!t) return alle;
    const sleutel = soort === 'kleur' ? kleurSleutel(tekst) : t;
    const begin: Optie[] = [];
    const rest: Optie[] = [];
    for (const o of alle) {
      if (o.waarde === standaard) begin.unshift(o);
      else if (o.zoek.some((z) => z.startsWith(t) || z === sleutel)) begin.push(o);
      else if (o.zoek.some((z) => z.includes(t))) rest.push(o);
    }
    return [...begin, ...rest];
  }, [alle, tekst, standaard, soort]);

  const waarde = tekst.trim();
  const vrij = !!waarde && !inLijst.has(waarde) && waarde !== defaultValue.trim();
  const toonVrijeOptie = !!waarde && !inLijst.has(waarde);

  // Vraag bij versturen nog één keer als er een waarde buiten de lijst staat.
  useEffect(() => {
    const form = invoer.current?.form;
    if (!form) return;
    const bewaak = (e: SubmitEvent) => {
      const v = (invoer.current?.value ?? '').trim();
      if (!v || inLijst.has(v) || v === defaultValue.trim() || v === vrijBevestigd) return;
      const ok = window.confirm(
        `"${v}" staat niet in de vaste lijst met ${soort === 'kleur' ? 'kleuren' : 'maten'}. Toch zo opslaan?\n\n` +
          'Nieuwe waarden voeg je toe bij Instellingen > Varianten.',
      );
      if (!ok) {
        e.preventDefault();
        e.stopImmediatePropagation();
        invoer.current?.focus();
      }
    };
    form.addEventListener('submit', bewaak, { capture: true });
    return () => form.removeEventListener('submit', bewaak, { capture: true });
  }, [inLijst, defaultValue, vrijBevestigd, soort]);

  function kies(v: string) {
    setTekst(v);
    setOpen(false);
  }

  function kiesVrij() {
    const ok = window.confirm(
      `"${waarde}" staat niet in de vaste lijst. Toch gebruiken voor deze variant?\n\n` +
        'De waarde wordt niet aan de lijst toegevoegd. Dat doe je bij Instellingen > Varianten.',
    );
    if (ok) {
      setVrijBevestigd(waarde);
      setOpen(false);
    }
  }

  const aantalOpties = gefilterd.length + (toonVrijeOptie ? 1 : 0);

  return (
    <div className="relative">
      <input
        ref={invoer}
        name={name}
        value={tekst}
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={lijstId}
        aria-autocomplete="list"
        aria-activedescendant={open && aantalOpties > 0 ? `${id}-o${actief}` : undefined}
        aria-invalid={vrij && vrijBevestigd !== waarde ? true : undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        onChange={(e) => {
          setTekst(e.target.value);
          setOpen(true);
          setActief(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActief((a) => Math.min(a + 1, Math.max(aantalOpties - 1, 0)));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActief((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter' && open && aantalOpties > 0) {
            e.preventDefault();
            if (actief < gefilterd.length) kies(gefilterd[actief].waarde);
            else kiesVrij();
          } else if (e.key === 'Escape' && open) {
            e.preventDefault();
            setOpen(false);
          }
        }}
        className={`veld ${vrij && vrijBevestigd !== waarde ? 'border-amber-400' : ''} ${className}`}
      />
      {open && aantalOpties > 0 && (
        <ul
          id={lijstId}
          role="listbox"
          className="absolute left-0 top-full z-40 mt-1 max-h-64 min-w-[15rem] overflow-auto rounded-md border border-line bg-white py-1 text-[13px] shadow-card"
        >
          {gefilterd.slice(0, 200).map((o, i) => (
            <li
              key={o.waarde}
              id={`${id}-o${i}`}
              role="option"
              aria-selected={i === actief}
              onMouseDown={(e) => {
                e.preventDefault();
                kies(o.waarde);
              }}
              onMouseEnter={() => setActief(i)}
              className={`flex cursor-pointer items-center gap-2 px-2.5 py-1.5 ${i === actief ? 'bg-mist' : ''}`}
            >
              {soort === 'kleur' && <KleurStaal hex={o.hex} hex2={o.hex2} />}
              <span className="font-medium text-ink-900">{o.waarde}</span>
              <span className="ml-auto truncate pl-3 text-[11px] text-warm">{o.sub}</span>
            </li>
          ))}
          {toonVrijeOptie && (
            <li
              id={`${id}-o${gefilterd.length}`}
              role="option"
              aria-selected={actief === gefilterd.length}
              onMouseDown={(e) => {
                e.preventDefault();
                kiesVrij();
              }}
              onMouseEnter={() => setActief(gefilterd.length)}
              className={`cursor-pointer border-t border-line px-2.5 py-1.5 text-[12px] text-amber-800 ${actief === gefilterd.length ? 'bg-amber-50' : ''}`}
            >
              &lsquo;{waarde}&rsquo; toch gebruiken (staat niet in de vaste lijst)
            </li>
          )}
        </ul>
      )}
      {vrij && (
        <p className="mt-0.5 text-[11px] leading-tight text-amber-800">
          Niet standaard.
          {standaard && (
            <>
              {' '}
              <button type="button" className="font-semibold underline underline-offset-2" onClick={() => kies(standaard)}>
                Maak er {standaard} van
              </button>
            </>
          )}
        </p>
      )}
    </div>
  );
}
