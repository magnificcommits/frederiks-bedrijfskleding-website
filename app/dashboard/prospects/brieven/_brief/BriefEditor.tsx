'use client';
import { bevestig } from '@/components/dashboard/ui/Bevestig';

/**
 * Blokeditor voor de A4-brief met live voorbeeld.
 *
 * Waarom niet de nieuwsbrief-editor: die bouwt een e-mail van 600 px met secties
 * en kolommen die op een telefoon stapelen, met mail-blokken (webversie,
 * afmelden, social). Een brief is één vel papier met vaste plekken voor het
 * adresvenster en heeft blokken die een mail niet kent (QR-code, kleding met het
 * logo van de prospect, handtekening). Zelfde werkwijze (blokken kiezen,
 * verslepen met pijltjes, rechts direct zien), eigen datamodel in millimeters.
 *
 * Links: blokken, opmaak en templates. Rechts: de brief op A4 voor een echte
 * prospect uit de verzending. Klik in de brief op een blok om het te bewerken.
 * Elke wijziging wordt na anderhalve seconde opgeslagen. Bij elke wijziging
 * meten we alle voorbeelden: past het niet op één A4, dan staat dat er meteen.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BRIEF_BLOKTYPEN,
  BRIEF_LETTERTYPEN,
  BRIEF_VELDEN,
  briefId,
  inhoudHoogte,
  kopieerOntwerp,
  nieuwBriefBlok,
  type BriefBlok,
  type BriefBlokType,
  type BriefInstellingen,
  type BriefOntwerp,
  type Uitlijning,
} from '@/lib/prospect/briefTypes';
import { INGEBOUWDE_TEMPLATES } from '@/lib/prospect/briefTemplates';
import { onbekendeVelden, type BriefPersoon } from '@/lib/prospect/briefRender';
import { bewaarTemplateActie, slaBatchOntwerpOpActie, verwijderTemplateActie } from '../actions';
import BriefPagina from './BriefPagina';
import { meetBrieven, type TeLang } from './PastCheck';

export type EditorTemplate = { id: string; naam: string; omschrijving: string | null; ontwerp: BriefOntwerp };

/* ------------------------------------------------------------------ */
/* Toestand                                                            */
/* ------------------------------------------------------------------ */

type State = { ontwerp: BriefOntwerp; verleden: BriefOntwerp[]; toekomst: BriefOntwerp[]; versie: number; sleutel: string | null; tijd: number };

type Actie =
  | { type: 'instellingen'; patch: Partial<BriefInstellingen>; sleutel?: string }
  | { type: 'blok'; id: string; patch: Partial<BriefBlok>; sleutel?: string }
  | { type: 'toevoegen'; blokType: BriefBlokType; na: string | null; id: string }
  | { type: 'verplaats'; id: string; richting: -1 | 1 }
  | { type: 'dupliceer'; id: string; nieuwId: string }
  | { type: 'verwijder'; id: string }
  | { type: 'vervang'; ontwerp: BriefOntwerp }
  | { type: 'ongedaan' }
  | { type: 'opnieuw' };

const SAMENVOEG_MS = 1200;

function reducer(s: State, a: Actie): State {
  if (a.type === 'ongedaan') {
    const vorige = s.verleden[s.verleden.length - 1];
    if (!vorige) return s;
    return { ...s, ontwerp: vorige, verleden: s.verleden.slice(0, -1), toekomst: [s.ontwerp, ...s.toekomst].slice(0, 80), versie: s.versie + 1, sleutel: null };
  }
  if (a.type === 'opnieuw') {
    const volgende = s.toekomst[0];
    if (!volgende) return s;
    return { ...s, ontwerp: volgende, verleden: [...s.verleden, s.ontwerp].slice(-80), toekomst: s.toekomst.slice(1), versie: s.versie + 1, sleutel: null };
  }
  const o = s.ontwerp;
  let nieuw: BriefOntwerp = o;
  const blokken = [...o.blokken];
  const idx = (id: string) => blokken.findIndex((b) => b.id === id);
  switch (a.type) {
    case 'instellingen':
      nieuw = { ...o, instellingen: { ...o.instellingen, ...a.patch } };
      break;
    case 'blok': {
      const i = idx(a.id);
      if (i === -1) return s;
      blokken[i] = { ...blokken[i], ...a.patch } as BriefBlok;
      nieuw = { ...o, blokken };
      break;
    }
    case 'toevoegen': {
      const b = { ...nieuwBriefBlok(a.blokType), id: a.id };
      const i = a.na ? idx(a.na) : -1;
      blokken.splice(i === -1 ? blokken.length : i + 1, 0, b);
      nieuw = { ...o, blokken };
      break;
    }
    case 'verplaats': {
      const i = idx(a.id);
      const j = i + a.richting;
      if (i === -1 || j < 0 || j >= blokken.length) return s;
      [blokken[i], blokken[j]] = [blokken[j], blokken[i]];
      nieuw = { ...o, blokken };
      break;
    }
    case 'dupliceer': {
      const i = idx(a.id);
      if (i === -1) return s;
      blokken.splice(i + 1, 0, { ...JSON.parse(JSON.stringify(blokken[i])), id: a.nieuwId });
      nieuw = { ...o, blokken };
      break;
    }
    case 'verwijder':
      nieuw = { ...o, blokken: blokken.filter((b) => b.id !== a.id) };
      break;
    case 'vervang':
      nieuw = a.ontwerp;
      break;
  }
  const sleutel = 'sleutel' in a ? a.sleutel ?? null : null;
  const nu = Date.now();
  const samenvoegen = sleutel !== null && sleutel === s.sleutel && nu - s.tijd < SAMENVOEG_MS;
  return {
    ontwerp: nieuw,
    verleden: samenvoegen ? s.verleden : [...s.verleden, o].slice(-80),
    toekomst: [],
    versie: s.versie + 1,
    sleutel,
    tijd: nu,
  };
}

