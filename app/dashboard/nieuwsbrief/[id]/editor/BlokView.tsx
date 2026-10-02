'use client';
/* eslint-disable @next/next/no-img-element -- e-mailafbeeldingen komen van overal en horen niet door next/image */

/**
 * Eén blok op het canvas: dezelfde opmaak als de echte mail (render.ts), plus
 * de editor-knoppen eromheen (selecteren, verslepen, menu).
 */
import { memo, useRef, type CSSProperties, type Dispatch } from 'react';
import { BLOKTYPEN, LETTERTYPEN, SOCIAL_KANALEN, type Blok, type BlokStijl, type Instellingen } from '@/lib/nieuwsbrief/types';
import ElementMenu from './ElementMenu';
import { IcoonGreep, IcoonKopie, IcoonPijlOmhoog, IcoonPijlOmlaag, IcoonPrullenbak } from './iconen';
import { startSleep, stopSleep } from './slepen';
import type { Actie } from './state';
import TekstBewerker, { KopBewerker } from './TekstBewerker';

const ALIGN = { links: 'left', midden: 'center', rechts: 'right' } as const;

export function lettertypeStack(inst: Instellingen): string {
  return LETTERTYPEN[inst.lettertype]?.stack ?? LETTERTYPEN.arial.stack;
}

function padCss(p: BlokStijl['padding']): string {
  return `${p.boven}px ${p.rechts}px ${p.onder}px ${p.links}px`;
}

/** Zelfde cel als blokCel() in render.ts. */
function celStijl(stijl: BlokStijl, inst: Instellingen, over: { tekstkleur?: string; achtergrond?: string } = {}): CSSProperties {
  const bg = over.achtergrond ?? stijl.achtergrond;
  return {
    padding: padCss(stijl.padding),
    backgroundColor: bg || undefined,
    color: over.tekstkleur ?? (stijl.tekstkleur || inst.tekstkleur),
    fontFamily: lettertypeStack(inst),
    fontSize: stijl.lettergrootte,
    lineHeight: stijl.regelafstand,
    textAlign: ALIGN[stijl.uitlijning],
  };
}

function margeVoor(u: BlokStijl['uitlijning']): CSSProperties {
  return u === 'midden' ? { marginLeft: 'auto', marginRight: 'auto' } : u === 'rechts' ? { marginLeft: 'auto' } : {};
}

/** Zelfde plaatshouder als in de voorbeeldweergave van render.ts. */
export function Plaatshouder({ tekst, hoogte = 120 }: { tekst: string; hoogte?: number }) {
  return (
    <div
      style={{
        border: '2px dashed #d6d3d0',
        backgroundColor: '#faf9f8',
        color: '#8a8784',
        fontSize: 13,
        lineHeight: 1.4,
        textAlign: 'center',
        padding: `${Math.max(16, Math.round((hoogte - 20) / 2))}px 12px`,
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}
    >
      {tekst}
    </div>
  );
}

const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n);

