'use client';

/**
 * Eén sectie (structuur) op het canvas, met de kolommen en blokken erin.
 * Elke kolom is een plek waar je blokken kunt neerzetten; een blauwe lijn laat
 * zien waar het blok terechtkomt.
 */
import { Fragment, memo, useRef, type CSSProperties, type Dispatch, type DragEvent } from 'react';
import type { Instellingen, Kolom, Sectie } from '@/lib/nieuwsbrief/types';
import BlokView from './BlokView';
import ElementMenu from './ElementMenu';
import { IcoonBewaar, IcoonGreep, IcoonKopie, IcoonPijlOmhoog, IcoonPijlOmlaag, IcoonPrullenbak } from './iconen';
import { huidigeSleep, invoegIndex, pastInKolom, startSleep, stopSleep, type DropDoel } from './slepen';
import type { Actie } from './state';

export function Invoeglijn({ dik = false }: { dik?: boolean }) {
  return (
    <div className="pointer-events-none relative z-40 h-0" aria-hidden="true">
      <div className={`absolute left-0 right-0 rounded-full bg-blue-600 ${dik ? '-top-[3px] h-1.5' : '-top-[2px] h-1'}`}>
        <span className="absolute -left-1 -top-[3px] h-3 w-3 rounded-full bg-blue-600" />
        <span className="absolute -right-1 -top-[3px] h-3 w-3 rounded-full bg-blue-600" />
      </div>
    </div>
  );
}

type KolomProps = {
  sectieId: string;
  kolom: Kolom;
  breedtePct: number;
  breedtePx: number;
  inst: Instellingen;
  geselecteerdBlokId: string | null;
  dropIndex: number | null;
  dispatch: Dispatch<Actie>;
  zetDoel: (d: DropDoel) => void;
  laatNeer: (d: DropDoel) => void;
};

