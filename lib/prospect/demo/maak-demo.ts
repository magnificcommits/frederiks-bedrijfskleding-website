import type { KennismakingData } from '@/lib/prospect/types';
import { brancheProfiel } from './branche';
import { maakAccent } from './kleur';
import { maakRng, type Rng } from './seed';
import {
  MATEN,
  maatVoor,
  verbruiktDoor,
  type DemoAfdeling,
  type DemoArtikel,
  type DemoData,
  type DemoDrukproef,
  type DemoMaten,
  type DemoMedewerker,
  type DemoOrder,
  type DemoOrderRegel,
  type MaatSoort,
} from './model';

export type { DemoData } from './model';

/**
 * Deterministische nepdata voor het voorbeeldportaal. Alles is verzonnen:
 * fictieve voornamen met een achternaam-initiaal, geen echte personen.
 * Pure functie (geen IO). Clientcode importeert alleen ./model.
 */

const VOORNAMEN = [
  'Sanne', 'Lisa', 'Femke', 'Anouk', 'Eva', 'Iris', 'Lotte', 'Noor', 'Marieke', 'Esther', 'Ilse', 'Kim', 'Hanna', 'Mirjam',
  'Daan', 'Bram', 'Luuk', 'Thijs', 'Jeroen', 'Niels', 'Ruben', 'Stijn', 'Bas', 'Joost', 'Wouter', 'Gert', 'Henk', 'Erik',
  'Mark', 'Rick', 'Sem', 'Koen', 'Martijn', 'Dennis', 'Gijs', 'Jasper', 'Wessel', 'Freek', 'Teun', 'Harm', 'Arjen', 'Rens',
] as const;

const INITIALEN = ['B', 'D', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'O', 'R', 'S', 'T', 'V', 'W', 'Z'] as const;

const BOVENMATEN = ['S', 'M', 'M', 'L', 'L', 'L', 'XL', 'XL', 'XXL', '3XL'] as const;
const BROEK_BIJ_BOVEN: Record<string, string[]> = {
  S: ['46', '48'],
  M: ['48', '50'],
  L: ['50', '52'],
  XL: ['54', '56'],
  XXL: ['56', '58'],
  '3XL': ['58', '60'],
};

function bevat(tekst: string, woorden: string[]): boolean {
  return woorden.some((w) => tekst.includes(w));
}

function maatSoortVoor(naam: string, categorie: string | null): MaatSoort {
  const t = `${categorie ?? ''} ${naam}`.toLowerCase();
  if (bevat(t, ['handschoen'])) return 'handschoen';
  if (bevat(t, ['schoen', 'laars', 'klomp', 'sneaker', 'sandaal'])) return 'schoen';
  if (bevat(t, ['broek', 'short', 'overall', 'amerikaan', 'jeans', 'tuinbroek', 'rok'])) return 'broek';
  if (bevat(t, [' pet', 'pet ', 'cap', 'muts', 'beanie', 'sjaal', 'schort', 'tas', 'bril', 'helm'])) return 'een';
  return 'boven';
}

function richtprijs(naam: string, categorie: string | null, soort: MaatSoort): number {
  const t = `${categorie ?? ''} ${naam}`.toLowerCase();
  if (soort === 'schoen') return 94.95;
  if (soort === 'broek') return bevat(t, ['short']) ? 44.95 : 59.95;
  if (soort === 'handschoen') return 9.95;
  if (soort === 'een') return 14.95;
  if (bevat(t, ['parka', 'winterjas', 'jas', 'jack', 'softshell'])) return 74.95;
  if (bevat(t, ['trui', 'sweater', 'hoodie', 'vest', 'fleece'])) return 39.95;
  if (bevat(t, ['polo'])) return 24.95;
  if (bevat(t, ['t-shirt', 'shirt'])) return 14.95;
  return 34.95;
}

function datumLabel(nu: Date, dagenGeleden: number): string {
  const d = new Date(nu.getTime() - dagenGeleden * 86_400_000);
  return new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' }).format(d);
}

function kortDatum(nu: Date, dagenVerschil: number): string {
  const d = new Date(nu.getTime() + dagenVerschil * 86_400_000);
  return new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' }).format(d);
}

function maakMaten(rng: Rng): DemoMaten {
  const boven = rng.pick(BOVENMATEN);
  return {
    boven,
    broek: rng.pick(BROEK_BIJ_BOVEN[boven] ?? ['52']),
    schoen: String(rng.int(39, 46)),
    handschoen: String(rng.int(8, 11)),
  };
}


const GENERIEKE_ARTIKELEN: { naam: string; soort: MaatSoort; prijs: number }[] = [
  { naam: 'Werkjas met logo', soort: 'boven', prijs: 74.95 },
  { naam: 'Polo met logo', soort: 'boven', prijs: 24.95 },
  { naam: 'Werkbroek', soort: 'broek', prijs: 59.95 },
];