/* ------------------------------------------------------------------ */
/* Kleine velden                                                       */
/* ------------------------------------------------------------------ */

function Rij({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <span className="veld-label">{label}</span>
      {children}
      {hint && <p className="veld-hint">{hint}</p>}
    </div>
  );
}

function Getal({ waarde, zet, min, max, stap = 1, eenheid, label }: { waarde: number; zet: (n: number) => void; min: number; max: number; stap?: number; eenheid: string; label: string }) {
  return (
    <label className="block">
      <span className="veld-label">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={stap}
          value={waarde}
          onChange={(e) => zet(Number(e.target.value))}
          className="h-1.5 grow cursor-pointer accent-amber-500"
          aria-label={label}
        />
        <input
          type="number"
          min={min}
          max={max}
          step={stap}
          value={waarde}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) zet(Math.min(max, Math.max(min, n)));
          }}
          className="veld w-[4.5rem] px-2 py-1 text-right text-[13px] tabular-nums"
          aria-label={`${label} in ${eenheid}`}
        />
        <span className="w-6 text-[12px] text-warm">{eenheid}</span>
      </span>
    </label>
  );
}

function UitlijnKeuze({ waarde, zet }: { waarde: Uitlijning; zet: (u: Uitlijning) => void }) {
  const opties: [Uitlijning, string][] = [['links', 'Links'], ['midden', 'Midden'], ['rechts', 'Rechts']];
  return (
    <div className="inline-flex rounded-md border border-line bg-white p-0.5" role="radiogroup" aria-label="Uitlijning">
      {opties.map(([u, l]) => (
        <button
          key={u}
          type="button"
          role="radio"
          aria-checked={waarde === u}
          onClick={() => zet(u)}
          className={`rounded px-2.5 py-1 text-[12px] font-semibold ${waarde === u ? 'bg-ink-900 text-white' : 'text-ink-700 hover:bg-mist'}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function Schakel({ aan, zet, label }: { aan: boolean; zet: (b: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-800">
      <input type="checkbox" checked={aan} onChange={(e) => zet(e.target.checked)} className="h-4 w-4 accent-amber-500" />
      {label}
    </label>
  );
}

function Kleur({ waarde, zet, label, leegLabel }: { waarde: string; zet: (k: string) => void; label: string; leegLabel?: string }) {
  return (
    <div>
      <span className="veld-label">{label}</span>
      <div className="flex items-center gap-2">
        <input type="color" value={waarde || '#1c1c1c'} onChange={(e) => zet(e.target.value)} aria-label={label} className="h-8 w-12 cursor-pointer rounded border border-line" />
        <code className="text-[12px] text-warm">{waarde || leegLabel || ''}</code>
        {leegLabel && waarde && (
          <button type="button" onClick={() => zet('')} className="knop-tekst px-1.5 py-0.5 text-[12px]">
            {leegLabel}
          </button>
        )}
      </div>
    </div>
  );
}

/** Tekstvak met knoppen die een veld invoegen op de plek van de cursor. */
function TekstMetVelden({ waarde, zet, rijen = 8, label, hint }: { waarde: string; zet: (t: string) => void; rijen?: number; label: string; hint?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const voegIn = (tag: string) => {
    const el = ref.current;
    if (!el) return zet(waarde + tag);
    const van = el.selectionStart ?? waarde.length;
    const tot = el.selectionEnd ?? waarde.length;
    zet(waarde.slice(0, van) + tag + waarde.slice(tot));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(van + tag.length, van + tag.length);
    });
  };
  const onbekend = onbekendeVelden(waarde);
  return (
    <div>
      <span className="veld-label">{label}</span>
      <textarea ref={ref} value={waarde} onChange={(e) => zet(e.target.value)} rows={rijen} className="veld text-[13px] leading-relaxed" aria-label={label} />
      <div className="mt-1 flex flex-wrap gap-1">
        {BRIEF_VELDEN.map((v) => (
          <button key={v.tag} type="button" onClick={() => voegIn(v.tag)} title={v.uitleg} className="rounded border border-line bg-mist px-1.5 py-0.5 font-mono text-[11px] text-ink-700 hover:border-ink-300">
            {v.tag}
          </button>
        ))}
      </div>
      {onbekend.length > 0 && <p className="veld-hint text-red-700">Onbekend veld, wordt niet ingevuld: {onbekend.join(', ')}</p>}
      {hint && <p className="veld-hint">{hint}</p>}
    </div>
  );
}

const ic = 'h-4 w-4';
const IcoonOp = () => (<svg viewBox="0 0 16 16" className={ic} aria-hidden="true"><path d="M4 10l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoonNeer = () => (<svg viewBox="0 0 16 16" className={ic} aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const IcoonKopie = () => (<svg viewBox="0 0 16 16" className={ic} aria-hidden="true"><rect x="5" y="5" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M3 10.5V4a1 1 0 011-1h6.5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>);
const IcoonWeg = () => (<svg viewBox="0 0 16 16" className={ic} aria-hidden="true"><path d="M3.5 4.5h9M6.5 4.5V3h3v1.5M5 4.5l.6 8.5h4.8l.6-8.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>);

function samenvatting(b: BriefBlok): string {
  const kort = (t: string) => (t.replace(/\s+/g, ' ').trim().slice(0, 46) || '(leeg)') + (t.trim().length > 46 ? '…' : '');
  switch (b.type) {
    case 'betreft': return kort(b.betreft || b.plaatsDatum);
    case 'kop': return kort(b.tekst);
    case 'tekst': return kort(b.tekst);
    case 'logo': return `${b.hoogte} mm hoog`;
    case 'afbeelding': return b.src ? kort(b.alt || b.src) : 'nog geen afbeelding';
    case 'mockups': return `${b.aantal} artikelen, ${b.grootte} mm`;
    case 'qr': return `${b.grootte} mm${b.kledingErnaast ? `, ${b.kledingErnaast} artikelen ernaast` : ''}`;
    case 'handtekening': return kort(b.naam);
    case 'voettekst': return kort(b.tekst);
    case 'lijn': return `${b.dikte} pt`;
    case 'ruimte': return b.vul ? 'vult de vrije ruimte' : `${b.hoogte} mm`;
  }
}

/* ------------------------------------------------------------------ */
/* Velden per bloktype                                                  */
/* ------------------------------------------------------------------ */

function BlokVelden({ b, zet }: { b: BriefBlok; zet: (patch: Partial<BriefBlok>, sleutel?: string) => void }) {
  const k = (veld: string) => `${b.id}:${veld}`;
  const ruimte = (
    <Getal label="Ruimte erboven" waarde={b.boven} min={0} max={30} stap={0.5} eenheid="mm" zet={(n) => zet({ boven: n }, k('boven'))} />
  );
  switch (b.type) {
    case 'betreft':
      return (
        <div className="space-y-3">
          <TekstMetVelden label="Plaats en datum" rijen={1} waarde={b.plaatsDatum} zet={(t) => zet({ plaatsDatum: t }, k('pd'))} />
          <TekstMetVelden label="Betreft-regel (vet)" rijen={1} waarde={b.betreft} zet={(t) => zet({ betreft: t }, k('bt'))} hint="Leeg laten = niet tonen." />
          {ruimte}
        </div>
      );
    case 'kop':
      return (
        <div className="space-y-3">
          <TekstMetVelden label="Kop" rijen={2} waarde={b.tekst} zet={(t) => zet({ tekst: t }, k('t'))} />
          <Getal label="Grootte" waarde={b.grootte} min={9} max={32} stap={0.5} eenheid="pt" zet={(n) => zet({ grootte: n }, k('g'))} />
          <div className="flex flex-wrap items-end gap-4">
            <Rij label="Uitlijning"><UitlijnKeuze waarde={b.uitlijning} zet={(u) => zet({ uitlijning: u })} /></Rij>
            <Schakel label="Als balk in de accentkleur" aan={b.balk} zet={(v) => zet({ balk: v })} />
          </div>
          {!b.balk && <Kleur label="Kleur" waarde={b.kleur} zet={(c) => zet({ kleur: c }, k('c'))} leegLabel="tekstkleur" />}
          {ruimte}
        </div>
      );
    case 'tekst':
      return (
        <div className="space-y-3">
          <TekstMetVelden
            label="Tekst"
            rijen={12}
            waarde={b.tekst}
            zet={(t) => zet({ tekst: t }, k('t'))}
            hint="Lege regel = nieuwe alinea. **woord** wordt vet. Zonder contactpersoon wordt 'Beste {{contactpersoon}},' vanzelf 'Geachte directie,'."
          />
          <div className="flex flex-wrap items-end gap-4">
            <Rij label="Uitlijning"><UitlijnKeuze waarde={b.uitlijning} zet={(u) => zet({ uitlijning: u })} /></Rij>
            <Schakel label="Eigen lettergrootte" aan={b.grootte !== null} zet={(v) => zet({ grootte: v ? 10.5 : null })} />
          </div>
          {b.grootte !== null && <Getal label="Lettergrootte" waarde={b.grootte} min={7} max={16} stap={0.5} eenheid="pt" zet={(n) => zet({ grootte: n }, k('g'))} />}
          {ruimte}
        </div>
      );
    case 'logo':
      return (
        <div className="space-y-3">
          <Getal label="Hoogte" waarde={b.hoogte} min={6} max={40} eenheid="mm" zet={(n) => zet({ hoogte: n }, k('h'))} />
          <Rij label="Uitlijning"><UitlijnKeuze waarde={b.uitlijning} zet={(u) => zet({ uitlijning: u })} /></Rij>
          {ruimte}
        </div>
      );
    case 'afbeelding':
      return (
        <div className="space-y-3">
          <Rij label="Afbeelding (url)" hint="Een https-link of een pad op de site, zoals /fotos/winkel.jpg.">
            <input value={b.src} onChange={(e) => zet({ src: e.target.value }, k('src'))} className="veld text-[13px]" placeholder="https://..." />
          </Rij>
          <Rij label="Omschrijving"><input value={b.alt} onChange={(e) => zet({ alt: e.target.value }, k('alt'))} className="veld text-[13px]" /></Rij>
          <Rij label="Onderschrift"><input value={b.onderschrift} onChange={(e) => zet({ onderschrift: e.target.value }, k('os'))} className="veld text-[13px]" /></Rij>
          <Getal label="Hoogte" waarde={b.hoogte} min={10} max={150} eenheid="mm" zet={(n) => zet({ hoogte: n }, k('h'))} />
          <Rij label="Uitlijning"><UitlijnKeuze waarde={b.uitlijning} zet={(u) => zet({ uitlijning: u })} /></Rij>
          {ruimte}
        </div>
      );
    case 'mockups':
      return (
        <div className="space-y-3">
          <p className="text-[12px] text-warm">De artikelen komen per prospect uit &quot;Kleding op de pagina&quot;, met hun eigen logo erop. Zonder logo staat de bedrijfsnaam er netjes op.</p>
          <Getal label="Aantal artikelen" waarde={b.aantal} min={1} max={4} eenheid="st" zet={(n) => zet({ aantal: n })} />
          <Getal label="Grootte per foto" waarde={b.grootte} min={20} max={80} eenheid="mm" zet={(n) => zet({ grootte: n }, k('g'))} />
          <div className="flex flex-wrap items-end gap-4">
            <Rij label="Uitlijning"><UitlijnKeuze waarde={b.uitlijning} zet={(u) => zet({ uitlijning: u })} /></Rij>
            <Schakel label="Namen onder de foto's" aan={b.namen} zet={(v) => zet({ namen: v })} />
          </div>
          {ruimte}
        </div>
      );
    case 'qr':
      return (
        <div className="space-y-3">
          <p className="text-[12px] text-warm">Elke brief krijgt zijn eigen QR-code naar de persoonlijke pagina. Scans worden per prospect geteld.</p>
          <TekstMetVelden label="Kop bij de code" rijen={1} waarde={b.kop} zet={(t) => zet({ kop: t }, k('kop'))} />
          <TekstMetVelden label="Uitleg" rijen={2} waarde={b.tekst} zet={(t) => zet({ tekst: t }, k('t'))} />
          <Getal label="Grootte QR-code" waarde={b.grootte} min={20} max={60} eenheid="mm" zet={(n) => zet({ grootte: n }, k('g'))} />
          {b.grootte < 24 && <p className="veld-hint text-amber-800">Onder 24 mm scant niet elke telefoon even makkelijk.</p>}
          <Getal label="Kleding ernaast" waarde={b.kledingErnaast} min={0} max={3} eenheid="st" zet={(n) => zet({ kledingErnaast: n })} />
          <div className="flex flex-wrap items-end gap-4">
            {b.kledingErnaast === 0 && <Rij label="Uitlijning"><UitlijnKeuze waarde={b.uitlijning} zet={(u) => zet({ uitlijning: u })} /></Rij>}
            <Schakel label="Korte link tonen" aan={b.toonUrl} zet={(v) => zet({ toonUrl: v })} />
            <Schakel label="Kader" aan={b.kader} zet={(v) => zet({ kader: v })} />
          </div>
          {ruimte}
        </div>
      );
    case 'handtekening':
      return (
        <div className="space-y-3">
          <Rij label="Groet"><input value={b.groet} onChange={(e) => zet({ groet: e.target.value }, k('g'))} className="veld text-[13px]" /></Rij>
          <Rij label="Naam"><input value={b.naam} onChange={(e) => zet({ naam: e.target.value }, k('n'))} className="veld text-[13px]" /></Rij>
          <Rij label="Regel eronder"><input value={b.functie} onChange={(e) => zet({ functie: e.target.value }, k('f'))} className="veld text-[13px]" /></Rij>
          <Rij label="Handtekening">
            <select value={b.stijl} onChange={(e) => zet({ stijl: e.target.value as 'script' | 'afbeelding' | 'geen' })} className="veld text-[13px]">
              <option value="script">Voornaam in handschriftletter</option>
              <option value="afbeelding">Gescande handtekening (afbeelding)</option>
              <option value="geen">Geen, alleen de naam</option>
            </select>
          </Rij>
          {b.stijl === 'afbeelding' && (
            <Rij label="Afbeelding van de handtekening (url)" hint="Liefst een png met transparante achtergrond.">
              <input value={b.afbeelding} onChange={(e) => zet({ afbeelding: e.target.value }, k('a'))} className="veld text-[13px]" placeholder="https://..." />
            </Rij>
          )}
          {ruimte}
        </div>
      );
    case 'voettekst':
      return (
        <div className="space-y-3">
          <TekstMetVelden label="Voettekst" rijen={3} waarde={b.tekst} zet={(t) => zet({ tekst: t }, k('t'))} />
          <Getal label="Grootte" waarde={b.grootte} min={6} max={10} stap={0.5} eenheid="pt" zet={(n) => zet({ grootte: n }, k('g'))} />
          <Rij label="Uitlijning"><UitlijnKeuze waarde={b.uitlijning} zet={(u) => zet({ uitlijning: u })} /></Rij>
          {ruimte}
        </div>
      );
    case 'lijn':
      return (
        <div className="space-y-3">
          <Getal label="Dikte" waarde={b.dikte} min={0.25} max={3} stap={0.25} eenheid="pt" zet={(n) => zet({ dikte: n }, k('d'))} />
          <Kleur label="Kleur" waarde={b.kleur} zet={(c) => zet({ kleur: c }, k('c'))} leegLabel="lichtgrijs" />
          {ruimte}
        </div>
      );
    case 'ruimte':
      return (
        <div className="space-y-3">
          <Schakel label="Vul de vrije ruimte (alles hieronder gaat naar de onderkant)" aan={b.vul} zet={(v) => zet({ vul: v })} />
          {!b.vul && <Getal label="Hoogte" waarde={b.hoogte} min={1} max={120} eenheid="mm" zet={(n) => zet({ hoogte: n }, k('h'))} />}
        </div>
      );
  }
}

/* ------------------------------------------------------------------ */
/* Editor                                                              */
/* ------------------------------------------------------------------ */

type Opslag = { soort: 'opgeslagen'; om: string | null } | { soort: 'gewijzigd' } | { soort: 'bezig' } | { soort: 'fout'; melding: string };

const A4_PX = { b: (210 * 96) / 25.4, h: (297 * 96) / 25.4 };

export default function BriefEditor({
  batchId,
  beginOntwerp,
  personen,
  eigenTemplates: beginTemplates,
  templatesActief,
  datum,
  volgendeHref,
}: {
  batchId: string;
  beginOntwerp: BriefOntwerp;
  personen: BriefPersoon[];
  eigenTemplates: EditorTemplate[];
  templatesActief: boolean;
  datum: string;
  volgendeHref: string;
}) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({ ontwerp: beginOntwerp, verleden: [], toekomst: [], versie: 0, sleutel: null, tijd: 0 }));
  const [tab, setTab] = useState<'blokken' | 'opmaak' | 'templates'>('blokken');
  const [selectie, setSelectie] = useState<string | null>(null);
  const [voorbeeld, setVoorbeeld] = useState(0);
  const [opslag, setOpslag] = useState<Opslag>({ soort: 'opgeslagen', om: null });
  const [teLang, setTeLang] = useState<TeLang[] | null>(null);
  const [templates, setTemplates] = useState(beginTemplates);
  const [templateNaam, setTemplateNaam] = useState('');
  const [templateMelding, setTemplateMelding] = useState<string | null>(null);
  const [schaal, setSchaal] = useState(0.6);

  const o = state.ontwerp;
  const persoon = personen[Math.min(voorbeeld, personen.length - 1)];
  const stateRef = useRef(state);
  stateRef.current = state;
  const opgeslagen = useRef(0);
  const bezig = useRef(false);
  const meetBak = useRef<HTMLDivElement>(null);
  const voorbeeldBak = useRef<HTMLDivElement>(null);

  /* Opslaan. Geeft terug of alles nu is opgeslagen. */
  const opslaan = useCallback(async (): Promise<boolean> => {
    // Loopt er al een opslag, wacht die af (max. 8 s) en sla daarna de nieuwste stand op.
    for (let i = 0; bezig.current && i < 80; i++) await new Promise((r) => setTimeout(r, 100));
    if (bezig.current) return false;
    const { ontwerp, versie } = stateRef.current;
    if (versie === opgeslagen.current) return true;
    bezig.current = true;
    setOpslag({ soort: 'bezig' });
    try {
      const uit = await slaBatchOntwerpOpActie(batchId, ontwerp);
      if (uit.ok) {
        opgeslagen.current = versie;
        setOpslag(stateRef.current.versie === versie ? { soort: 'opgeslagen', om: uit.om } : { soort: 'gewijzigd' });
        return true;
      }
      setOpslag({ soort: 'fout', melding: uit.fout });
      return false;
    } catch {
      setOpslag({ soort: 'fout', melding: 'Opslaan is mislukt. Controleer de internetverbinding en klik op Opslaan.' });
      return false;
    } finally {
      bezig.current = false;
    }
  }, [batchId]);

  const router = useRouter();
  const [naarVolgende, setNaarVolgende] = useState(false);
  const verder = async () => {
    setNaarVolgende(true);
    const ok = await opslaan();
    if (ok) router.push(volgendeHref);
    else setNaarVolgende(false);
  };

  useEffect(() => {
    if (state.versie === opgeslagen.current) return;
    setOpslag((s) => (s.soort === 'bezig' ? s : { soort: 'gewijzigd' }));
    const t = setTimeout(() => void opslaan(), 1500);
    return () => clearTimeout(t);
  }, [state.versie, opslaan]);

  useEffect(() => {
    const weg = (e: BeforeUnloadEvent) => {
      if (stateRef.current.versie !== opgeslagen.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', weg);
    return () => window.removeEventListener('beforeunload', weg);
  }, []);

  // Weg via de stappenbalk of het menu: wat nog openstaat meteen opslaan.
  useEffect(
    () => () => {
      if (stateRef.current.versie !== opgeslagen.current) void slaBatchOntwerpOpActie(batchId, stateRef.current.ontwerp).catch(() => undefined);
    },
    [batchId],
  );

  /* Toetsen: ongedaan maken en opslaan */
  useEffect(() => {
    const toets = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 's') {
        e.preventDefault();
        void opslaan();
        return;
      }
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if (mod && k === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'ongedaan' });
      } else if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) {
        e.preventDefault();
        dispatch({ type: 'opnieuw' });
      }
    };
    window.addEventListener('keydown', toets);
    return () => window.removeEventListener('keydown', toets);
  }, [opslaan]);

  /* Meten: past elk voorbeeld op één A4? */
  useEffect(() => {
    const el = meetBak.current;
    if (!el) return;
    let stop = false;
    const meet = () => {
      if (!stop) setTeLang(meetBrieven(el));
    };
    const r = requestAnimationFrame(meet);
    void document.fonts?.ready.then(meet);
    const t = setTimeout(meet, 600);
    return () => {
      stop = true;
      cancelAnimationFrame(r);
      clearTimeout(t);
    };
  }, [o]);

  /* Schaal van het voorbeeld: zo breed als er plek is */
  useEffect(() => {
    const el = voorbeeldBak.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSchaal(Math.max(0.3, Math.min(1, (e.contentRect.width - 8) / A4_PX.b))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const zetBlok = useCallback((id: string) => (patch: Partial<BriefBlok>, sleutel?: string) => dispatch({ type: 'blok', id, patch, sleutel }), []);
  const kies = useCallback((id: string) => {
    setSelectie(id);
    setTab('blokken');
    requestAnimationFrame(() => document.getElementById(`blok-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }, []);

  const voegToe = (type: BriefBlokType) => {
    const id = briefId();
    dispatch({ type: 'toevoegen', blokType: type, na: selectie, id });
    setSelectie(id);
  };

  const gebruikTemplate = async (maak: () => BriefOntwerp, naam: string) => {
    if (state.verleden.length > 0 && !(await bevestig({ titel: `De brief vervangen door het template "${naam}"?`, tekst: 'Met Ongedaan maken kun je terug.', bevestigLabel: 'Vervangen' }))) return;
    dispatch({ type: 'vervang', ontwerp: kopieerOntwerp(maak()) });
    setSelectie(null);
    setTab('blokken');
  };

  const bewaarTemplate = async () => {
    setTemplateMelding(null);
    const uit = await bewaarTemplateActie(templateNaam, o);
    if (uit.ok) {
      setTemplates((l) => [...l, { id: uit.id, naam: templateNaam.trim(), omschrijving: null, ontwerp: kopieerOntwerp(o) }].sort((a, b) => a.naam.localeCompare(b.naam, 'nl')));
      setTemplateNaam('');
      setTemplateMelding('Bewaard. Je vindt het hieronder bij Eigen templates.');
    } else setTemplateMelding(uit.fout);
  };

  const verwijderTemplate = async (t: EditorTemplate) => {
    if (!(await bevestig({ titel: `Template "${t.naam}" verwijderen?`, tekst: 'Verzendingen die het al gebruiken houden hun brief.', bevestigLabel: 'Verwijderen', gevaar: true }))) return;
    const uit = await verwijderTemplateActie(t.id);
    if (uit.ok) setTemplates((l) => l.filter((x) => x.id !== t.id));
    else setTemplateMelding(uit.fout);
  };

  const huidigTeLang = teLang?.find((t) => t.id === persoon.id) ?? null;
  const maxTeLang = teLang?.reduce((m, t) => Math.max(m, t.mm), 0) ?? 0;
  const ruimte = useMemo(() => inhoudHoogte(o.instellingen), [o.instellingen]);

  const opslagTekst =
    opslag.soort === 'bezig' ? 'Bezig met opslaan…' : opslag.soort === 'gewijzigd' ? 'Nog niet opgeslagen' : opslag.soort === 'fout' ? 'Niet opgeslagen' : opslag.om ? `Opgeslagen om ${new Date(opslag.om).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}` : 'Opgeslagen';

  const tabKnop = (t: typeof tab, l: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === t}
      onClick={() => setTab(t)}
      className={`-mb-px border-b-2 px-3 py-2 text-[13px] font-semibold ${tab === t ? 'border-amber-500 text-ink-900' : 'border-transparent text-warm hover:text-ink-900'}`}
    >
      {l}
    </button>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      {/* Werkbalk */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => dispatch({ type: 'ongedaan' })} disabled={state.verleden.length === 0} className="knop-stil h-8 px-2.5 text-[13px] disabled:opacity-40" title="Ongedaan maken (Ctrl+Z)">
            Ongedaan maken
          </button>
          <button type="button" onClick={() => dispatch({ type: 'opnieuw' })} disabled={state.toekomst.length === 0} className="knop-stil h-8 px-2.5 text-[13px] disabled:opacity-40" title="Opnieuw (Ctrl+Y)">
            Opnieuw
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span role="status" className={`text-[13px] font-semibold ${opslag.soort === 'fout' ? 'text-red-700' : opslag.soort === 'opgeslagen' ? 'text-green-700' : 'text-amber-700'}`}>
            {opslagTekst}
          </span>
          <button type="button" onClick={() => void opslaan()} className="knop-stil h-8 px-3 text-[13px]" title="Opslaan (Ctrl+S)">
            Opslaan
          </button>
          <button type="button" onClick={() => void verder()} disabled={naarVolgende} className="knop-primair h-8 px-3 text-[13px] disabled:opacity-70">
            {naarVolgende ? 'Opslaan…' : 'Verder: controleren'}
          </button>
        </div>
      </div>
      {opslag.soort === 'fout' && <p role="alert" className="border-b border-red-200 bg-red-50 px-4 py-2 text-[13px] font-semibold text-red-700">{opslag.melding}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-[400px_minmax(0,1fr)]">
        {/* Paneel */}
        <div className="min-w-0 border-b border-line lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div role="tablist" className="sticky top-0 z-10 flex gap-1 border-b border-line bg-white px-2">
            {tabKnop('blokken', `Blokken (${o.blokken.length})`)}
            {tabKnop('opmaak', 'Opmaak')}
            {tabKnop('templates', 'Templates')}
          </div>

          {tab === 'blokken' && (
            <div className="p-3">
              {o.blokken.length === 0 && <p className="rounded-md border border-dashed border-line bg-mist px-3 py-6 text-center text-[13px] text-warm">Nog geen blokken. Kies hieronder een blok of begin met een template.</p>}
              <ol className="space-y-1.5">
                {o.blokken.map((b, i) => {
                  const actief = selectie === b.id;
                  const label = BRIEF_BLOKTYPEN.find((t) => t.type === b.type)?.label ?? b.type;
                  return (
                    <li key={b.id} id={`blok-${b.id}`} className={`rounded-md border ${actief ? 'border-amber-500 bg-white shadow-sm' : 'border-line bg-white'}`}>
                      <div className="flex items-center gap-1 pr-1">
                        <button type="button" onClick={() => setSelectie(actief ? null : b.id)} aria-expanded={actief} className="flex min-w-0 grow items-center gap-2 px-2.5 py-2 text-left">
                          <span className="w-5 shrink-0 text-[11px] tabular-nums text-ink-400">{i + 1}</span>
                          <span className="min-w-0">
                            <span className="block text-[13px] font-semibold text-ink-900">{label}</span>
                            <span className="block truncate text-[12px] text-warm">{samenvatting(b)}</span>
                          </span>
                        </button>
                        <button type="button" onClick={() => dispatch({ type: 'verplaats', id: b.id, richting: -1 })} disabled={i === 0} className="rounded p-1 text-ink-600 hover:bg-mist disabled:opacity-30" aria-label={`${label} omhoog`} title="Omhoog"><IcoonOp /></button>
                        <button type="button" onClick={() => dispatch({ type: 'verplaats', id: b.id, richting: 1 })} disabled={i === o.blokken.length - 1} className="rounded p-1 text-ink-600 hover:bg-mist disabled:opacity-30" aria-label={`${label} omlaag`} title="Omlaag"><IcoonNeer /></button>
                        <button type="button" onClick={() => { const id = briefId(); dispatch({ type: 'dupliceer', id: b.id, nieuwId: id }); setSelectie(id); }} className="rounded p-1 text-ink-600 hover:bg-mist" aria-label={`${label} dupliceren`} title="Dupliceren"><IcoonKopie /></button>
                        <button type="button" onClick={() => { dispatch({ type: 'verwijder', id: b.id }); if (actief) setSelectie(null); }} className="rounded p-1 text-red-700 hover:bg-red-50" aria-label={`${label} verwijderen`} title="Verwijderen"><IcoonWeg /></button>
                      </div>
                      {actief && (
                        <div className="border-t border-line px-3 py-3">
                          <BlokVelden b={b} zet={zetBlok(b.id)} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>

              <div className="mt-4">
                <p className="veld-label">Blok toevoegen {selectie ? '(onder het gekozen blok)' : '(onderaan)'}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {BRIEF_BLOKTYPEN.map((t) => (
                    <button key={t.type} type="button" onClick={() => voegToe(t.type)} title={t.uitleg} className="rounded-md border border-line bg-white px-2.5 py-2 text-left text-[12px] hover:border-ink-300 hover:bg-mist">
                      <span className="block font-semibold text-ink-900">{t.label}</span>
                      <span className="line-clamp-2 block text-[11px] leading-snug text-warm">{t.uitleg}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'opmaak' && (
            <div className="space-y-4 p-3">
              <Rij label="Briefhoofd" hint="Venster: adres links op de plek van het venster van een DL- of C5-envelop.">
                <div className="space-y-1.5">
                  {([
                    ['venster', 'Met adres voor venster-envelop'],
                    ['compact', 'Smal briefhoofd, zonder adres (zelf afgeven)'],
                    ['geen', 'Geen briefhoofd'],
                  ] as const).map(([w, l]) => (
                    <label key={w} className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-800">
                      <input type="radio" name="briefhoofd" checked={o.instellingen.briefhoofd === w} onChange={() => dispatch({ type: 'instellingen', patch: { briefhoofd: w } })} className="h-4 w-4 accent-amber-500" />
                      {l}
                    </label>
                  ))}
                </div>
              </Rij>
              <Schakel label="Donkere voetbalk met contactgegevens" aan={o.instellingen.voetbalk} zet={(v) => dispatch({ type: 'instellingen', patch: { voetbalk: v } })} />
              <Rij label="Lettertype">
                <select value={o.instellingen.lettertype} onChange={(e) => dispatch({ type: 'instellingen', patch: { lettertype: e.target.value as BriefInstellingen['lettertype'] } })} className="veld text-[13px]">
                  {Object.entries(BRIEF_LETTERTYPEN).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </Rij>
              <Getal label="Lettergrootte" waarde={o.instellingen.lettergrootte} min={9} max={12} stap={0.5} eenheid="pt" zet={(n) => dispatch({ type: 'instellingen', patch: { lettergrootte: n }, sleutel: 'lg' })} />
              <Getal label="Marge links en rechts" waarde={o.instellingen.marge} min={15} max={25} eenheid="mm" zet={(n) => dispatch({ type: 'instellingen', patch: { marge: n }, sleutel: 'mg' })} />
              <div className="grid grid-cols-2 gap-3">
                <Kleur label="Tekstkleur" waarde={o.instellingen.tekstkleur} zet={(c) => dispatch({ type: 'instellingen', patch: { tekstkleur: c || '#2a2928' }, sleutel: 'tk' })} />
                <Kleur label="Accentkleur" waarde={o.instellingen.accent} zet={(c) => dispatch({ type: 'instellingen', patch: { accent: c || '#1c1c1c' }, sleutel: 'ac' })} />
              </div>
              <p className="text-[12px] text-warm">Ruimte voor de blokken met deze instellingen: {ruimte} mm hoog.</p>
            </div>
          )}

          {tab === 'templates' && (
            <div className="space-y-4 p-3">
              <div>
                <p className="veld-label">Ingebouwd</p>
                <ul className="space-y-1.5">
                  {INGEBOUWDE_TEMPLATES.map((t) => (
                    <li key={t.sleutel} className="flex items-start justify-between gap-2 rounded-md border border-line p-2.5">
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold text-ink-900">{t.naam}</span>
                        <span className="block text-[12px] leading-snug text-warm">{t.omschrijving}</span>
                      </span>
                      <button type="button" onClick={() => gebruikTemplate(t.maak, t.naam)} className="knop-stil shrink-0 px-2.5 py-1 text-[12px]">Gebruiken</button>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="veld-label">Eigen templates</p>
                {!templatesActief ? (
                  <p className="text-[12px] text-warm">Eigen templates bewaren kan zodra de migratie voor verzendingen gedraaid is.</p>
                ) : templates.length === 0 ? (
                  <p className="text-[12px] text-warm">Nog geen eigen templates. Bewaar deze brief hieronder als template om hem later opnieuw te gebruiken.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {templates.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-2 rounded-md border border-line p-2.5">
                        <span className="min-w-0 truncate text-[13px] font-semibold text-ink-900">{t.naam}</span>
                        <span className="flex shrink-0 gap-1">
                          <button type="button" onClick={() => gebruikTemplate(() => t.ontwerp, t.naam)} className="knop-stil px-2.5 py-1 text-[12px]">Gebruiken</button>
                          <button type="button" onClick={() => void verwijderTemplate(t)} className="knop-tekst px-2 py-1 text-[12px] text-red-700">Verwijderen</button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {templatesActief && (
                <form
                  className="rounded-md border border-line bg-mist p-2.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void bewaarTemplate();
                  }}
                >
                  <label className="veld-label" htmlFor="tpl-naam">Deze brief bewaren als template</label>
                  <div className="flex gap-2">
                    <input id="tpl-naam" value={templateNaam} onChange={(e) => setTemplateNaam(e.target.value)} placeholder="Bijv. Bouw najaar" className="veld text-[13px]" maxLength={80} />
                    <button type="submit" disabled={!templateNaam.trim()} className="knop-donker shrink-0 px-3 text-[13px] disabled:opacity-50">Bewaren</button>
                  </div>
                </form>
              )}
              {templateMelding && <p className="text-[12px] text-ink-800" role="status">{templateMelding}</p>}
            </div>
          )}
        </div>

        {/* Voorbeeld */}
        <div className="min-w-0 bg-mist">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-white px-4 py-2">
            <label className="flex items-center gap-2 text-[13px] text-ink-800">
              <span className="text-warm">Voorbeeld voor</span>
              <select value={voorbeeld} onChange={(e) => setVoorbeeld(Number(e.target.value))} className="veld w-auto py-1 text-[13px]">
                {personen.map((p, i) => (
                  <option key={p.id} value={i}>
                    {p.bedrijfsnaam}{teLang?.some((t) => t.id === p.id) ? ' (te lang)' : ''}
                  </option>
                ))}
              </select>
            </label>
            {teLang === null ? (
              <span className="text-[12px] text-warm">Meten…</span>
            ) : teLang.length === 0 ? (
              <span className="badge-klaar">Past op één A4{personen.length > 1 ? ` bij alle ${personen.length} voorbeelden` : ''}</span>
            ) : (
              <span className="badge bg-red-50 text-red-700" role="alert">
                Te lang bij {teLang.length} van {personen.length}, tot {maxTeLang} mm
              </span>
            )}
          </div>
          {huidigTeLang && (
            <p className="border-b border-red-200 bg-red-50 px-4 py-2 text-[13px] text-red-800">
              Deze brief loopt {huidigTeLang.mm} mm over de onderrand. Haal een alinea weg, maak de kleding of de QR-code kleiner, of zet de lettergrootte bij Opmaak een halve punt lager.
            </p>
          )}
          <div ref={voorbeeldBak} className="p-4 lg:max-h-[calc(100vh-15rem)] lg:overflow-auto" onClick={() => setSelectie(null)}>
            <div className="mx-auto" style={{ width: A4_PX.b * schaal, height: A4_PX.h * schaal }}>
              <div style={{ transform: `scale(${schaal})`, transformOrigin: 'top left', width: '210mm' }}>
                <BriefPagina ontwerp={o} persoon={persoon} datum={datum} interactief={{ geselecteerd: selectie, kies, zones: true }} />
              </div>
            </div>
            <p className="mt-3 text-center text-[12px] text-warm">Klik op een blok in de brief om het te bewerken. De oranje stippellijn is het adresvenster.</p>
          </div>
        </div>
      </div>

      {/* Onzichtbaar: alle voorbeelden op ware grootte, om te meten. */}
      <div ref={meetBak} aria-hidden="true" className="pointer-events-none fixed left-[-12000px] top-0 opacity-0">
        {personen.map((p) => (
          <BriefPagina key={p.id} ontwerp={o} persoon={p} datum={datum} />
        ))}
      </div>
    </div>
  );
}
