import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * "Team en toegang" is samengevoegd met "Medewerkers": één scherm voor personen,
 * maten, budget én login/toegang. Oude links naar /portaal/team gaan daarom door
 * naar /portaal/medewerkers. De detailpagina /portaal/team/[id] (budget- en
 * maatinstellingen) blijft bestaan en wordt vanuit dat overzicht gelinkt.
 */
export default function TeamPagina() {
  redirect('/portaal/medewerkers');
}
