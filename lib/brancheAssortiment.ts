import { listPubliekeProducten, type PubliekProduct } from '@/lib/kms/catalogus';

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

type Profiel = {
  categorieen: string[];
  /** Trefwoorden die een artikel extra passend maken voor deze branche. */
  trefwoorden: RegExp;
  /** Merken die in deze branche vaak gevraagd worden; licht voordeel. */
  merken?: RegExp;
};

const PROFIELEN: Record<string, Profiel> = {
  'bouw-en-infra': {
    categorieen: ['broeken', 'jassen', 'truien-en-vesten', 't-shirts-en-polos', 'werkschoenen', 'bodywarmers'],
    trefwoorden: /werkbroek|holster|knie|stretch|softshell|hi-?vis|20471|s3|allroundwork|flexiwork|cordura/i,
    merken: /snickers|fhb|blåkläder|blaklader|hydrowear|u-?power|fristads/i,
  },
  'installatie-en-techniek': {
    categorieen: ['broeken', 't-shirts-en-polos', 'jassen', 'truien-en-vesten', 'werkschoenen'],
    trefwoorden: /service|knie|holster|esd|vlamboog|61482|multinorm|stretch|softshell|polo/i,
    merken: /snickers|fristads|u-?power|hydrowear/i,
  },
  'industrie-en-logistiek': {
    categorieen: ['broeken', 'jassen', 'overalls', 'werkschoenen', 't-shirts-en-polos'],
    trefwoorden: /overall|multinorm|vlamvertragend|hi-?vis|20471|service|s3|esd|amerikaan/i,
    merken: /hydrowear|fristads|snickers|tricorp|u-?power/i,
  },
  'horeca-en-food': {
    categorieen: ['blouses-en-overhemden', 't-shirts-en-polos', 'truien-en-vesten', 'werkschoenen'],
    trefwoorden: /schort|koks|chef|blouse|overhemd|polo|gilet|vest/i,
    merken: /xirtrum|mi-?piace|tq amsterdam|wk\.|brook taverner/i,
  },
  'zorg-en-salon': {
    categorieen: ['blouses-en-overhemden', 't-shirts-en-polos', 'broeken', 'truien-en-vesten'],
    trefwoorden: /tuniek|lab|zorg|blouse|polo|stretch|stay fresh/i,
    merken: /wk\.|mi-?piace|xirtrum/i,
  },
  'agrarisch-en-groen': {
    categorieen: ['overalls', 'jassen', 'bodywarmers', 'werkschoenen', 'broeken'],
    trefwoorden: /overall|amerikaan|winter|gevoerd|insulated|waterdicht|wp|bodywarmer|s3|laars/i,
    merken: /fhb|snickers|hydrowear|grisport|fristads/i,
  },
  'kantoor-en-retail': {
    categorieen: ['blouses-en-overhemden', 't-shirts-en-polos', 'truien-en-vesten', 'jassen'],
    trefwoorden: /blazer|kolbert|overhemd|blouse|polo|softshell|vest|trui/i,
    merken: /brook taverner|xirtrum|mi-?piace|tq amsterdam/i,
  },
  'clubs-en-verenigingen': {
    categorieen: ['t-shirts-en-polos', 'truien-en-vesten', 'jassen'],
    trefwoorden: /t-?shirt|hoodie|sweater|polo|jog/i,
    merken: /wk\.|kariban/i,
  },
};

export function heeftBrancheProfiel(brancheSlug: string): boolean {
  return brancheSlug in PROFIELEN;
}

function score(p: PubliekProduct, pr: Profiel): number {
  const tekst = `${p.naam} ${p.subcategorie ?? ''} ${p.normeringen ?? ''}`;
  let s = 0;
  if (pr.trefwoorden.test(tekst)) s += 3;
  if (pr.merken && p.merk && pr.merken.test(p.merk)) s += 2;
  // Breed leverbaar (veel maten en kleuren) is voor een team van 10 tot 75 man
  // handiger dan een artikel in drie maten.
  s += Math.min(p.maten.length, 10) / 10;
  s += Math.min(p.kleuren.length, 8) / 16;
  if (p.fotos.length > 1) s += 0.25;
  return s;
}

/**
 * Tot `max` artikelen voor een branche, om en om uit de categorieën van het
 * profiel, hoogste score eerst. Lege lijst als de catalogus niet bereikbaar is.
 */
export async function brancheArtikelen(brancheSlug: string, max = 8): Promise<PubliekProduct[]> {
  const pr = PROFIELEN[brancheSlug];
  if (!pr) return [];
  const alle = await listPubliekeProducten();
  const perCat = pr.categorieen.map((c) =>
    alle
      .filter((p) => p.categorieSlug === c)
      .map((p) => ({ p, s: score(p, pr) }))
      .sort((a, b) => b.s - a.s || a.p.naam.localeCompare(b.p.naam, 'nl'))
      .map((x) => x.p),
  );
  const gekozen: PubliekProduct[] = [];
  const gezien = new Set<string>();
  const langste = perCat.reduce((n, l) => Math.max(n, l.length), 0);
  for (let i = 0; i < langste && gekozen.length < max; i++) {
    for (const lijst of perCat) {
      const p = lijst[i];
      if (!p || gezien.has(p.id)) continue;
      gezien.add(p.id);
      gekozen.push(p);
      if (gekozen.length >= max) break;
    }
  }
  return gekozen;
}
