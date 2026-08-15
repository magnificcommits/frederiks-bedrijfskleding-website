import type { ReactNode } from 'react';
import { methodes, logoposities, type Methode } from '@/content/decoratie';

/* --------------------------------------------------------------------------
 * Iconen per techniek.
 * Er zijn nog geen foto's van de bedrukkerij. Tot die er zijn, draagt elke kaart
 * een lijntekening in plaats van een grijs "foto volgt"-vlak: naald met draad,
 * warmtepers, rakel, embleem. Alles stroke="currentColor", zodat de kleur van de
 * omringende tekst geldt.
 * ----------------------------------------------------------------------- */

const svgProps = {
  viewBox: '0 0 40 40',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  className: 'h-9 w-9',
};

/** Naald met draad. */
function IconBorduren() {
  return (
    <svg {...svgProps}>
      <path d="M9 31 L29 11" />
      <path d="M9 31 l-1.5 5 l5 -1.5" />
      <circle cx="27" cy="13" r="1.8" />
      <path d="M28.5 15.5c4 2 3.5 7 -1 8.5s-5 5.5 -1.5 8" />
    </svg>
  );
}

/** Warmtepers: bovenplaat die op het kledingstuk zakt. */
function IconTransfer() {
  return (
    <svg {...svgProps}>
      <path d="M13 8h14" />
      <path d="M20 8v6" />
      <rect x="8" y="14" width="24" height="5" rx="1.5" />
      <path d="M9 30h22" />
      <rect x="5" y="30" width="30" height="4.5" rx="1.5" />
      <path d="M14 21v4 m-1.8 -1.8 l1.8 1.8 l1.8 -1.8" />
      <path d="M26 21v4 m-1.8 -1.8 l1.8 1.8 l1.8 -1.8" />
    </svg>
  );
}

/** Rakel die over het zeefraam trekt. */
function IconZeefdruk() {
  return (
    <svg {...svgProps}>
      <rect x="5" y="7" width="30" height="21" rx="1.5" />
      <path d="M8 21.5H26" strokeWidth={2.6} />
      <path d="M17 21.5 L26.5 11" />
      <path d="M23.5 9.5 L29.5 13" />
      <path d="M10 26H22" strokeDasharray="2.5 2.5" />
      <path d="M9 32H31" />
    </svg>
  );
}

/** Embleem met stiksellijn. */
function IconEmbleem() {
  return (
    <svg {...svgProps}>
      <path d="M20 6 L32 10.5v9.5c0 6.5 -5.5 10.5 -12 13.5c-6.5 -3 -12 -7 -12 -13.5V10.5Z" />
      <path d="M20 10.5 L28 13.5v6.5c0 4.5 -3.7 7.4 -8 9.4c-4.3 -2 -8 -4.9 -8 -9.4V13.5Z" strokeDasharray="2.5 2.5" />
    </svg>
  );
}

const ICONEN: Record<string, ReactNode> = {
  borduren: <IconBorduren />,
  transferdruk: <IconTransfer />,
  zeefdruk: <IconZeefdruk />,
  emblemen: <IconEmbleem />,
};

/** Vinkje: hiervoor is deze techniek de juiste keuze. */
function IconWel() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-[3px] h-4 w-4 shrink-0 text-amber-700">
      <path d="M4 10.5 8 14.5 16 5.5" />
    </svg>
  );
}

/** Kruisje: kies hier liever iets anders. */
function IconNiet() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" className="mt-[3px] h-4 w-4 shrink-0 text-ink-300">
      <path d="M5.5 5.5 14.5 14.5 M14.5 5.5 5.5 14.5" />
    </svg>
  );
}

/**
 * De vier datapunten die voor ELKE techniek in DEZELFDE volgorde gevuld zijn.
 * Dat is de kern van dit blok: de tabel hieronder is een vergelijkingsmatrix,
 * dus voeg hier niets aan toe zonder het voor alle technieken te vullen.
 */
const DATAPUNTEN: { label: string; waarde: (m: Methode) => string }[] = [
  { label: 'Vanaf', waarde: (m) => m.vanafAantal },
  { label: 'Levertijd', waarde: (m) => m.levertijd },
  { label: 'Sterkte', waarde: (m) => m.sterkte },
  { label: 'Geschikt voor', waarde: (m) => m.geschiktVoor },
];

/** Vier technieken als kaarten: 1 kolom mobiel, 2 op tablet, 4 op desktop. */
export function MethodeKaarten() {
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {methodes.map((m) => (
        <li key={m.slug} className="card flex h-full flex-col">
          <div className="flex items-center gap-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-line bg-mist text-amber-700">
              {ICONEN[m.slug]}
            </span>
            <h3 className="font-display text-lg font-extrabold text-ink-900">{m.naam}</h3>
          </div>

          <p className="mt-4 text-sm text-warm">{m.intro}</p>

          {/* Vinkje en kruisje in plaats van de labels "kies dit bij" en "liever niet bij":
              scheelt woorden, leest sneller. De labels staan sr-only voor schermlezers. */}
          <ul className="mt-auto space-y-2 pt-4 text-sm text-warm">
            <li className="flex gap-2">
              <IconWel />
              <span>
                <span className="sr-only">Kies dit bij: </span>
                {m.wanneer}
              </span>
            </li>
            <li className="flex gap-2">
              <IconNiet />
              <span>
                <span className="sr-only">Liever niet bij: </span>
                {m.nietGeschikt}
              </span>
            </li>
          </ul>
        </li>
      ))}
    </ul>
  );
}

