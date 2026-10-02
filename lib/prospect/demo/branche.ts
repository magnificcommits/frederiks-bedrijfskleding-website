import { brancheGroep, type BrancheGroep } from '@/content/kennismaking';

/**
 * Branche-profielen voor het voorbeeldportaal: twee afdelingen met passende functies
 * en een realistisch jaarbudget voor kleding per persoon. De indeling volgt dezelfde
 * branchegroepen als de kennismakingspagina (brancheGroep in content/kennismaking.ts).
 */

export type AfdelingProfiel = {
  naam: string;
  functies: string[];
  leidinggevendeFunctie: string;
  /** Jaarbudget per persoon in euro ex btw. */
  budget: number;
  /** Buitenwerk = meer kleding en hoger budget. */
  buiten: boolean;
};

export type BrancheProfiel = {
  label: string;
  afdelingen: [AfdelingProfiel, AfdelingProfiel];
};

const kantoor = (leiding: string, functies: string[] = ['Werkvoorbereider', 'Planner', 'Medewerker binnendienst']): AfdelingProfiel => ({
  naam: 'Kantoor',
  functies,
  leidinggevendeFunctie: leiding,
  budget: 150,
  buiten: false,
});

const PROFIELEN: Record<BrancheGroep, BrancheProfiel> = {
  installatie: {
    label: 'Installatietechniek',
    afdelingen: [
      { naam: 'Service en montage', functies: ['Monteur', 'Servicemonteur', 'Eerste monteur', 'Leerling-monteur'], leidinggevendeFunctie: 'Chef monteur', budget: 350, buiten: true },
      kantoor('Bedrijfsleider', ['Werkvoorbereider', 'Planner', 'Calculator']),
    ],
  },
  bouw: {
    label: 'Bouw',
    afdelingen: [
      { naam: 'Bouwplaats', functies: ['Timmerman', 'Metselaar', 'Allround vakman', 'Leerling-timmerman'], leidinggevendeFunctie: 'Uitvoerder', budget: 400, buiten: true },
      kantoor('Projectleider', ['Werkvoorbereider', 'Calculator', 'Projectassistent']),
    ],
  },
  dakdekker: {
    label: 'Dakdekkers',
    afdelingen: [
      { naam: 'Dakploeg', functies: ['Dakdekker', 'Allround dakdekker', 'Leerling-dakdekker'], leidinggevendeFunctie: 'Voorman', budget: 400, buiten: true },
      kantoor('Bedrijfsleider', ['Calculator', 'Planner']),
    ],
  },
  schilder: {
    label: 'Schildersbedrijf',
    afdelingen: [
      { naam: 'Schilders', functies: ['Schilder', 'Allround schilder', 'Leerling-schilder'], leidinggevendeFunctie: 'Voorman', budget: 300, buiten: true },
      kantoor('Bedrijfsleider', ['Calculator', 'Planner']),
    ],
  },
  metaal: {
    label: 'Metaal en industrie',
    afdelingen: [
      { naam: 'Productie', functies: ['Lasser', 'CNC-operator', 'Constructiebankwerker', 'Productiemedewerker'], leidinggevendeFunctie: 'Teamleider productie', budget: 350, buiten: true },
      kantoor('Bedrijfsleider', ['Werkvoorbereider', 'Tekenaar', 'Inkoper']),
    ],
  },
  hovenier: {
    label: 'Hovenier en infra',
    afdelingen: [
      { naam: 'Buitendienst', functies: ['Hovenier', 'Medewerker groen', 'Machinist'], leidinggevendeFunctie: 'Voorman', budget: 350, buiten: true },
      { naam: 'Werkplaats', functies: ['Monteur', 'Werkplaatsmedewerker'], leidinggevendeFunctie: 'Chef werkplaats', budget: 250, buiten: true },
    ],
  },
  transport: {
    label: 'Transport en logistiek',
    afdelingen: [
      { naam: 'Chauffeurs', functies: ['Chauffeur', 'Chauffeur CE', 'Bezorger'], leidinggevendeFunctie: 'Planner', budget: 250, buiten: true },
      { naam: 'Magazijn', functies: ['Orderpicker', 'Heftruckchauffeur', 'Magazijnmedewerker'], leidinggevendeFunctie: 'Teamleider magazijn', budget: 250, buiten: true },
    ],
  },
  auto: {
    label: 'Autobedrijf',
    afdelingen: [
      { naam: 'Werkplaats', functies: ['Automonteur', 'APK-keurmeester', 'Leerling-monteur', 'Bandenspecialist'], leidinggevendeFunctie: 'Chef werkplaats', budget: 300, buiten: true },
      { naam: 'Showroom en balie', functies: ['Serviceadviseur', 'Verkoopadviseur', 'Medewerker receptie'], leidinggevendeFunctie: 'Vestigingsmanager', budget: 200, buiten: false },
    ],
  },
  horeca: {
    label: 'Horeca',
    afdelingen: [
      { naam: 'Keuken', functies: ['Kok', 'Zelfstandig werkend kok', 'Keukenhulp'], leidinggevendeFunctie: 'Chef-kok', budget: 250, buiten: false },
      { naam: 'Bediening', functies: ['Gastvrouw', 'Gastheer', 'Medewerker bediening'], leidinggevendeFunctie: 'Bedrijfsleider', budget: 200, buiten: false },
    ],
  },
  zorg: {
    label: 'Zorg en beauty',
    afdelingen: [
      { naam: 'Behandeling', functies: ['Behandelaar', 'Specialist', 'Assistent'], leidinggevendeFunctie: 'Praktijkmanager', budget: 200, buiten: false },
      { naam: 'Balie', functies: ['Receptionist', 'Medewerker planning'], leidinggevendeFunctie: 'Office manager', budget: 150, buiten: false },
    ],
  },
  schoonmaak: {
    label: 'Schoonmaak en facilitair',
    afdelingen: [
      { naam: 'Schoonmaak', functies: ['Schoonmaakmedewerker', 'Glazenwasser', 'Allround schoonmaker'], leidinggevendeFunctie: 'Objectleider', budget: 200, buiten: true },
      kantoor('Bedrijfsleider', ['Planner', 'Medewerker administratie']),
    ],
  },
  algemeen: {
    label: 'Algemeen',
    afdelingen: [
      { naam: 'Buitendienst', functies: ['Monteur', 'Medewerker buitendienst', 'Allround medewerker'], leidinggevendeFunctie: 'Teamleider', budget: 300, buiten: true },
      kantoor('Bedrijfsleider', ['Planner', 'Medewerker binnendienst', 'Office manager']),
    ],
  },
};

/** Zoekt het profiel dat bij de (vrije tekst) branche past, via dezelfde groepen als de kennismakingspagina. */
export function brancheProfiel(branche: string | null | undefined): BrancheProfiel {
  return PROFIELEN[brancheGroep(branche)] ?? PROFIELEN.algemeen;
}
