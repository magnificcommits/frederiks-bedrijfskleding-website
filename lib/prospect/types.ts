/**
 * Contract tussen de kennismakingspagina (QR uit de brief) en het voorbeeldportaal.
 * Beide lezen dezelfde data via haalKennismaking(token) in lib/prospect/kennismaking.ts.
 */

/** Plek van het logo op de foto, in procenten van de afbeelding (midden van het logo). */
export type LogoPositie = { x: number; y: number; breedte: number };

export type MockupArtikel = {
  productId: string;
  naam: string;
  merk: string | null;
  categorie: string | null;
  kleur: string | null;
  /** Pad onder /public (bv. /merken/fhb/Walter_Zwart_20.jpg) of absolute https-url. */
  fotoUrl: string;
  /** Verkoopprijs ex btw per stuk, null als onbekend. */
  prijs: number | null;
  /** Productpagina op de publieke site, als die bestaat. */
  url: string | null;
  logoPositie: LogoPositie;
};

export type KennismakingData = {
  prospectId: string;
  token: string;
  bedrijfsnaam: string;
  contactpersoon: string | null;
  plaats: string | null;
  branche: string | null;
  website: string | null;
  /** Logo (png/jpg/webp/svg-url). Null = we tonen de bedrijfsnaam als nette tekst op de kleding. */
  logoUrl: string | null;
  huisstijlKleur: string | null;
  artikelen: MockupArtikel[];
};