export function maakDemo(k: KennismakingData, nu: Date = new Date()): DemoData {
  const rng = maakRng(`fb-demo:${k.token}`);
  const profiel = brancheProfiel(k.branche);

  // Artikelen uit de kennismaking, aangevuld met maten en een prijs.
  const artikelen: DemoArtikel[] = k.artikelen.map((a, i) => {
    const soort = maatSoortVoor(a.naam, a.categorie);
    const echtePrijs = a.prijs != null && Number.isFinite(a.prijs) && a.prijs > 0 ? Math.round(a.prijs * 100) / 100 : null;
    return {
      id: a.productId || `art-${i + 1}`,
      naam: a.naam,
      merk: a.merk,
      categorie: a.categorie,
      kleur: a.kleur,
      fotoUrl: a.fotoUrl,
      prijs: echtePrijs ?? richtprijs(a.naam, a.categorie, soort),
      prijsIndicatie: echtePrijs == null,
      logoPositie: a.logoPositie,
      maatSoort: soort,
      maten: MATEN[soort],
    };
  });

  // Afdelingen en medewerkers.
  const afdelingen: DemoAfdeling[] = profiel.afdelingen.map((a, i) => ({ id: `afd-${i + 1}`, naam: a.naam, buiten: a.buiten }));
  const aantal = rng.int(6, 8);
  const aantalB = aantal >= 8 ? 3 : 2;
  const aantalA = aantal - aantalB;
  const namen = rng.shuffle(VOORNAMEN).slice(0, aantal);
  const medewerkers: DemoMedewerker[] = namen.map((voornaam, i) => {
    const inA = i < aantalA;
    const afdIndex = inA ? 0 : 1;
    const afd = profiel.afdelingen[afdIndex];
    const leidinggevende = i === 0 || i === aantalA;
    const budgetVariatie = afd.buiten ? rng.pick([0, 0, 50, -50]) : rng.pick([0, 0, 30]);
    return {
      id: `mw-${i + 1}`,
      voornaam,
      naam: `${voornaam} ${rng.pick(INITIALEN)}.`,
      functie: leidinggevende ? afd.leidinggevendeFunctie : rng.pick(afd.functies),
      afdelingId: `afd-${afdIndex + 1}`,
      rol: leidinggevende ? 'leidinggevende' : 'medewerker',
      maten: maakMaten(rng),
      budget: Math.max(100, afd.budget + budgetVariatie),
      heeftLogin: leidinggevende || rng.next() < 0.5,
    };
  });

  // Regels voor nepbestellingen.
  const bron = artikelen.length > 0 ? artikelen : null;
  const maakRegel = (mw: DemoMedewerker, index: number, aantalStuks: number): DemoOrderRegel => {
    if (bron) {
      const a = bron[index % bron.length] as DemoArtikel;
      return { artikelId: a.id, naam: a.naam, maat: maatVoor(mw, a), kleur: a.kleur, aantal: aantalStuks, stukprijs: a.prijs };
    }
    const g = GENERIEKE_ARTIKELEN[index % GENERIEKE_ARTIKELEN.length] as (typeof GENERIEKE_ARTIKELEN)[number];
    const maat = g.soort === 'een' ? 'One size' : mw.maten[g.soort];
    return { artikelId: null, naam: g.naam, maat, kleur: null, aantal: aantalStuks, stukprijs: g.prijs };
  };
  const som = (regels: DemoOrderRegel[]) => Math.round(regels.reduce((t, r) => t + r.aantal * r.stukprijs, 0) * 100) / 100;

  const mwA = medewerkers.filter((m) => m.afdelingId === 'afd-1');
  const mwB = medewerkers.filter((m) => m.afdelingId === 'afd-2');
  const leidA = mwA[0] as DemoMedewerker;
  const kies = (lijst: DemoMedewerker[], skip = 0) => lijst[(skip % Math.max(1, lijst.length - 1)) + 1] ?? lijst[0] ?? leidA;

  const ordernummer = rng.int(24100, 25800);
  const orders: DemoOrder[] = [];
  const startIdx = rng.int(0, 5);

  // Openstaande goedkeuring (vandaag).
  {
    const mw = kies(mwA, rng.int(0, 3));
    const regels = [maakRegel(mw, startIdx, 1), maakRegel(mw, startIdx + 1, 2)];
    orders.push({
      id: 'o-wacht',
      ordernummer: ordernummer + 9,
      datumLabel: datumLabel(nu, 0),
      medewerkerId: mw.id,
      aangevraagdDoor: mw.naam,
      status: 'wacht',
      goedkeuring: 'wacht',
      reden: rng.pick([
        'Extra set voor de winterperiode',
        'Oude jas is versleten',
        'Valt buiten het standaardpakket',
      ]),
      regels,
      bedrag: som(regels),
    });
  }

  // In productie (gisteren).
  {
    const mw = kies(mwB.length ? mwB : mwA, rng.int(0, 2));
    const regels = [maakRegel(mw, startIdx + 2, 1)];
    const techniek = rng.next() < 0.5 ? 'borduren' : 'bedrukken';
    orders.push({
      id: 'o-productie',
      ordernummer: ordernummer + 7,
      datumLabel: datumLabel(nu, 1),
      medewerkerId: mw.id,
      aangevraagdDoor: mw.naam,
      status: techniek,
      goedkeuring: 'niet_nodig',
      regels,
      bedrag: som(regels),
    });
  }

  // Verzonden met track & trace.
  {
    const mw = kies(mwA, rng.int(1, 4));
    const regels = [maakRegel(mw, startIdx + 3, 2), maakRegel(mw, startIdx + 4, 1)];
    const code = `3SFRB${rng.int(1000000, 9999999)}`;
    orders.push({
      id: 'o-verzonden',
      ordernummer: ordernummer + 5,
      datumLabel: datumLabel(nu, rng.int(3, 5)),
      medewerkerId: mw.id,
      aangevraagdDoor: leidA.naam,
      status: 'verzonden',
      goedkeuring: 'goedgekeurd',
      regels,
      bedrag: som(regels),
      trackTrace: {
        vervoerder: 'PostNL',
        code,
        verwacht: `${kortDatum(nu, 1)}, tussen 10:15 en 12:45`,
        stappen: [
          { label: 'Bestelling ontvangen door Frederiks', tijd: datumLabel(nu, 5), klaar: true },
          { label: 'Logo aangebracht en gecontroleerd', tijd: datumLabel(nu, 2), klaar: true },
          { label: 'Ingepakt en aangemeld bij PostNL', tijd: datumLabel(nu, 1), klaar: true },
          { label: 'Onderweg naar jullie adres', tijd: 'vandaag', klaar: true },
          { label: 'Bezorgd', tijd: 'verwacht morgen', klaar: false },
        ],
      },
    });
  }

  // Afgeronde bestelling (nieuwe collega, startpakket).
  {
    const mw = medewerkers[medewerkers.length - 1] as DemoMedewerker;
    const regels = [maakRegel(mw, startIdx, 2), maakRegel(mw, startIdx + 1, 2), maakRegel(mw, startIdx + 2, 1)];
    orders.push({
      id: 'o-afgerond-1',
      ordernummer: ordernummer + 2,
      datumLabel: datumLabel(nu, rng.int(35, 55)),
      medewerkerId: mw.id,
      aangevraagdDoor: leidA.naam,
      status: 'afgerond',
      goedkeuring: 'goedgekeurd',
      reden: 'Eerste kledingset nieuwe collega',
      buitenBudget: true,
      regels,
      bedrag: som(regels),
    });
  }

  // Soms nog een oudere afgeronde bestelling.
  if (rng.next() < 0.6) {
    const mw = leidA;
    const regels = [maakRegel(mw, startIdx + 3, 1)];
    orders.push({
      id: 'o-afgerond-2',
      ordernummer,
      datumLabel: datumLabel(nu, rng.int(80, 120)),
      medewerkerId: mw.id,
      aangevraagdDoor: mw.naam,
      status: 'afgerond',
      goedkeuring: 'niet_nodig',
      regels,
      bedrag: som(regels),
    });
  }

  // Budget altijd ruim genoeg na de eerdere bestellingen, zodat de demo er gezond uitziet.
  for (const mw of medewerkers) {
    const verbruikt = verbruiktDoor(orders, mw.id);
    if (mw.budget - verbruikt < 75) mw.budget = Math.ceil((verbruikt + 125) / 50) * 50;
  }

  // Drukproef: bij voorkeur een bovenkledingstuk.
  const proefArtikel = artikelen.find((a) => a.maatSoort === 'boven') ?? artikelen[0] ?? null;
  let drukproef: DemoDrukproef | null = null;
  if (proefArtikel) {
    const p = proefArtikel.logoPositie;
    const rug = p.breedte >= 30;
    const positie = rug ? 'Rug, gecentreerd' : p.x >= 50 ? 'Linkerborst' : 'Rechterborst';
    const naam = proefArtikel.naam.toLowerCase();
    const techniek = rug || bevat(naam, ['t-shirt', 'shirt', 'hesje', 'vest rws', 'signal']) ? 'Transferdruk' : 'Borduren';
    drukproef = {
      id: 'dp-1',
      naam: `Logo ${k.bedrijfsnaam} op ${proefArtikel.naam}`,
      artikelId: proefArtikel.id,
      positie,
      afmeting: rug ? '25 x 12 cm' : '8 x 4 cm',
      techniek,
      datumLabel: datumLabel(nu, 0),
    };
  }

  return {
    token: k.token,
    bedrijfsnaam: k.bedrijfsnaam,
    logoUrl: k.logoUrl,
    plaats: k.plaats,
    brancheLabel: profiel.label,
    functies: [...new Set(profiel.afdelingen.flatMap((a) => [a.leidinggevendeFunctie, ...a.functies]))],
    accent: maakAccent(k.huisstijlKleur),
    afdelingen,
    medewerkers,
    artikelen,
    orders,
    drukproef,
    vandaagLabel: datumLabel(nu, 0),
  };
}
