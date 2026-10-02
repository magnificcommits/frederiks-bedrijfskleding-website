/* eslint-disable @next/next/no-img-element -- productfoto's en logo's komen van wisselende bronnen; next/image past hier niet */
import type { ReactNode, Ref } from 'react';
import { plaatsingStijl, plaatsingTekst, type Ontwerp, type Plaatsing, type Zijde } from './ontwerp';

/**
 * De drukproef zoals de klant en de drukkerij hem zien: voor- en achterkant naast
 * elkaar, met de logo's precies op hun plek en een genummerde maatvoering eronder.
 *
 * Dit ene component wordt gebruikt in het dashboard, op het afdrukvel en op de
 * publieke goedkeurpagina, zodat alle drie exact hetzelfde beeld tonen. Het heeft
 * geen state of hooks en werkt dus zowel op de server als in de browser.
 */

export type Formaat = 'mini' | 'normaal' | 'groot' | 'afdruk';

const HOOGTE: Record<Formaat, string> = {
  mini: 'max-h-44',
  normaal: 'max-h-[460px] print:max-h-[110mm]',
  groot: 'max-h-[72vh] print:max-h-[120mm]',
  afdruk: 'max-h-[420px] print:max-h-[100mm]',
};

const PLACEHOLDER_HOOGTE: Record<Formaat, string> = {
  mini: 'h-44',
  normaal: 'h-[420px] print:h-[100mm]',
  groot: 'h-[60vh] print:h-[110mm]',
  afdruk: 'h-[380px] print:h-[95mm]',
};

const KLEUR_EXACT = { WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as const;

/** Nummer per plaatsing met maatvoering, doorlopend over voor- en achterkant. */
export function nummering(ontwerp: Ontwerp): Map<string, number> {
  const uit = new Map<string, number>();
  let n = 0;
  for (const p of [...ontwerp.voor, ...ontwerp.achter]) {
    if (plaatsingTekst(p)) uit.set(p.id, ++n);
  }
  return uit;
}

/** Nummerbolletje rechts naast een logo. */
function Marker({ p, nummer, klein }: { p: Plaatsing; nummer: number; klein?: boolean }) {
  const links = Math.min(97, Math.max(3, p.x + p.breedte / 2 + (klein ? 3 : 2.5)));
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute flex items-center justify-center rounded-full bg-amber-500 font-bold text-ink-900 ring-2 ring-white ${
        klein ? 'h-4 w-4 text-[9px]' : 'h-6 w-6 text-[12px]'
      }`}
      style={{ left: `${links}%`, top: `${p.y}%`, transform: 'translate(-50%, -50%)', ...KLEUR_EXACT }}
    >
      {nummer}
    </span>
  );
}

/**
 * Eén zijde: de foto met de logo's erop. De omlijsting is precies zo groot als de
 * foto, zodat de percentages van de plaatsingen overal hetzelfde uitvallen.
 * De editor gebruikt dit ook (met toonLogos=false en eigen, versleepbare logo's).
 */
export function ZijdeBeeld({
  afbeeldingUrl,
  plaatsingen,
  nummers,
  formaat = 'normaal',
  alt,
  toonLogos = true,
  kaderRef,
  children,
}: {
  afbeeldingUrl: string | null;
  plaatsingen: Plaatsing[];
  nummers?: Map<string, number>;
  formaat?: Formaat;
  alt: string;
  toonLogos?: boolean;
  kaderRef?: Ref<HTMLDivElement>;
  children?: ReactNode;
}) {
  return (
    <div className="flex justify-center">
      <div ref={kaderRef} className="relative inline-block max-w-full select-none align-top" style={KLEUR_EXACT}>
        {afbeeldingUrl ? (
          <img
            src={afbeeldingUrl}
            alt={alt}
            draggable={false}
            className={`block h-auto w-auto max-w-full ${HOOGTE[formaat]}`}
          />
        ) : (
          <div className={`flex aspect-[3/4] items-center justify-center rounded-lg border border-dashed border-line bg-mist text-center text-xs text-warm ${PLACEHOLDER_HOOGTE[formaat]}`}>
            <span className="px-4">Nog geen foto</span>
          </div>
        )}
        {toonLogos &&
          plaatsingen.map((p) => (
            <img key={p.id} src={p.logo_url} alt="" draggable={false} className="pointer-events-none" style={plaatsingStijl(p)} />
          ))}
        {toonLogos &&
          nummers &&
          plaatsingen.map((p) => {
            const n = nummers.get(p.id);
            return n ? <Marker key={`m-${p.id}`} p={p} nummer={n} klein={formaat === 'mini'} /> : null;
          })}
        {children}
      </div>
    </div>
  );
}

const ZIJDE_NAAM: Record<Zijde, string> = { voor: 'Voorkant', achter: 'Achterkant' };

/** De genummerde maatvoering onder de proef. */
export function Maatvoering({ ontwerp, nummers }: { ontwerp: Ontwerp; nummers: Map<string, number> }) {
  const regels = (['voor', 'achter'] as Zijde[]).flatMap((zijde) =>
    ontwerp[zijde]
      .filter((p) => nummers.has(p.id))
      .map((p) => ({ p, zijde, nummer: nummers.get(p.id) as number })),
  );
  if (regels.length === 0) return null;
  return (
    <ol className="mt-4 space-y-1.5 text-sm text-ink-800">
      {regels.map(({ p, zijde, nummer }) => (
        <li key={p.id} className="flex items-start gap-2">
          <span
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-ink-900"
            style={KLEUR_EXACT}
          >
            {nummer}
          </span>
          <span>
            <span className="font-semibold text-ink-900">{ZIJDE_NAAM[zijde]}</span> · {plaatsingTekst(p)}
          </span>
        </li>
      ))}
    </ol>
  );
}

export default function DrukproefCompositie({
  ontwerp,
  voorUrl,
  achterUrl,
  formaat = 'normaal',
  maatvoering = true,
  titel,
}: {
  ontwerp: Ontwerp;
  voorUrl: string | null;
  achterUrl: string | null;
  formaat?: Formaat;
  /** Genummerde maatvoering tonen (bolletjes op de foto plus de lijst eronder). */
  maatvoering?: boolean;
  /** Bijvoorbeeld artikelnaam en kleur, voor de alt-tekst. */
  titel?: string;
}) {
  const nummers = maatvoering ? nummering(ontwerp) : undefined;
  const zijden: Zijde[] = [];
  if (voorUrl || ontwerp.voor.length > 0 || (!achterUrl && ontwerp.achter.length === 0)) zijden.push('voor');
  if (achterUrl || ontwerp.achter.length > 0) zijden.push('achter');
  const klein = formaat === 'mini';

  return (
    <div className="drukproef-compositie">
      <div className={`grid gap-4 ${zijden.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {zijden.map((zijde) => (
          <figure key={zijde} className="min-w-0">
            <figcaption className={`mb-2 text-center font-semibold uppercase tracking-wide text-warm ${klein ? 'text-[10px]' : 'text-xs'}`}>
              {ZIJDE_NAAM[zijde]}
            </figcaption>
            <ZijdeBeeld
              afbeeldingUrl={zijde === 'voor' ? voorUrl : achterUrl}
              plaatsingen={ontwerp[zijde]}
              nummers={nummers}
              formaat={formaat}
              alt={`${ZIJDE_NAAM[zijde]}${titel ? ` van ${titel}` : ''}`}
            />
          </figure>
        ))}
      </div>
      {nummers && !klein && <Maatvoering ontwerp={ontwerp} nummers={nummers} />}
    </div>
  );
}
