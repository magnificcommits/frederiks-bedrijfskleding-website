import type { ReactNode } from 'react';
import Kruimelpad from './Kruimelpad';
import type { NavItem } from '../navigatie';

/**
 * De vaste kop van een dashboardpagina: kruimelpad, titel, eventueel een
 * subregel of aantal, en rechts de acties. Eén vorm voor elke pagina, zodat
 * de primaire knop altijd op dezelfde plek staat.
 *
 * - `kruimels`: true = automatisch uit de URL; een lijst = eigen stappen.
 * - `aantal`: klein getal naast de titel (bijv. aantal orders).
 * - `acties`: knoppen rechts; de primaire actie als laatste.
 */
export default function PaginaKop({
  titel,
  sub,
  aantal,
  kruimels = false,
  acties,
  children,
}: {
  titel: ReactNode;
  sub?: ReactNode;
  aantal?: ReactNode;
  kruimels?: boolean | NavItem[];
  acties?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="dash-kop justify-between gap-x-4">
      <div className="min-w-0">
        {kruimels && <Kruimelpad items={Array.isArray(kruimels) ? kruimels : undefined} />}
        <div className="flex flex-wrap items-baseline gap-x-2.5">
          <h1 className="dash-h1">{titel}</h1>
          {aantal != null && <span className="text-[13px] tabular-nums text-warm">{aantal}</span>}
        </div>
        {sub && <p className="dash-sub mt-0.5">{sub}</p>}
      </div>
      {acties && <div className="flex flex-wrap items-center gap-1.5">{acties}</div>}
      {children}
    </div>
  );
}