function KolomView({ sectieId, kolom, breedtePct, breedtePx, inst, geselecteerdBlokId, dropIndex, dispatch, zetDoel, laatNeer }: KolomProps) {
  const ref = useRef<HTMLDivElement>(null);

  const doelUitEvent = (e: DragEvent): DropDoel => {
    const el = ref.current;
    const blokken = el ? Array.from(el.children).filter((c) => c.hasAttribute('data-blok-id')) : [];
    return { soort: 'kolom', sectieId, kolomId: kolom.id, index: invoegIndex(blokken, e.clientY) };
  };

  const onDragOver = (e: DragEvent) => {
    const s = huidigeSleep();
    if (!pastInKolom(s)) return; // laat het aan het canvas over (secties)
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = s?.soort === 'blok' ? 'move' : 'copy';
    zetDoel(doelUitEvent(e));
  };

  const onDrop = (e: DragEvent) => {
    if (!pastInKolom(huidigeSleep())) return;
    e.preventDefault();
    e.stopPropagation();
    laatNeer(doelUitEvent(e));
  };

  const leeg = kolom.blokken.length === 0;

  return (
    <div
      ref={ref}
      className="relative"
      style={{ width: `${breedtePct}%`, verticalAlign: 'top', minHeight: leeg ? 72 : undefined }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {kolom.blokken.map((b, i) => (
        <Fragment key={b.id}>
          {dropIndex === i && <Invoeglijn />}
          <BlokView
            blok={b}
            inst={inst}
            kolomBreedte={breedtePx}
            geselecteerd={geselecteerdBlokId === b.id}
            isEerste={i === 0}
            isLaatste={i === kolom.blokken.length - 1}
            dispatch={dispatch}
          />
        </Fragment>
      ))}
      {dropIndex !== null && dropIndex >= kolom.blokken.length && !leeg && <Invoeglijn />}
      {leeg && (
        <div className="p-2.5">
          <div
            className={`flex min-h-[52px] items-center justify-center rounded border-2 border-dashed px-2 text-center font-sans text-[12px] ${
              dropIndex !== null ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-ink-200 bg-[#faf9f8] text-ink-400'
            }`}
          >
            Sleep hier een blok naartoe
          </div>
        </div>
      )}
    </div>
  );
}

type Props = {
  sectie: Sectie;
  inst: Instellingen;
  geselecteerd: boolean;
  geselecteerdBlokId: string | null;
  /** Invoeglijn in een van de kolommen van deze sectie. */
  kolomDoel: { kolomId: string; index: number } | null;
  isEerste: boolean;
  isLaatste: boolean;
  dispatch: Dispatch<Actie>;
  zetDoel: (d: DropDoel) => void;
  laatNeer: (d: DropDoel) => void;
  bewaarAlsModule: (sectieId: string) => void;
};

function SectieViewBasis({ sectie: s, inst, geselecteerd, geselecteerdBlokId, kolomDoel, isEerste, isLaatste, dispatch, zetDoel, laatNeer, bewaarAlsModule }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const st = s.stijl;
  const rand = st.rand && st.rand.breedte > 0 ? st.rand : null;
  const binnen = Math.max(100, inst.breedte - st.padding.links - st.padding.rechts - (rand ? rand.breedte * 2 : 0));
  const som = s.verhouding.reduce((a, b) => a + b, 0) || 100;
  const verborgen = s.verbergen !== 'geen';

  const buiten: CSSProperties = {
    backgroundColor: st.achtergrond || undefined,
    backgroundImage: st.achtergrondAfbeelding ? `url("${st.achtergrondAfbeelding.replace(/["\\\s]/g, encodeURIComponent)}")` : undefined,
    backgroundSize: st.achtergrondAfbeelding ? 'cover' : undefined,
    backgroundPosition: st.achtergrondAfbeelding ? 'center' : undefined,
    padding: `${st.padding.boven}px ${st.padding.rechts}px ${st.padding.onder}px ${st.padding.links}px`,
  };
  const inhoud: CSSProperties = {
    display: 'flex',
    backgroundColor: st.inhoudAchtergrond || undefined,
    border: rand ? `${rand.breedte}px ${rand.stijl} ${rand.kleur}` : undefined,
    borderRadius: st.radius || undefined,
  };

  return (
    <div
      ref={ref}
      data-sectie-id={s.id}
      className="group/sectie relative"
      onClick={(e) => {
        e.stopPropagation();
        dispatch({ type: 'selecteer', selectie: { soort: 'sectie', sectieId: s.id } });
      }}
    >
      <div style={buiten} className={verborgen ? 'opacity-50' : undefined}>
        <div style={inhoud}>
          {s.kolommen.map((k, i) => {
            const pct = ((s.verhouding[i] ?? 100 / s.kolommen.length) / som) * 100;
            return (
              <KolomView
                key={k.id}
                sectieId={s.id}
                kolom={k}
                breedtePct={pct}
                breedtePx={Math.floor((binnen * pct) / 100)}
                inst={inst}
                geselecteerdBlokId={geselecteerdBlokId}
                dropIndex={kolomDoel?.kolomId === k.id ? kolomDoel.index : null}
                dispatch={dispatch}
                zetDoel={zetDoel}
                laatNeer={laatNeer}
              />
            );
          })}
        </div>
      </div>

      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 z-[5] ${geselecteerd ? 'ring-2 ring-blue-600' : 'group-hover/sectie:ring-1 group-hover/sectie:ring-teal-500'}`}
      />
      {(geselecteerd || verborgen) && (
        <span className="pointer-events-none absolute right-0 top-0 z-20 rounded-bl bg-blue-600 px-1.5 py-0.5 font-sans text-[10px] font-bold uppercase tracking-wide text-white">
          Sectie{s.naam ? ` · ${s.naam}` : ''}
          {s.verbergen === 'desktop' ? ' · alleen telefoon' : s.verbergen === 'mobiel' ? ' · alleen computer' : ''}
        </span>
      )}

      {/* Knoppen rechts naast de brief, zoals in Mailblue. */}
      <div
        className={`absolute -right-11 top-0 z-30 flex-col items-center gap-1 pl-2 font-sans ${geselecteerd ? 'flex' : 'hidden group-hover/sectie:flex'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          draggable
          aria-hidden="true"
          onDragStart={(e) => startSleep(e, { soort: 'sectie', sectieId: s.id }, ref.current)}
          onDragEnd={stopSleep}
          title="Versleep deze sectie"
          className="flex h-7 w-7 cursor-grab items-center justify-center rounded-md border border-teal-300 bg-white text-teal-700 shadow-sm hover:bg-teal-50 active:cursor-grabbing"
        >
          <IcoonGreep />
        </div>
        <ElementMenu
          label="Acties voor deze sectie"
          items={[
            { label: 'Omhoog', icoon: <IcoonPijlOmhoog />, uit: isEerste, onClick: () => dispatch({ type: 'sectieOmhoog', sectieId: s.id }) },
            { label: 'Omlaag', icoon: <IcoonPijlOmlaag />, uit: isLaatste, onClick: () => dispatch({ type: 'sectieOmlaag', sectieId: s.id }) },
            { label: 'Dupliceren', icoon: <IcoonKopie />, onClick: () => dispatch({ type: 'sectieDupliceren', sectieId: s.id }) },
            { label: 'Opslaan als module', icoon: <IcoonBewaar />, onClick: () => bewaarAlsModule(s.id) },
            { label: 'Verwijderen', icoon: <IcoonPrullenbak />, gevaar: true, onClick: () => dispatch({ type: 'sectieVerwijderen', sectieId: s.id }) },
          ]}
        />
      </div>
    </div>
  );
}

const SectieView = memo(SectieViewBasis);
export default SectieView;
