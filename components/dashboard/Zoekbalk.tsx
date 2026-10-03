import LiveZoekveld from './LiveZoekveld';

/**
 * Zoekveld voor een lijstscherm met de zoekterm in `?zoek=`. Zoekt live terwijl
 * je typt (zie LiveZoekveld): de URL wordt bijgewerkt, de lijst ververst
 * server-side, en status, sortering en andere filters blijven staan. De
 * paginering gaat terug naar pagina 1.
 *
 * `waarde` en `bewaar` worden niet meer gebruikt: LiveZoekveld leest de
 * zoekterm en de andere filters zelf uit de URL. Ze blijven in de props zodat
 * bestaande aanroepen ongewijzigd werken.
 */
export default function Zoekbalk(props: {
  waarde?: string;
  placeholder: string;
  bewaar?: Record<string, string | undefined>;
  breedte?: string;
}) {
  return <LiveZoekveld param="zoek" placeholder={props.placeholder} breedte={props.breedte ?? 'w-72'} />;
}