/** De inhoud van een blok, zonder editor-knoppen. */
function BlokInhoud({ blok: b, inst, kolomBreedte, dispatch }: { blok: Blok; inst: Instellingen; kolomBreedte: number; dispatch: Dispatch<Actie> }) {
  const ruimte = Math.max(20, kolomBreedte - b.stijl.padding.links - b.stijl.padding.rechts);
  switch (b.type) {
    case 'tekst':
      return (
        <div style={celStijl(b.stijl, inst)}>
          <TekstBewerker blokId={b.id} html={b.html} dispatch={dispatch} style={{ outline: 'none', minHeight: '1em' }} />
        </div>
      );

    case 'kop': {
      const bg = b.stijl.achtergrond || (b.balk ? '#1c1c1c' : '');
      const kleur = b.stijl.tekstkleur || (b.balk ? '#ffffff' : inst.kopkleur);
      return (
        <div style={celStijl(b.stijl, inst, { tekstkleur: kleur, achtergrond: bg })}>
          <KopBewerker
            blokId={b.id}
            tekst={b.tekst}
            dispatch={dispatch}
            tag={`h${b.niveau}` as 'h1' | 'h2' | 'h3'}
            style={{
              margin: 0,
              outline: 'none',
              fontFamily: lettertypeStack(inst),
              fontSize: b.stijl.lettergrootte,
              lineHeight: b.stijl.regelafstand,
              fontWeight: b.vet === false ? 400 : 700,
              color: kleur,
              letterSpacing: b.letterafstand ? `${b.letterafstand}em` : undefined,
            }}
          />
        </div>
      );
    }

    case 'afbeelding': {
      if (!b.src.trim()) {
        return (
          <div style={celStijl(b.stijl, inst)}>
            <Plaatshouder tekst="Kies een afbeelding" hoogte={160} />
          </div>
        );
      }
      const vol = b.breedte === 'vol';
      const w = vol ? ruimte : Math.min(ruimte, b.breedte as number);
      return (
        <div style={celStijl(b.stijl, inst)}>
          <img
            src={b.src}
            alt={b.alt}
            draggable={false}
            style={{ display: 'block', width: vol ? '100%' : w, maxWidth: w, height: 'auto', borderRadius: b.radius || undefined, ...margeVoor(b.stijl.uitlijning) }}
          />
        </div>
      );
    }

    case 'knop':
      return (
        <div style={celStijl(b.stijl, inst)}>
          <span
            style={{
              display: b.volleBreedte ? 'block' : 'inline-block',
              padding: '13px 28px',
              fontFamily: lettertypeStack(inst),
              fontSize: b.stijl.lettergrootte,
              fontWeight: 700,
              lineHeight: 1.2,
              color: b.tekstkleur,
              backgroundColor: b.achtergrond,
              borderRadius: b.radius || undefined,
              textAlign: 'center',
            }}
          >
            {b.tekst.trim() || 'Knop'}
          </span>
        </div>
      );

    case 'scheiding':
      return (
        <div style={{ ...celStijl({ ...b.stijl, lettergrootte: 1, regelafstand: 1 }, inst) }}>
          <div style={{ width: `${b.breedte}%`, borderTop: `${b.dikte}px ${b.lijnstijl ?? 'solid'} ${b.kleur}`, ...margeVoor(b.stijl.uitlijning) }} />
        </div>
      );

    case 'ruimte':
      return (
        <div style={celStijl({ ...b.stijl, lettergrootte: 1, regelafstand: 1 }, inst)}>
          <div style={{ height: Math.max(0, b.hoogte) }} className="nb-ruimte" />
        </div>
      );

    case 'social': {
      const kleur = (b.iconKleur || '#1c1c1c').replace('#', '');
      const actief = SOCIAL_KANALEN.filter((k) => (b.links[k] ?? '').trim());
      if (actief.length === 0) {
        return (
          <div style={celStijl(b.stijl, inst)}>
            <Plaatshouder tekst="Vul de links naar je social media in" hoogte={30} />
          </div>
        );
      }
      return (
        <div style={celStijl(b.stijl, inst)}>
          <div style={{ display: 'inline-flex', gap: 12 }}>
            {actief.map((k) => (
              <img
                key={k}
                src={`/nieuwsbrief/icoon/${k}?kleur=${encodeURIComponent(kleur)}`}
                width={b.grootte}
                height={b.grootte}
                alt={k}
                draggable={false}
                style={{ display: 'block', width: b.grootte, height: b.grootte }}
              />
            ))}
          </div>
        </div>
      );
    }

    case 'product': {
      if (!b.naam.trim() && !b.foto) {
        return (
          <div style={celStijl(b.stijl, inst)}>
            <Plaatshouder tekst="Kies een product" hoogte={180} />
          </div>
        );
      }
      const kleur = b.stijl.tekstkleur || inst.kopkleur;
      return (
        <div style={celStijl(b.stijl, inst)}>
          {b.foto ? (
            <img src={b.foto} alt={b.naam} draggable={false} style={{ display: 'block', width: '100%', maxWidth: ruimte, height: 'auto', ...margeVoor(b.stijl.uitlijning) }} />
          ) : (
            <Plaatshouder tekst="Geen foto" />
          )}
          {b.naam.trim() && <p style={{ margin: '10px 0 0', fontWeight: 700, color: kleur }}>{b.naam.trim()}</p>}
          {b.merk.trim() && <p style={{ margin: '2px 0 0', fontSize: Math.max(10, b.stijl.lettergrootte - 2), color: '#8a8784' }}>{b.merk.trim()}</p>}
          {b.toonPrijs && b.prijs !== null && b.prijs > 0 && (
            <p style={{ margin: '4px 0 0', fontWeight: 700, color: kleur }}>
              {euro(b.prijs)} <span style={{ fontWeight: 400, color: '#8a8784', fontSize: Math.max(10, b.stijl.lettergrootte - 3) }}>excl. btw</span>
            </p>
          )}
          {b.link.trim() && b.knopTekst.trim() && (
            <p style={{ margin: '6px 0 0' }}>
              <span style={{ color: inst.linkkleur, textDecoration: 'underline', fontWeight: 700 }}>{b.knopTekst.trim()}</span>
            </p>
          )}
        </div>
      );
    }

    case 'webversie':
      return (
        <div style={celStijl(b.stijl, inst)}>
          <span style={{ color: b.stijl.tekstkleur || inst.tekstkleur, textDecoration: 'underline' }}>{b.tekst}</span>
        </div>
      );

    case 'afmelden': {
      const kleur = b.stijl.tekstkleur || inst.tekstkleur;
      return (
        <div style={celStijl(b.stijl, inst)}>
          {b.tekst.trim() ? `${b.tekst.trim()} ` : ''}
          <span style={{ color: kleur, textDecoration: 'underline' }}>{b.linkTekst}</span>
        </div>
      );
    }
  }
}

