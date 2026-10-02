'use client';

/**
 * Het canvas in het midden: de nieuwsbrief zoals hij eruit komt te zien, op de
 * breedte uit de algemene instellingen. Hier kun je secties en blokken
 * aanklikken, verslepen en neerzetten.
 */
import { Fragment, useRef, type CSSProperties, type Dispatch, type DragEvent } from 'react';
import { STRUCTUREN, defaultBlok, type Ontwerp } from '@/lib/nieuwsbrief/types';
import { lettertypeStack } from './BlokView';
import SectieView, { Invoeglijn } from './SectieView';
import { huidigeSleep, invoegIndex, pastTussenSecties, type DropDoel } from './slepen';
import { vindBlok, type Actie, type Selectie } from './state';
import { StructuurPlaatje } from './iconen';

/** Opmaak van opgemaakte tekst op het canvas; dezelfde maten als render.ts. */
const CANVAS_CSS = `
.nb-canvas .nb-tekst p{margin:0 0 .8em}
.nb-canvas .nb-tekst > :last-child{margin-bottom:0}
.nb-canvas .nb-tekst a{color:var(--nb-link);text-decoration:underline}
.nb-canvas .nb-tekst h1{margin:0 0 10px;font-size:1.8em;line-height:1.25;color:var(--nb-kop);font-weight:700}
.nb-canvas .nb-tekst h2{margin:0 0 8px;font-size:1.45em;line-height:1.3;color:var(--nb-kop);font-weight:700}
.nb-canvas .nb-tekst h3{margin:0 0 6px;font-size:1.2em;line-height:1.3;color:var(--nb-kop);font-weight:700}
.nb-canvas .nb-tekst ul{margin:0 0 .8em;padding:0 0 0 22px;list-style:disc}
.nb-canvas .nb-tekst ol{margin:0 0 .8em;padding:0 0 0 22px;list-style:decimal}
.nb-canvas .nb-tekst li{margin:0 0 4px}
.nb-canvas .nb-tekst b,.nb-canvas .nb-tekst strong{font-weight:700}
.nb-canvas .nb-tekst i,.nb-canvas .nb-tekst em{font-style:italic}
.nb-canvas .nb-tekst u{text-decoration:underline}
.nb-canvas .nb-bewerkbaar{cursor:text}
.nb-canvas .nb-bewerkbaar:empty:before{content:attr(data-placeholder);color:#adadad;font-style:italic}
.nb-canvas .nb-bewerkbaar:focus{outline:none}
.nb-canvas .group\\/blok:hover .nb-ruimte{background:repeating-linear-gradient(45deg,transparent 0 6px,rgba(37,99,235,.08) 6px 12px)}
`;

/** Is er ergens een zichtbaar blok van dit type? Anders zet de mail het er zelf bij. */
function heeftZichtbaar(o: Ontwerp, type: 'webversie' | 'afmelden'): boolean {
  return o.secties.some((s) => s.verbergen === 'geen' && s.kolommen.some((k) => k.blokken.some((b) => b.type === type && b.stijl.verbergen === 'geen')));
}

type Props = {
  ontwerp: Ontwerp;
  selectie: Selectie;
  dropDoel: DropDoel;
  dispatch: Dispatch<Actie>;
  zetDoel: (d: DropDoel) => void;
  laatNeer: (d: DropDoel) => void;
  bewaarAlsModule: (sectieId: string) => void;
};

