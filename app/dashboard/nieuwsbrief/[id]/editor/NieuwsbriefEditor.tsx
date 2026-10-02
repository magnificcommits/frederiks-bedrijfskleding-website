'use client';

/**
 * ============================================================================
 *  Nieuwsbrief-editor (stream E-B): de visuele tegenhanger van de Mailblue-editor.
 * ============================================================================
 *
 * Indeling:
 *   - midden: canvas met de nieuwsbrief op de echte breedte (Canvas.tsx,
 *     SectieView.tsx, BlokView.tsx); tekst typ je er direct in (TekstBewerker.tsx);
 *   - rechts: paneel met de tabbladen Inhoud (Structuren, Blokken, Modules, of de
 *     instellingen van wat geselecteerd is) en Algemene instellingen (Paneel.tsx,
 *     Instellingen.tsx, velden.tsx, Kiezers.tsx);
 *   - boven: ongedaan maken / opnieuw, voorbeeld (Voorbeeld.tsx), opslaan + status.
 *
 * Toestand: één reducer met onveranderlijke updates en geschiedenis (state.ts).
 * Slepen: native HTML5 drag-and-drop (slepen.ts).
 *
 * Props (gezet door ../page.tsx):
 *   nieuwsbriefId  id van de rij in `nieuwsbrieven` (ook bij een template)
 *   naam           naam van de brief, voor de titel van het voorbeeld
 *   initieelOntwerp het opgeslagen, genormaliseerde ontwerp
 *   modules        opgeslagen modules (herbruikbare secties)
 *   siteUrl        basis-url van de site, voor renderNieuwsbrief()
 *
 * Opslaan: automatisch ~2 s na de laatste wijziging via slaOntwerpOp(), en met
 * de knop Opslaan of Ctrl+S. Bij weggaan met onopgeslagen wijzigingen volgt
 * een waarschuwing. Het tabblad Versturen haalt de editor uit beeld; daarom
 * wordt dan meteen opgeslagen en onthouden we het ontwerp tot je terugkomt.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { BlokType, Module, Ontwerp } from '@/lib/nieuwsbrief/types';
import { slaOntwerpOp } from '../actions';
import Canvas from './Canvas';
import { IcoonBewaar, IcoonOog, IcoonOngedaan, IcoonOpnieuw } from './iconen';
import Paneel from './Paneel';
import { huidigeSleep, stopSleep, zelfdeDoel, type DropDoel } from './slepen';
import { beginState, editorReducer, vindBlok, vindSectieIndex, type Actie } from './state';
import Voorbeeld from './Voorbeeld';

export type NieuwsbriefEditorProps = {
  nieuwsbriefId: string;
  naam: string;
  initieelOntwerp: Ontwerp;
  modules: Module[];
  siteUrl: string;
};

type Status = { soort: 'opgeslagen'; om: string | null } | { soort: 'gewijzigd' } | { soort: 'bezig' } | { soort: 'fout'; melding: string };

/**
 * Het laatst bekende ontwerp per brief, zolang de pagina open is. Als je naar
 * het tabblad Versturen gaat en terugkomt, begint de editor hiermee in plaats
 * van met het (oudere) ontwerp waarmee de pagina geladen werd.
 */
const geheugen = new Map<string, { ontwerp: Ontwerp; bron: Ontwerp }>();

const AUTOSAVE_MS = 2000;

