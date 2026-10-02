'use client';

/**
 * Tekst direct in de nieuwsbrief typen (contentEditable) met een zwevende
 * werkbalk: vet, cursief, onderstreept, link, opsommingen, tekstkleur en
 * persoonlijke velden zoals {{naam}}.
 *
 * Veiligheid: alles wat in de state komt gaat eerst door sanitizeHtml() uit
 * lib/nieuwsbrief/sanitize.ts (dezelfde allowlist als bij het versturen). Bij
 * het verlaten van het tekstvak wordt ook de DOM zelf vervangen door de
 * opgeschoonde versie. Plakken gaat altijd via de sanitizer.
 */
import { memo, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type Dispatch, type MouseEvent } from 'react';
import { escapeHtml, sanitizeHtml } from '@/lib/nieuwsbrief/sanitize';
import { HUISSTIJL, MERGE_TAGS } from '@/lib/nieuwsbrief/types';
import { IcoonGenummerd, IcoonLijst, IcoonLink } from './iconen';
import type { Actie } from './state';

/* execCommand is officieel verouderd, maar nog steeds de enige manier om in
 * alle browsers opmaak toe te passen mét de ingebouwde ongedaan-maken van het
 * tekstvak. We gebruiken het alleen voor eenvoudige opmaak. */
function cmd(naam: string, waarde?: string) {
  try {
    document.execCommand(naam, false, waarde);
  } catch {
    /* niet ondersteund: niets doen */
  }
}

/** Maak van wat Jessi intypt een bruikbare link. */
export function maakLink(ruw: string): string {
  const s = ruw.trim();
  if (!s) return '';
  if (/^(https?:\/\/|mailto:)/i.test(s)) return s;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return `mailto:${s}`;
  if (s.startsWith('/')) return `https://www.frederiksbedrijfskleding.nl${s}`;
  return `https://${s.replace(/^\/+/, '')}`;
}

/** useLayoutEffect in de browser, useEffect op de server (geen waarschuwing bij server-rendering). */
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const KLEUREN = [HUISSTIJL.charcoal, HUISSTIJL.tekst, HUISSTIJL.oranje, HUISSTIJL.grijs, HUISSTIJL.wit];

type Props = {
  blokId: string;
  html: string;
  dispatch: Dispatch<Actie>;
  style: CSSProperties;
};

