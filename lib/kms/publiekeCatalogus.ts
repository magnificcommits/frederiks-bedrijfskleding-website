import { kmsAdmin } from '@/lib/kms/adminClient';
import { fotosVan } from '@/lib/kms/catalogus';

/**
 * De brug tussen de pakketsamensteller op de website en het echte assortiment.
 *
 * De configurator werkt met generieke kledingtypes ("polo", "werkbroek"); het
 * KMS heeft 506 echte artikelen in elf categorieën. Deze module vertaalt het
 * een naar het ander, zodat een aanvraag binnenkomt met een concreet artikel
 * in plaats van "polo, blauw" — dan hoeft Frederiks niet meer te raden.
 *
 * Bewust géén webshop en géén prijzen: prijzen zijn alleen zichtbaar voor
 * ingelogde klanten (zie /api/assortiment/prijs). Hier komt naam, merk en foto
 * uit, meer niet. Advies en passen op locatie blijven het verhaal.
 */

/** Kledingtype uit content/configurator.ts -> categorie in de producttabel. */
const CATEGORIE_PER_TYPE: Record<string, string[]> = {
  tshirt: ["T-shirts & polo's"],
  polo: ["T-shirts & polo's"],
  sweater: ['Truien & vesten'],
  softshell: ['Jassen'],
  winterjas: ['Jassen'],
  bodywarmer: ['Bodywarmers'],
  werkbroek: ['Broeken', 'Korte broeken'],
  schoenen: ['Werkschoenen'],
  accessoires: ['Accessoires'],
};

/**
 * Kleurnamen uit de configurator -> trefwoorden zoals ze in de variantkleuren
 * voorkomen. Het assortiment mengt Nederlands, Engels en leverancierscodes
 * ("9504 - navy\black", "marine/zwart 1620"), dus dit is een zachte voorkeur:
 * matcht er niets, dan tonen we gewoon de andere artikelen uit de categorie.
 */
const KLEURWOORDEN: Record<string, string[]> = {
  Zwart: ['zwart', 'black'],
  Marineblauw: ['marine', 'navy'],
  Antraciet: ['antraciet', 'anthracite', 'charcoal', 'dark grey', 'steel grey'],
  Grijs: ['grijs', 'grey', 'gray'],
  Wit: ['wit', 'white'],
  Groen: ['groen', 'green', 'khaki', 'olijf', 'olive'],
  'Hi-vis geel': ['geel', 'yellow', 'hi-vis', 'hivis', 'fluor'],
  'Hi-vis oranje': ['oranje', 'orange', 'hi-vis', 'hivis', 'fluor'],
};

export type CatalogusArtikel = {
  id: string;
  naam: string;
  merk: string | null;
  foto: string | null;
  kleurTreffer: boolean;
};

export async function artikelenVoorType(type: string, kleurNaam?: string, limiet = 6): Promise<CatalogusArtikel[]> {
  const categorieen = CATEGORIE_PER_TYPE[type];
  if (!categorieen) return [];
  const sb = kmsAdmin();
  if (!sb) return [];

  const { data } = await sb
    .from('producten')
    .select('id, naam, merk, afbeeldingen, product_varianten(kleur)')
    .eq('actief', true)
    .in('categorie', categorieen)
    .limit(120);

  type Rij = {
    id: string; naam: string; merk: string | null; afbeeldingen: string[] | null;
    product_varianten: { kleur: string | null }[] | null;
  };
  const woorden = (kleurNaam && KLEURWOORDEN[kleurNaam]) || [];

  const artikelen: CatalogusArtikel[] = ((data as Rij[]) ?? []).map((p) => {
    const varianten = p.product_varianten ?? [];
    const kleurTreffer = woorden.length
      ? varianten.some((v) => {
          const k = (v.kleur ?? '').toLowerCase();
          return woorden.some((w) => k.includes(w));
        })
      : false;
    return {
      id: p.id,
      naam: p.naam,
      merk: p.merk,
      foto: fotosVan(p.afbeeldingen)[0] ?? null,
      kleurTreffer,
    };
  });

  // Foto weegt zwaarder dan de kleurtreffer. Zonder die volgorde komen op
  // 'polo, marineblauw' zes FHB-artikelen bovendrijven die wél navy hebben maar
  // géén afbeelding (van de 92 productfoto's die ontbreken zijn er 50 van FHB) —
  // een suggestiekaart zonder plaatje overtuigt niemand.
  const metFoto = artikelen.filter((a) => a.foto);
  const bruikbaar = metFoto.length >= 3 ? metFoto : artikelen;
  bruikbaar.sort((a, b) =>
    Number(!!b.foto) - Number(!!a.foto) ||
    Number(b.kleurTreffer) - Number(a.kleurTreffer) ||
    a.naam.localeCompare(b.naam, 'nl'),
  );
  return bruikbaar.slice(0, limiet);
}