/** Dezelfde vier datapunten, nu als tabel: in één blik de technieken naast elkaar. */
export function MethodeTabel() {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white shadow-card">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <caption className="sr-only">De vier decoratietechnieken vergeleken op aantal, levertijd, sterkte en geschiktheid</caption>
        <thead>
          <tr className="border-b border-line bg-mist">
            <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
              <span className="sr-only">Kenmerk</span>
            </th>
            {methodes.map((m) => (
              <th key={m.slug} scope="col" className="px-4 py-3 font-display text-base font-extrabold text-ink-900">
                <span className="flex items-center gap-2">
                  <span className="text-amber-700 [&_svg]:h-5 [&_svg]:w-5" aria-hidden="true">{ICONEN[m.slug]}</span>
                  {m.naam}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DATAPUNTEN.map((d) => (
            <tr key={d.label} className="border-b border-line last:border-b-0">
              <th scope="row" className="whitespace-nowrap px-4 py-3 align-top text-xs font-semibold uppercase tracking-wide text-ink-400">
                {d.label}
              </th>
              {methodes.map((m) => (
                <td key={m.slug} className="px-4 py-3 align-top text-ink-800">
                  {d.waarde(m)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------------------------------------------------------
 * Tekening van de logoposities.
 * Vervangt een alinea tekst: een shirt (voor en achter) en een broek in lijnen,
 * met genummerde stippen op de vijf posities. De nummers volgen de volgorde van
 * `logoposities` in content/decoratie.ts; de koppeling loopt via `id`.
 * ----------------------------------------------------------------------- */

type StipPlek = { paneel: 'voor' | 'achter' | 'broek'; x: number; y: number };
type StipItem = { id: string; naam: string; nr: number; plek: StipPlek };

const STIPPEN: Record<string, StipPlek | undefined> = {
  'borst-links': { paneel: 'voor', x: 106, y: 64 },
  'borst-rechts': { paneel: 'voor', x: 78, y: 64 },
  'rug-groot': { paneel: 'achter', x: 92, y: 87 },
  'pijp-links': { paneel: 'broek', x: 101, y: 140 },
  'pijp-rechts': { paneel: 'broek', x: 58, y: 140 },
};

/** Genummerde stip op een positie. Amber, met het volgnummer erin. */
function Stip({ x, y, nr }: { x: number; y: number; nr: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r="9" fill="#ec6726" stroke="none" />
      <text x={x} y={y + 3.4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#ffffff" stroke="none">
        {nr}
      </text>
    </g>
  );
}

const paneelSvg = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinejoin: 'round' as const,
  className: 'h-44 w-full text-ink-300',
};

/** Silhouet van een shirt; `achter` tekent het rugvlak in plaats van de kraag. */
function Shirt({ achter, children }: { achter?: boolean; children: ReactNode }) {
  return (
    <svg viewBox="0 0 184 150" {...paneelSvg}>
      <path
        d={
          achter
            ? 'M42 44 L66 26 L80 22 C86 28, 98 28, 104 22 L118 26 L142 44 L130 62 L120 55 L120 134 L64 134 L64 55 L54 62 Z'
            : 'M42 44 L66 26 L80 22 C86 34, 98 34, 104 22 L118 26 L142 44 L130 62 L120 55 L120 134 L64 134 L64 55 L54 62 Z'
        }
      />
      {achter && <rect x="68" y="70" width="48" height="34" rx="3" strokeDasharray="4 4" />}
      {children}
    </svg>
  );
}

/** Silhouet van een werkbroek. */
function Broek({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 160 200" {...paneelSvg}>
      <path d="M46 22 H114 L119 178 H88 L80 98 L72 178 H41 Z" />
      <path d="M46 34 H114" />
      {children}
    </svg>
  );
}

export function LogoPositieTekening() {
  const stippen: StipItem[] = logoposities.flatMap((p, i) => {
    const plek = STIPPEN[p.id];
    return plek ? [{ id: p.id, naam: p.naam, nr: i + 1, plek }] : [];
  });
  const voor = stippen.filter((s) => s.plek.paneel === 'voor');
  const achter = stippen.filter((s) => s.plek.paneel === 'achter');
  const broek = stippen.filter((s) => s.plek.paneel === 'broek');

  const panelen: { kop: string; svg: ReactNode }[] = [
    {
      kop: 'Shirt voorkant',
      svg: <Shirt>{voor.map((s) => <Stip key={s.id} x={s.plek.x} y={s.plek.y} nr={s.nr} />)}</Shirt>,
    },
    {
      kop: 'Shirt achterkant',
      svg: <Shirt achter>{achter.map((s) => <Stip key={s.id} x={s.plek.x} y={s.plek.y} nr={s.nr} />)}</Shirt>,
    },
    {
      kop: 'Broek',
      svg: <Broek>{broek.map((s) => <Stip key={s.id} x={s.plek.x} y={s.plek.y} nr={s.nr} />)}</Broek>,
    },
  ];

  return (
    <figure className="rounded-lg border border-line bg-white p-6 shadow-card">
      <div className="grid gap-6 sm:grid-cols-3">
        {panelen.map((p) => (
          <div key={p.kop}>
            {p.svg}
            <p className="mt-2 text-center text-xs font-semibold uppercase tracking-wide text-ink-400">{p.kop}</p>
          </div>
        ))}
      </div>
      <figcaption className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-4">
        {stippen.map((s) => (
          <span key={s.id} className="flex items-center gap-2 text-sm text-ink-800">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-white">
              {s.nr}
            </span>
            {s.naam}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
