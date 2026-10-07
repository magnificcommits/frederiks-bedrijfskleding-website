import { listPubliekeProducten, type PubliekProduct } from '@/lib/kms/catalogus';
import { PROFIELEN, kiesArtikelen } from '@/lib/assortimentProfielen';

/**
 * Artikelen uit de echte KMS-catalogus die bij een branche passen.
 *
 * Eerlijk over wat dit is: een selectie, geen verkooptop. In de database staan
 * (oktober 2026) te weinig orderregels om "meest besteld per branche" te kunnen
 * zeggen zonder te liegen. Daarom heet het blok op de site "Uit ons assortiment
 * voor ..." en niet "Populair bij ...". Zodra er genoeg bestellingen per branche
 * zijn, kan de score hieronder vervangen worden door een telling op orderregels
 * (geaggregeerd, zonder klantnamen).
 *
 * Werkwijze: één catalogusquery (de pagina draait op ISR), daarna filteren op
 * categorie en scoren op trefwoorden in naam, soort en normering. Per categorie
 * om en om kiezen, zodat je niet acht broeken op een rij ziet.
 *
 * Levertijd en voorraad tonen we hier bewust niet: de voorraad wordt in het KMS
 * per artikel alleen bijgehouden als `voorraad_bijhouden` aan staat, en dat geldt
 * nog voor een klein deel. Een "op voorraad" die niet klopt kost meer dan hij oplevert.
 */

/**
 * Sinds 7 okt 2026 staan de regels per branche in lib/assortimentProfielen.ts,
 * samen met die van de vakpagina's: alleen artikelen die aantoonbaar passen,
 * nooit aanvullen met willekeurige artikelen.
 */
export function heeftBrancheProfiel(brancheSlug: string): boolean {
  return `branche:${brancheSlug}` in PROFIELEN;
}

export async function brancheArtikelen(brancheSlug: string, max = 8): Promise<PubliekProduct[]> {
  const pr = PROFIELEN[`branche:${brancheSlug}`];
  if (!pr) return [];
  return kiesArtikelen(await listPubliekeProducten(), pr, max);
}