function tijdNu(iso: string): string {
  return new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

function inBewerkbaarVeld(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT';
}

export default function NieuwsbriefEditor({ nieuwsbriefId, naam, initieelOntwerp, modules: beginModules, siteUrl }: NieuwsbriefEditorProps) {
  const [state, dispatch] = useReducer(editorReducer, undefined, () => {
    const g = geheugen.get(nieuwsbriefId);
    // Alleen gebruiken als de pagina sindsdien niet met een ander ontwerp is geladen.
    return beginState(g && g.bron === initieelOntwerp ? g.ontwerp : initieelOntwerp);
  });
  const [modules, setModules] = useState<Module[]>(beginModules);
  const [dropDoel, setDropDoel] = useState<DropDoel>(null);
  const [moduleVoor, setModuleVoor] = useState<string | null>(null);
  const [voorbeeld, setVoorbeeld] = useState(false);
  const [status, setStatus] = useState<Status>({ soort: 'opgeslagen', om: null });

  /* ---------------- Refs voor stabiele callbacks ---------------- */
  const stateRef = useRef(state);
  stateRef.current = state;
  const modulesRef = useRef(modules);
  modulesRef.current = modules;
  const opgeslagenVersie = useRef(state.versie);
  const bezigRef = useRef(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const nogEens = useRef(false);

  // Geheugen bijhouden voor als de editor even uit beeld gaat.
  useEffect(() => {
    geheugen.set(nieuwsbriefId, { ontwerp: state.ontwerp, bron: initieelOntwerp });
  }, [state.ontwerp, nieuwsbriefId, initieelOntwerp]);

  /* ---------------- Opslaan ---------------- */
  const opslaan = useCallback(async () => {
    if (bezigRef.current) {
      nogEens.current = true;
      return;
    }
    const { ontwerp, versie } = stateRef.current;
    if (versie === opgeslagenVersie.current) {
      setStatus((s) => (s.soort === 'fout' ? s : { soort: 'opgeslagen', om: s.soort === 'opgeslagen' ? s.om : null }));
      return;
    }
    bezigRef.current = true;
    setStatus({ soort: 'bezig' });
    try {
      const uit = await slaOntwerpOp(nieuwsbriefId, ontwerp);
      if (uit.ok) {
        opgeslagenVersie.current = versie;
        setStatus(stateRef.current.versie === versie ? { soort: 'opgeslagen', om: uit.opgeslagenOp } : { soort: 'gewijzigd' });
      } else {
        setStatus({ soort: 'fout', melding: uit.fout });
      }
    } catch {
      setStatus({ soort: 'fout', melding: 'Opslaan is mislukt. Controleer je internetverbinding en klik op Opslaan.' });
    } finally {
      bezigRef.current = false;
      if (nogEens.current) {
        nogEens.current = false;
        void opslaanRef.current();
      }
    }
  }, [nieuwsbriefId]);
  const opslaanRef = useRef(opslaan);
  opslaanRef.current = opslaan;

  // Automatisch opslaan, 2 seconden na de laatste wijziging.
  useEffect(() => {
    if (state.versie === opgeslagenVersie.current) return;
    setStatus((s) => (s.soort === 'bezig' ? s : { soort: 'gewijzigd' }));
    const t = setTimeout(() => void opslaanRef.current(), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [state.versie]);

  // Weggaan (tabblad dicht, herladen) met onopgeslagen wijzigingen: waarschuwen.
  useEffect(() => {
    const voorVertrek = (e: BeforeUnloadEvent) => {
      if (stateRef.current.versie !== opgeslagenVersie.current || bezigRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    // Een link binnen het dashboard aanklikken: ook waarschuwen.
    const linkKlik = (e: MouseEvent) => {
      if (stateRef.current.versie === opgeslagenVersie.current && !bezigRef.current) return;
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.origin !== window.location.origin) return;
      if (!window.confirm('Je hebt wijzigingen die nog niet zijn opgeslagen. Weet je zeker dat je weg wilt gaan?')) {
        e.preventDefault();
        e.stopPropagation();
      } else {
        void opslaanRef.current();
      }
    };
    window.addEventListener('beforeunload', voorVertrek);
    document.addEventListener('click', linkKlik, true);
    return () => {
      window.removeEventListener('beforeunload', voorVertrek);
      document.removeEventListener('click', linkKlik, true);
    };
  }, []);

  // Uit beeld (bv. naar het tabblad Versturen): meteen opslaan wat er nog openstaat.
  useEffect(
    () => () => {
      if (stateRef.current.versie !== opgeslagenVersie.current) void slaOntwerpOp(nieuwsbriefId, stateRef.current.ontwerp).catch(() => undefined);
    },
    [nieuwsbriefId],
  );

  /* ---------------- Toetsenbord ---------------- */
  useEffect(() => {
    const toets = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 's') {
        e.preventDefault();
        void opslaanRef.current();
        return;
      }
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      // In een tekstvak of invoerveld doet de browser zelf ongedaan maken en wissen.
      if (inBewerkbaarVeld(e.target)) return;
      if (mod && k === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'ongedaan' });
      } else if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) {
        e.preventDefault();
        dispatch({ type: 'opnieuw' });
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && stateRef.current.selectie) {
        // Alleen als je op het canvas bezig bent, niet na een klik op een knop in het paneel.
        const t = e.target;
        if (t !== document.body && !(t instanceof Node && canvasRef.current?.contains(t))) return;
        e.preventDefault();
        dispatch({ type: 'verwijderSelectie' });
      } else if (e.key === 'Escape' && stateRef.current.selectie) {
        dispatch({ type: 'naarContainer' });
      }
    };
    window.addEventListener('keydown', toets);
    return () => window.removeEventListener('keydown', toets);
  }, []);

  /* ---------------- Slepen ---------------- */
  const zetDoel = useCallback((d: DropDoel) => {
    setDropDoel((oud) => (zelfdeDoel(oud, d) ? oud : d));
  }, []);

  // Slepen afgebroken of buiten de brief losgelaten: invoeglijn weg.
  useEffect(() => {
    const klaar = () => {
      setDropDoel(null);
      // Even wachten: de drop-handler leest de sleep eerst nog uit.
      setTimeout(stopSleep, 0);
    };
    window.addEventListener('dragend', klaar);
    window.addEventListener('drop', klaar);
    return () => {
      window.removeEventListener('dragend', klaar);
      window.removeEventListener('drop', klaar);
    };
  }, []);

  const laatNeer = useCallback((doel: DropDoel) => {
    const s = huidigeSleep();
    stopSleep();
    setDropDoel(null);
    if (!s || !doel) return;
    let actie: Actie | null = null;
    if (doel.soort === 'kolom') {
      if (s.soort === 'nieuwBlok') actie = { type: 'blokToevoegen', sectieId: doel.sectieId, kolomId: doel.kolomId, index: doel.index, blokType: s.blokType };
      else if (s.soort === 'blok') actie = { type: 'blokVerplaatsen', blokId: s.blokId, sectieId: doel.sectieId, kolomId: doel.kolomId, naarIndex: doel.index };
    } else {
      if (s.soort === 'structuur') actie = { type: 'sectieToevoegen', index: doel.index, verhouding: s.verhouding };
      else if (s.soort === 'nieuwBlok') actie = { type: 'sectieToevoegen', index: doel.index, verhouding: [100], blokType: s.blokType };
      else if (s.soort === 'sectie') actie = { type: 'sectieVerplaatsen', sectieId: s.sectieId, naarIndex: doel.index };
      else if (s.soort === 'module') {
        const m = modulesRef.current.find((x) => x.id === s.moduleId);
        if (m) actie = { type: 'sectieInvoegen', index: doel.index, sectie: m.sectie };
      }
    }
    if (actie) dispatch(actie);
  }, []);

  /* ---------------- Toevoegen met een klik ---------------- */
  /** Na de geselecteerde sectie (of de sectie van het geselecteerde blok), anders onderaan. */
  const invoegPlek = useCallback((): number => {
    const { ontwerp, selectie } = stateRef.current;
    if (selectie?.soort === 'sectie') {
      const i = vindSectieIndex(ontwerp, selectie.sectieId);
      if (i !== -1) return i + 1;
    }
    if (selectie?.soort === 'blok') {
      const p = vindBlok(ontwerp, selectie.blokId);
      if (p) return p.sectieIndex + 1;
    }
    return ontwerp.secties.length;
  }, []);

  const voegStructuurToe = useCallback((verhouding: number[]) => dispatch({ type: 'sectieToevoegen', index: invoegPlek(), verhouding }), [invoegPlek]);

  const voegBlokToe = useCallback(
    (blokType: BlokType) => {
      const { ontwerp, selectie } = stateRef.current;
      if (selectie?.soort === 'blok') {
        const p = vindBlok(ontwerp, selectie.blokId);
        if (p) return dispatch({ type: 'blokToevoegen', sectieId: p.sectie.id, kolomId: p.kolom.id, index: p.blokIndex + 1, blokType });
      }
      if (selectie?.soort === 'sectie') {
        const s = ontwerp.secties.find((x) => x.id === selectie.sectieId);
        // Eerst een lege kolom vullen (zo kun je een 2x2-raster met klikken opbouwen).
        const k = s?.kolommen.find((x) => x.blokken.length === 0) ?? s?.kolommen[0];
        if (s && k) return dispatch({ type: 'blokToevoegen', sectieId: s.id, kolomId: k.id, index: k.blokken.length, blokType });
      }
      dispatch({ type: 'sectieToevoegen', index: ontwerp.secties.length, verhouding: [100], blokType });
    },
    [],
  );

  const voegModuleIn = useCallback((m: Module) => dispatch({ type: 'sectieInvoegen', index: invoegPlek(), sectie: m.sectie }), [invoegPlek]);

  const bewaarAlsModule = useCallback((sectieId: string) => {
    dispatch({ type: 'selecteer', selectie: { soort: 'sectie', sectieId } });
    setModuleVoor(sectieId);
  }, []);

  const sluitVoorbeeld = useCallback(() => setVoorbeeld(false), []);

  /* ---------------- Weergave ---------------- */
  const statusTekst =
    status.soort === 'bezig'
      ? 'Bezig met opslaan...'
      : status.soort === 'gewijzigd'
        ? 'Niet opgeslagen'
        : status.soort === 'fout'
          ? 'Niet opgeslagen'
          : status.om
            ? `Opgeslagen om ${tijdNu(status.om)}`
            : 'Opgeslagen';

  const knopIcoon = 'flex h-9 items-center gap-1.5 rounded-md border border-line bg-white px-2.5 text-[13px] font-semibold text-ink-700 hover:bg-mist disabled:opacity-40';

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      {/* Werkbalk */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => dispatch({ type: 'ongedaan' })}
            disabled={state.verleden.length === 0}
            className={knopIcoon}
            aria-label="Ongedaan maken"
            title="Ongedaan maken (Ctrl+Z)"
          >
            <IcoonOngedaan />
            <span className="hidden sm:inline">Ongedaan maken</span>
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'opnieuw' })}
            disabled={state.toekomst.length === 0}
            className={knopIcoon}
            aria-label="Opnieuw"
            title="Opnieuw (Ctrl+Y)"
          >
            <IcoonOpnieuw />
            <span className="hidden sm:inline">Opnieuw</span>
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            role="status"
            className={`text-[13px] font-semibold ${status.soort === 'fout' ? 'text-red-700' : status.soort === 'opgeslagen' ? 'text-green-700' : 'text-amber-700'}`}
          >
            {statusTekst}
          </span>
          <button type="button" onClick={() => setVoorbeeld(true)} className={knopIcoon}>
            <IcoonOog />
            Voorbeeld
          </button>
          <button
            type="button"
            onClick={() => void opslaan()}
            disabled={status.soort === 'bezig'}
            className="knop-primair h-9 px-3 text-[14px]"
            title="Opslaan (Ctrl+S)"
          >
            <IcoonBewaar />
            Opslaan
          </button>
        </div>
      </div>
      {status.soort === 'fout' && (
        <p role="alert" className="border-b border-red-200 bg-red-50 px-4 py-2 text-[13px] font-semibold text-red-700">
          {status.melding}
        </p>
      )}

      {/* Canvas + paneel */}
      <div className="grid h-[calc(100vh-14rem)] min-h-[640px] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div ref={canvasRef} className="min-h-0 overflow-auto bg-mist">
          <Canvas
            ontwerp={state.ontwerp}
            selectie={state.selectie}
            dropDoel={dropDoel}
            dispatch={dispatch}
            zetDoel={zetDoel}
            laatNeer={laatNeer}
            bewaarAlsModule={bewaarAlsModule}
          />
        </div>
        <aside className="min-h-0 border-t border-line lg:border-l lg:border-t-0" aria-label="Instellingen">
          <Paneel
            ontwerp={state.ontwerp}
            selectie={state.selectie}
            dispatch={dispatch}
            modules={modules}
            onModuleOpgeslagen={(m) => setModules((lijst) => [...lijst, m].sort((a, b) => a.naam.localeCompare(b.naam, 'nl')))}
            onModuleVerwijderd={(id) => setModules((lijst) => lijst.filter((m) => m.id !== id))}
            moduleVoor={moduleVoor}
            setModuleVoor={setModuleVoor}
            voegStructuurToe={voegStructuurToe}
            voegBlokToe={voegBlokToe}
            voegModuleIn={voegModuleIn}
          />
        </aside>
      </div>

      {voorbeeld && <Voorbeeld ontwerp={state.ontwerp} naam={naam} siteUrl={siteUrl} onSluit={sluitVoorbeeld} />}
    </div>
  );
}
