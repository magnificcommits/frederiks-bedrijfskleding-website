import { kmsAdmin } from '@/lib/kms/adminClient';
import { fotosVan, isFotoUrl, schoneKleur } from '@/lib/kms/catalogus';
import { kleurKlasse } from '@/lib/kms/kleurKlasse';
import { typeVanNaam } from '@/lib/kms/prijsindicatie';

/**
 * De brug tussen de pakketsamensteller op de website en het echte assortiment.
 *
 * De samensteller werkt met kledingtypes ("polo", "werkbroek") en acht kleuren.
 * Hier zoeken we de echte artikelen die daarbij horen, met de foto in precies
 * die kleur. Zo ziet de bezoeker zijn logo op een echt kledingstuk in de kleur
 * die hij koos, en komt de aanvraag binnen met een concreet artikel.
 *
 * Bewust geen prijzen: die zijn alleen voor ingelogde klanten (zie
 * /api/assortiment/prijs). Hier komt naam, merk, kleur en foto uit, meer niet.
 */

const CATEGORIE_PER_TYPE: Record<string, string[]> = {
  tshirt: ["T-shirts & polo's"],
  polo: ["T-shirts & polo's"],
  sweater: ['Truien & vesten'],
  softshell: ['Jassen'],
  winterjas: ['Jassen'],
  bodywarmer: ['Bodywarmers', 'Jassen'],
  werkbroek: ['Broeken'],
};

/** Standaardtype per categorie, voor artikelen waarvan de naam niets zegt ("Cordura Tech Vest"). */
const TYPE_PER_CATEGORIE: Record<string, string> = {
  'Truien & vesten': 'sweater',
  Bodywarmers: 'bodywarmer',
  Broeken: 'werkbroek',
  Jassen: 'winterjas',
};

export type CatalogusArtikel = {
  id: string;
  naam: string;
  merk: string | null;
  /** Foto in de gekozen kleur (of de hoofdfoto als er geen kleur gekozen is). */
  foto: string | null;
  /** De kleur zoals de leverancier hem noemt, opgeschoond ("Marine/zwart"). */
  kleur: string | null;
  kleurTreffer: boolean;
};

export type ArtikelRij = {
  id: string;
  naam: string;
  merk: string | null;
  categorie: string | null;
  afbeeldingen: string[] | null;
  product_kleur_afbeeldingen: { kleur: string | null; afbeelding_url: string | null }[] | null;
};

/** Kledingtype van een artikel: een bodywarmer blijft een bodywarmer, ook als er "softshell" in de naam staat. */
export function typeVanArtikel(naam: string, categorie: string | null): string | null {
  if (categorie === 'Bodywarmers') return 'bodywarmer';
  if (categorie === 'Korte broeken') return null;
  return typeVanNaam(naam) ?? (categorie ? TYPE_PER_CATEGORIE[categorie] ?? null : null);
}

const isDames = (naam: string) => /dames|lady|ladies|women|woman/i.test(naam);

/**
 * Pure selectie, apart te testen. Met een kleur: alleen artikelen die we in die
 * kleur met een foto hebben. Liever niets tonen dan een zwarte jas als iemand
 * marineblauw koos; de samensteller valt dan terug op de tekening in die kleur.
 */
export function kiesVoorType(rijen: ArtikelRij[], type: string, kleurNaam?: string, limiet = 10): CatalogusArtikel[] {
  const gezien = new Set<string>();
  const uit: (CatalogusArtikel & { dames: boolean })[] = [];
  for (const p of rijen) {
    if (typeVanArtikel(p.naam, p.categorie) !== type) continue;
    const sleutel = `${p.merk ?? ''}|${p.naam}`.toLowerCase();
    if (gezien.has(sleutel)) continue;

    const kleurFotos = (p.product_kleur_afbeeldingen ?? []).filter((k) => k.kleur && isFotoUrl((k.afbeelding_url ?? '').trim()));
    let foto: string | null = null;
    let kleur: string | null = null;
    if (kleurNaam) {
      const treffer = kleurFotos.find((k) => kleurKlasse(k.kleur) === kleurNaam);
      if (!treffer) continue;
      foto = treffer.afbeelding_url!.trim();
      kleur = schoneKleur(treffer.kleur!);
    } else {
      foto = fotosVan(p.afbeeldingen)[0] ?? (kleurFotos[0]?.afbeelding_url?.trim() || null);
    }
    if (!foto) continue;
    gezien.add(sleutel);
    uit.push({ id: p.id, naam: p.naam, merk: p.merk, foto, kleur, kleurTreffer: !!kleurNaam, dames: isDames(p.naam) });
  }
  // Herenmodellen en uniseks eerst, en de merken om en om, zodat de rij niet
  // tien varianten van hetzelfde merk laat zien.
  const gesorteerd = uit.sort((a, b) => Number(a.dames) - Number(b.dames) || a.naam.localeCompare(b.naam, 'nl'));
  const perMerk = new Map<string, typeof uit>();
  for (const a of gesorteerd) {
    const k = `${Number(a.dames)}|${a.merk ?? ''}`;
    if (!perMerk.has(k)) perMerk.set(k, []);
    perMerk.get(k)!.push(a);
  }
  const lijst: typeof uit = [];
  for (const dames of [0, 1]) {
    const groepen = [...perMerk].filter(([k]) => k.startsWith(`${dames}|`)).map(([, v]) => v);
    for (let i = 0; groepen.some((g) => g[i]); i++) for (const g of groepen) if (g[i]) lijst.push(g[i]);
  }
  return lijst.slice(0, limiet).map(({ dames: _d, ...a }) => a);
}

export async function artikelenVoorType(type: string, kleurNaam?: string, limiet = 10): Promise<CatalogusArtikel[]> {
  const categorieen = CATEGORIE_PER_TYPE[type];
  if (!categorieen) return [];
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data } = await sb
    .from('producten')
    .select('id, naam, merk, categorie, afbeeldingen, product_kleur_afbeeldingen(kleur, afbeelding_url)')
    .eq('actief', true)
    .in('categorie', categorieen);
  return kiesVoorType((data as ArtikelRij[]) ?? [], type, kleurNaam, limiet);
}