export default function Canvas({ ontwerp, selectie, dropDoel, dispatch, zetDoel, laatNeer, bewaarAlsModule }: Props) {
  const lijst = useRef<HTMLDivElement>(null);
  const inst = ontwerp.instellingen;
  const secties = ontwerp.secties;

  const doelUitEvent = (e: DragEvent): DropDoel => {
    const el = lijst.current;
    const items = el ? Array.from(el.children).filter((c) => c.hasAttribute('data-sectie-id')) : [];
    return { soort: 'sectie', index: invoegIndex(items, e.clientY) };
  };

  const onDragOver = (e: DragEvent) => {
    const s = huidigeSleep();
    if (!pastTussenSecties(s)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = s?.soort === 'sectie' ? 'move' : 'copy';
    zetDoel(doelUitEvent(e));
  };

  const onDrop = (e: DragEvent) => {
    if (!pastTussenSecties(huidigeSleep())) return;
    e.preventDefault();
    laatNeer(doelUitEvent(e));
  };

  // Welke sectie / welk blok is geselecteerd? Per sectie uitrekenen, zodat
  // alleen de secties die er iets mee te maken hebben opnieuw tekenen.
  const geselecteerdeSectie = selectie?.soort === 'sectie' ? selectie.sectieId : null;
  const geselecteerdBlok = selectie?.soort === 'blok' ? selectie.blokId : null;
  const sectieVanBlok = geselecteerdBlok ? vindBlok(ontwerp, geselecteerdBlok)?.sectie.id ?? null : null;
  const sectieDropIndex = dropDoel?.soort === 'sectie' ? dropDoel.index : null;

  const canvasVars = { '--nb-link': inst.linkkleur, '--nb-kop': inst.kopkleur } as CSSProperties;
  const autoWebversie = !heeftZichtbaar(ontwerp, 'webversie');
  const autoAfmelden = !heeftZichtbaar(ontwerp, 'afmelden');
  const auto = defaultBlok('afmelden');

  return (
    <div
      className="nb-canvas min-h-full px-14 py-4"
      style={{ backgroundColor: inst.achtergrond, ...canvasVars }}
      onClick={() => dispatch({ type: 'selecteer', selectie: null })}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) zetDoel(null);
      }}
    >
      {/* Vaste, eigen CSS (geen invoer van buitenaf). */}
      <style dangerouslySetInnerHTML={{ __html: CANVAS_CSS }} />
      <div
        className="relative mx-auto"
        style={{ width: inst.breedte, maxWidth: 'none', backgroundColor: inst.inhoudAchtergrond, fontFamily: lettertypeStack(inst), color: inst.tekstkleur }}
      >
        {autoWebversie && secties.length > 0 && (
          <p className="select-none px-6 py-2 text-center font-sans text-[11px] italic text-ink-400" title="Deze regel zet de mail er zelf bij">
            Bovenaan komt automatisch: Bekijk deze e-mail in je browser
          </p>
        )}

        <div ref={lijst}>
          {secties.map((s, i) => (
            <Fragment key={s.id}>
              {sectieDropIndex === i && <Invoeglijn dik />}
              <SectieView
                sectie={s}
                inst={inst}
                geselecteerd={geselecteerdeSectie === s.id}
                geselecteerdBlokId={sectieVanBlok === s.id ? geselecteerdBlok : null}
                kolomDoel={dropDoel?.soort === 'kolom' && dropDoel.sectieId === s.id ? { kolomId: dropDoel.kolomId, index: dropDoel.index } : null}
                isEerste={i === 0}
                isLaatste={i === secties.length - 1}
                dispatch={dispatch}
                zetDoel={zetDoel}
                laatNeer={laatNeer}
                bewaarAlsModule={bewaarAlsModule}
              />
            </Fragment>
          ))}
          {sectieDropIndex !== null && sectieDropIndex >= secties.length && secties.length > 0 && <Invoeglijn dik />}
        </div>

        {secties.length === 0 ? (
          <div className="p-6 font-sans" onClick={(e) => e.stopPropagation()}>
            <div
              className={`rounded-lg border-2 border-dashed p-6 text-center ${sectieDropIndex !== null ? 'border-blue-500 bg-blue-50' : 'border-ink-200 bg-[#faf9f8]'}`}
            >
              <p className="text-[15px] font-semibold text-ink-800">Deze nieuwsbrief is nog leeg</p>
              <p className="mt-1 text-[13px] text-warm">Sleep een structuur uit het rechterpaneel hierheen, of klik op een indeling hieronder.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {STRUCTUREN.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => dispatch({ type: 'sectieToevoegen', index: 0, verhouding: st.verhouding })}
                    className="flex w-24 flex-col items-center gap-1.5 rounded-md border border-line bg-white p-2 text-[11px] text-ink-700 hover:border-blue-400"
                  >
                    <StructuurPlaatje verhouding={st.verhouding} />
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          autoAfmelden && (
            <p className="select-none px-6 py-3 text-center font-sans text-[11px] italic text-ink-400" title="Deze regel zet de mail er zelf bij">
              Onderaan komt automatisch: {auto.tekst} {auto.linkTekst}
            </p>
          )
        )}
      </div>

      {secties.length > 0 && (
        <div className="mx-auto mt-3 flex justify-center font-sans" style={{ width: inst.breedte }} onClick={(e) => e.stopPropagation()}>
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-teal-400 bg-white px-3 py-1.5 text-[13px] font-semibold text-teal-700 shadow-sm hover:bg-teal-50">
              + Sectie toevoegen
            </summary>
            <div className="absolute left-1/2 z-40 mt-2 grid w-[420px] -translate-x-1/2 grid-cols-3 gap-2 rounded-lg border border-line bg-white p-3 shadow-card">
              {STRUCTUREN.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={(e) => {
                    dispatch({ type: 'sectieToevoegen', index: secties.length, verhouding: st.verhouding });
                    (e.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open');
                  }}
                  className="flex flex-col items-center gap-1.5 rounded-md border border-line p-2 text-[11px] text-ink-700 hover:border-blue-400"
                >
                  <StructuurPlaatje verhouding={st.verhouding} />
                  {st.label}
                </button>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