export const BLOK_LABEL: Record<string, string> = Object.fromEntries(BLOKTYPEN.map((t) => [t.type, t.label]));

type Props = {
  blok: Blok;
  inst: Instellingen;
  kolomBreedte: number;
  geselecteerd: boolean;
  isEerste: boolean;
  isLaatste: boolean;
  dispatch: Dispatch<Actie>;
};

function BlokViewBasis({ blok, inst, kolomBreedte, geselecteerd, isEerste, isLaatste, dispatch }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const verborgen = blok.stijl.verbergen !== 'geen';

  return (
    <div
      ref={ref}
      data-blok-id={blok.id}
      className="group/blok relative"
      onClick={(e) => {
        e.stopPropagation();
        if (!geselecteerd) dispatch({ type: 'selecteer', selectie: { soort: 'blok', blokId: blok.id } });
      }}
    >
      <div className={verborgen ? 'opacity-50' : undefined}>
        <BlokInhoud blok={blok} inst={inst} kolomBreedte={kolomBreedte} dispatch={dispatch} />
      </div>

      {/* Omlijning: blauw bij selectie, licht bij aanwijzen. Ligt erboven zonder de opmaak te verschuiven. */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 z-10 ${geselecteerd ? 'ring-2 ring-inset ring-blue-600' : 'ring-inset group-hover/blok:ring-1 group-hover/blok:ring-blue-400'}`}
      />

      {(geselecteerd || verborgen) && (
        <span className="pointer-events-none absolute left-0 top-0 z-20 rounded-br bg-blue-600 px-1.5 py-0.5 font-sans text-[10px] font-bold uppercase tracking-wide text-white">
          Blok · {BLOK_LABEL[blok.type] ?? blok.type}
          {blok.stijl.verbergen === 'desktop' ? ' · alleen telefoon' : blok.stijl.verbergen === 'mobiel' ? ' · alleen computer' : ''}
        </span>
      )}

      <div
        className={`absolute right-1 top-1 z-30 items-center gap-1 font-sans ${geselecteerd ? 'flex' : 'hidden group-hover/blok:flex'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          draggable
          aria-hidden="true"
          onDragStart={(e) => {
            e.stopPropagation();
            startSleep(e, { soort: 'blok', blokId: blok.id }, ref.current);
          }}
          onDragEnd={stopSleep}
          title="Versleep dit blok"
          className="flex h-7 w-7 cursor-grab items-center justify-center rounded-md border border-blue-200 bg-white text-blue-700 shadow-sm hover:bg-blue-50 active:cursor-grabbing"
        >
          <IcoonGreep />
        </div>
        <ElementMenu
          label="Acties voor dit blok"
          items={[
            { label: 'Omhoog', icoon: <IcoonPijlOmhoog />, uit: isEerste, onClick: () => dispatch({ type: 'blokOmhoog', blokId: blok.id }) },
            { label: 'Omlaag', icoon: <IcoonPijlOmlaag />, uit: isLaatste, onClick: () => dispatch({ type: 'blokOmlaag', blokId: blok.id }) },
            { label: 'Dupliceren', icoon: <IcoonKopie />, onClick: () => dispatch({ type: 'blokDupliceren', blokId: blok.id }) },
            { label: 'Verwijderen', icoon: <IcoonPrullenbak />, gevaar: true, onClick: () => dispatch({ type: 'blokVerwijderen', blokId: blok.id }) },
          ]}
        />
      </div>
    </div>
  );
}

const BlokView = memo(BlokViewBasis);
export default BlokView;