function TekstBewerkerBasis({ blokId, html, dispatch, style }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  // De begintekst (opgeschoond) gaat één keer mee in de HTML. Daarna beheren
  // we de inhoud zelf; React raakt hem niet meer aan zolang deze string gelijk blijft.
  const [begin] = useState(() => ({ __html: sanitizeHtml(html) }));
  const laatste = useRef<string | null>(html);
  const bewaardBereik = useRef<Range | null>(null);
  const [actief, setActief] = useState(false);
  const [paneel, setPaneel] = useState<null | 'link' | 'kleur' | 'velden'>(null);
  const [linkWaarde, setLinkWaarde] = useState('');

  // De DOM alleen overschrijven als de tekst van buitenaf verandert (ongedaan
  // maken, laden), niet bij eigen typen: dan zou de cursor verspringen.
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el || html === laatste.current) return;
    el.innerHTML = sanitizeHtml(html);
    laatste.current = html;
  }, [html]);

  const sync = () => {
    const el = ref.current;
    if (!el) return;
    const schoon = sanitizeHtml(el.innerHTML);
    if (schoon === laatste.current) return;
    laatste.current = schoon;
    dispatch({ type: 'blokWijzigen', blokId, patch: { html: schoon }, sleutel: `${blokId}:html`, tijd: Date.now() });
  };

  const opschonen = () => {
    const el = ref.current;
    if (!el) return;
    const schoon = sanitizeHtml(el.innerHTML);
    if (el.innerHTML !== schoon) el.innerHTML = schoon;
    if (schoon !== laatste.current) {
      laatste.current = schoon;
      dispatch({ type: 'blokWijzigen', blokId, patch: { html: schoon } });
    }
  };

  const bewaarBereik = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && ref.current?.contains(sel.anchorNode)) bewaardBereik.current = sel.getRangeAt(0).cloneRange();
  };

  const herstelBereik = () => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const r = bewaardBereik.current;
    if (r) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(r);
    }
  };

  const doe = (naam: string, waarde?: string) => {
    cmd('styleWithCSS', 'false');
    cmd(naam, waarde);
    sync();
  };

  const openLink = () => {
    bewaarBereik();
    const sel = window.getSelection();
    const a = sel?.anchorNode instanceof Element ? sel.anchorNode.closest('a') : sel?.anchorNode?.parentElement?.closest('a');
    setLinkWaarde(a?.getAttribute('href') ?? '');
    setPaneel('link');
  };

  const zetLink = () => {
    herstelBereik();
    const url = maakLink(linkWaarde);
    const sel = window.getSelection();
    if (!url) {
      cmd('unlink');
    } else if (sel && sel.isCollapsed) {
      cmd('insertHTML', `<a href="${escapeHtml(url)}">${escapeHtml(linkWaarde.trim())}</a>`);
    } else {
      cmd('createLink', url);
    }
    sync();
    setPaneel(null);
  };

  const knop = 'flex h-8 min-w-[2rem] items-center justify-center rounded px-1.5 text-[13px] text-ink-800 hover:bg-mist';
  const geenFocusVerlies = (e: MouseEvent) => e.preventDefault();

  return (
    <div
      ref={wrap}
      className="relative"
      onFocus={() => setActief(true)}
      onBlur={(e) => {
        if (wrap.current?.contains(e.relatedTarget as Node | null)) return;
        setActief(false);
        setPaneel(null);
        opschonen();
      }}
    >
      <div
        ref={ref}
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label="Tekst van de nieuwsbrief"
        data-placeholder="Typ hier je tekst"
        dangerouslySetInnerHTML={begin}
        className="nb-tekst nb-bewerkbaar"
        style={style}
        onFocus={() => cmd('defaultParagraphSeparator', 'p')}
        onInput={sync}
        onKeyUp={bewaarBereik}
        onMouseUp={bewaarBereik}
        onPaste={(e) => {
          e.preventDefault();
          const h = e.clipboardData.getData('text/html');
          const t = e.clipboardData.getData('text/plain');
          if (h) cmd('insertHTML', sanitizeHtml(h));
          else cmd('insertText', t);
          sync();
        }}
        onDrop={(e) => {
          // Geen losse bestanden of HTML in de tekst laten vallen.
          if (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('text/html')) e.preventDefault();
        }}
      />

      {actief && (
        <div
          className="absolute left-0 top-full z-40 mt-1.5 flex w-max max-w-[380px] flex-wrap items-center gap-0.5 rounded-lg border border-line bg-white p-1 shadow-card"
          style={{ fontFamily: 'system-ui, sans-serif', lineHeight: 1.2, textAlign: 'left' }}
          role="toolbar"
          aria-label="Opmaak van de tekst"
        >
          <button type="button" onMouseDown={geenFocusVerlies} onClick={() => doe('bold')} className={`${knop} font-bold`} aria-label="Vet" title="Vet (Ctrl+B)">
            B
          </button>
          <button type="button" onMouseDown={geenFocusVerlies} onClick={() => doe('italic')} className={`${knop} italic`} aria-label="Cursief" title="Cursief (Ctrl+I)">
            I
          </button>
          <button type="button" onMouseDown={geenFocusVerlies} onClick={() => doe('underline')} className={`${knop} underline`} aria-label="Onderstrepen" title="Onderstrepen (Ctrl+U)">
            U
          </button>
          <span className="mx-0.5 h-5 w-px bg-line" />
          <button type="button" onMouseDown={geenFocusVerlies} onClick={openLink} className={knop} aria-label="Link toevoegen" title="Link">
            <IcoonLink />
          </button>
          <button type="button" onMouseDown={geenFocusVerlies} onClick={() => doe('insertUnorderedList')} className={knop} aria-label="Opsomming" title="Opsomming">
            <IcoonLijst />
          </button>
          <button type="button" onMouseDown={geenFocusVerlies} onClick={() => doe('insertOrderedList')} className={knop} aria-label="Genummerde lijst" title="Genummerde lijst">
            <IcoonGenummerd />
          </button>
          <span className="mx-0.5 h-5 w-px bg-line" />
          <button
            type="button"
            onMouseDown={geenFocusVerlies}
            onClick={() => {
              bewaarBereik();
              setPaneel((p) => (p === 'kleur' ? null : 'kleur'));
            }}
            className={knop}
            aria-label="Tekstkleur"
            title="Tekstkleur"
          >
            <span className="font-bold underline decoration-amber-500 decoration-[3px] underline-offset-2">A</span>
          </button>
          <button
            type="button"
            onMouseDown={geenFocusVerlies}
            onClick={() => {
              bewaarBereik();
              setPaneel((p) => (p === 'velden' ? null : 'velden'));
            }}
            className={`${knop} font-mono text-[12px]`}
            aria-label="Persoonlijk veld invoegen, zoals de naam"
            title="Naam of bedrijf invoegen"
          >
            {'{{ }}'}
          </button>
          <button type="button" onMouseDown={geenFocusVerlies} onClick={() => doe('removeFormat')} className={`${knop} text-[12px]`} aria-label="Opmaak wissen" title="Opmaak wissen">
            Wis opmaak
          </button>

          {paneel === 'link' && (
            <div className="flex w-full items-center gap-1.5 border-t border-line p-1.5">
              <input
                autoFocus
                value={linkWaarde}
                onChange={(e) => setLinkWaarde(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    zetLink();
                  }
                  if (e.key === 'Escape') setPaneel(null);
                }}
                placeholder="www.frederiksbedrijfskleding.nl of e-mailadres"
                aria-label="Adres van de link"
                className="veld min-w-[220px] flex-1 text-[13px]"
              />
              <button type="button" onClick={zetLink} className="knop-donker">
                {linkWaarde.trim() ? 'Link zetten' : 'Link weghalen'}
              </button>
            </div>
          )}
          {paneel === 'kleur' && (
            <div className="flex w-full items-center gap-1.5 border-t border-line p-1.5">
              {KLEUREN.map((k) => (
                <button
                  key={k}
                  type="button"
                  onMouseDown={geenFocusVerlies}
                  onClick={() => {
                    herstelBereik();
                    doe('foreColor', k);
                    setPaneel(null);
                  }}
                  aria-label={`Tekstkleur ${k}`}
                  className="h-7 w-7 rounded border border-ink-200"
                  style={{ backgroundColor: k }}
                />
              ))}
              <label className="ml-1 flex cursor-pointer items-center gap-1 text-[12px] text-warm">
                <input
                  type="color"
                  defaultValue="#ec6726"
                  onChange={(e) => {
                    herstelBereik();
                    doe('foreColor', e.target.value);
                  }}
                  className="h-7 w-9 cursor-pointer rounded border border-line"
                  aria-label="Andere tekstkleur"
                />
                Andere
              </label>
            </div>
          )}
          {paneel === 'velden' && (
            <div className="flex w-full flex-col border-t border-line p-1">
              {MERGE_TAGS.map((m) => (
                <button
                  key={m.tag}
                  type="button"
                  onMouseDown={geenFocusVerlies}
                  onClick={() => {
                    herstelBereik();
                    doe('insertText', m.tag);
                    setPaneel(null);
                  }}
                  className="flex items-center justify-between gap-3 rounded px-2 py-1.5 text-left text-[13px] hover:bg-mist"
                >
                  <span className="text-ink-800">{m.uitleg}</span>
                  <span className="font-mono text-[12px] text-warm">{m.tag}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const TekstBewerker = memo(TekstBewerkerBasis);
export default TekstBewerker;

/** Een kop: platte tekst, Enter maakt geen nieuwe regel. */
function KopBewerkerBasis({
  blokId,
  tekst,
  dispatch,
  style,
  tag,
}: {
  blokId: string;
  tekst: string;
  dispatch: Dispatch<Actie>;
  style: CSSProperties;
  tag: 'h1' | 'h2' | 'h3';
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [begin] = useState(() => ({ __html: escapeHtml(tekst) }));
  const laatste = useRef<string | null>(tekst);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el || tekst === laatste.current) return;
    el.textContent = tekst;
    laatste.current = tekst;
  }, [tekst]);

  const sync = () => {
    const t = (ref.current?.textContent ?? '').replace(/\s+/g, ' ');
    if (t === laatste.current) return;
    laatste.current = t;
    dispatch({ type: 'blokWijzigen', blokId, patch: { tekst: t }, sleutel: `${blokId}:tekst`, tijd: Date.now() });
  };

  const Tag = tag;
  return (
    <Tag
      ref={ref}
      contentEditable
      role="textbox"
      aria-label="Tekst van de kop"
      dangerouslySetInnerHTML={begin}
      data-placeholder="Typ hier de kop"
      className="nb-bewerkbaar"
      style={style}
      onInput={sync}
      onBlur={() => {
        // Eventuele opmaak (bv. via Ctrl+B) en dubbele spaties eruit: een kop is platte tekst.
        const el = ref.current;
        if (el && (el.children.length > 0 || el.textContent !== (laatste.current ?? ''))) el.textContent = laatste.current ?? '';
      }}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && ['b', 'i', 'u'].includes(e.key.toLowerCase())) e.preventDefault();
        if (e.key === 'Enter') {
          e.preventDefault();
          (e.target as HTMLElement).blur();
        }
      }}
      onPaste={(e) => {
        e.preventDefault();
        cmd('insertText', e.clipboardData.getData('text/plain').replace(/\s+/g, ' '));
        sync();
      }}
      onDrop={(e) => e.preventDefault()}
    />
  );
}

export const KopBewerker = memo(KopBewerkerBasis);
