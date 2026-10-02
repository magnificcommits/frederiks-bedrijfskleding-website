import type { LogoPositie } from '@/lib/prospect/types';
import type { Accent } from './kleur';

/**
 * Datamodel van het voorbeeldportaal plus kleine pure helpers.
 * Geen imports met bijwerkingen: veilig voor clientcomponenten.
 */

export type MaatSoort = 'boven' | 'broek' | 'schoen' | 'handschoen' | 'een';

export const MATEN: Record<MaatSoort, string[]> = {
  boven: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'],
  broek: ['44', '46', '48', '50', '52', '54', '56', '58', '60', '62'],
  schoen: ['38', '39', '40', '41', '42', '43', '44', '45', '46', '47'],
  handschoen: ['7', '8', '9', '10', '11'],
  een: ['One size'],
};

export const MAATSOORT_LABEL: Record<MaatSoort, string> = {
  boven: 'Bovenkleding',
  broek: 'Broek',
  schoen: 'Schoenen',
  handschoen: 'Handschoenen',
  een: 'Accessoires',
};

export type DemoArtikel = {
  id: string;
  naam: string;
  merk: string | null;
  categorie: string | null;
  kleur: string | null;
  fotoUrl: string;
  /** Prijs ex btw per stuk. */
  prijs: number;
  /** True als er geen echte prijs bekend was en we een richtprijs tonen. */
  prijsIndicatie: boolean;
  logoPositie: LogoPositie;
  maatSoort: MaatSoort;
  maten: string[];
};

export type DemoAfdeling = { id: string; naam: string; buiten: boolean };

export type DemoRol = 'beheerder' | 'leidinggevende' | 'medewerker';

export type DemoMaten = Record<Exclude<MaatSoort, 'een'>, string>;

export type DemoMedewerker = {
  id: string;
  voornaam: string;
  naam: string;
  functie: string;
  afdelingId: string;
  rol: DemoRol;
  maten: DemoMaten;
  /** Jaarbudget ex btw. */
  budget: number;
  heeftLogin: boolean;
  /** Lokaal toegevoegd in deze demo. */
  nieuw?: boolean;
};

export type DemoOrderStatus = 'wacht' | 'besteld' | 'borduren' | 'bedrukken' | 'verzonden' | 'afgerond' | 'afgewezen';

export type DemoGoedkeuring = 'niet_nodig' | 'wacht' | 'goedgekeurd' | 'afgewezen';

export type DemoOrderRegel = {
  artikelId: string | null;
  naam: string;
  maat: string | null;
  kleur: string | null;
  aantal: number;
  stukprijs: number;
};

export type TrackStap = { label: string; tijd: string; klaar: boolean };

export type DemoOrder = {
  id: string;
  ordernummer: number;
  datumLabel: string;
  medewerkerId: string | null;
  aangevraagdDoor: string;
  status: DemoOrderStatus;
  goedkeuring: DemoGoedkeuring;
  /** Waarom de bestelling goedkeuring nodig heeft. */
  reden?: string;
  regels: DemoOrderRegel[];
  bedrag: number;
  trackTrace?: { vervoerder: string; code: string; verwacht: string; stappen: TrackStap[] };
  /** Telt niet mee in het kledingbudget (bijvoorbeeld de eerste set van een nieuwe collega). */
  buitenBudget?: boolean;
  /** Lokaal geplaatst tijdens het rondklikken. */
  lokaal?: boolean;
};

export type DemoDrukproef = {
  id: string;
  naam: string;
  artikelId: string;
  positie: string;
  afmeting: string;
  techniek: string;
  datumLabel: string;
};

export type DemoData = {
  token: string;
  bedrijfsnaam: string;
  logoUrl: string | null;
  plaats: string | null;
  brancheLabel: string;
  /** Functienamen die bij de branche passen (suggesties bij een nieuwe medewerker). */
  functies: string[];
  accent: Accent;
  afdelingen: DemoAfdeling[];
  medewerkers: DemoMedewerker[];
  artikelen: DemoArtikel[];
  orders: DemoOrder[];
  drukproef: DemoDrukproef | null;
  vandaagLabel: string;
};

/** Maat van een medewerker voor een bepaald artikel. */
export function maatVoor(m: Pick<DemoMedewerker, 'maten'> | null | undefined, artikel: Pick<DemoArtikel, 'maatSoort' | 'maten'>): string {
  if (artikel.maatSoort === 'een') return artikel.maten[0] ?? 'One size';
  const gewenst = m?.maten[artikel.maatSoort];
  if (gewenst && artikel.maten.includes(gewenst)) return gewenst;
  return artikel.maten[Math.floor(artikel.maten.length / 2)] ?? artikel.maten[0] ?? '';
}

/** Wat een medewerker al van het budget heeft verbruikt (goedgekeurde of niet-goedkeuringsplichtige orders). */
export function verbruiktDoor(orders: DemoOrder[], medewerkerId: string): number {
  return orders
    .filter((o) => o.medewerkerId === medewerkerId && !o.buitenBudget && o.goedkeuring !== 'wacht' && o.goedkeuring !== 'afgewezen')
    .reduce((t, o) => t + o.bedrag, 0);
}

/** Bedrag dat nog op goedkeuring wacht voor een medewerker. */
export function inAanvraagVoor(orders: DemoOrder[], medewerkerId: string): number {
  return orders.filter((o) => o.medewerkerId === medewerkerId && o.goedkeuring === 'wacht').reduce((t, o) => t + o.bedrag, 0);
}
