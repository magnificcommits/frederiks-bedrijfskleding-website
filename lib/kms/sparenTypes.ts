/**
 * Types, labels en pure rekenhulpen voor het spaarprogramma. Geen database-
 * toegang, dus ook bruikbaar in client components.
 */

/** Orderstatussen die NIET als bestede omzet meetellen voor het sparen. */
export const NIET_TELLENDE_STATUSSEN = ['concept', 'geannuleerd', 'offerte_verstuurd'];

export const REGEL_SOORTEN = [
  'per_euro',
  'drempel_bonus',
  'eerste_order',
  'aanbrengen',
  'review',
  'jubileum',
  'nabestellen',
  'periode_actie',
] as const;
export type RegelSoort = (typeof REGEL_SOORTEN)[number];

export const REGEL_SOORT_INFO: Record<RegelSoort, { label: string; uitleg: string; automatisch: boolean }> = {
  per_euro: {
    label: 'Punten per bestede euro',
    uitleg: 'Over elke order die meetelt. Het niveau van de klant kan hier extra punten bovenop geven.',
    automatisch: true,
  },
  drempel_bonus: {
    label: 'Bonus bij grote order',
    uitleg: 'Vaste bonus als één order boven een bedrag uitkomt. Goed om klanten te laten bundelen.',
    automatisch: true,
  },
  eerste_order: {
    label: 'Eerste order',
    uitleg: 'Eenmalige bonus op de eerste order die meetelt.',
    automatisch: true,
  },
  aanbrengen: {
    label: 'Klant aangebracht',
    uitleg: 'De klant die een nieuw bedrijf aanbrengt krijgt punten, standaard pas na de eerste order van dat bedrijf.',
    automatisch: false,
  },
  review: {
    label: 'Review of Google-review',
    uitleg: 'Ken je zelf toe bij de klant zodra je de review ziet staan.',
    automatisch: false,
  },
  jubileum: {
    label: 'Jaren klant',
    uitleg: 'Elk jaar op de datum dat het bedrijf klant werd. Alleen voor klanten met minstens één order.',
    automatisch: true,
  },
  nabestellen: {
    label: 'Op tijd nabestellen',
    uitleg: 'Bonus als een klant binnen een aantal maanden na de vorige order opnieuw bestelt.',
    automatisch: true,
  },
  periode_actie: {
    label: 'Actieperiode',
    uitleg: 'Extra punten op orders binnen een periode, bijvoorbeeld dubbele punten in januari.',
    automatisch: true,
  },
};

export const BELONING_SOORTEN = ['korting_euro', 'gratis_artikel', 'gratis_logo', 'cadeaubon', 'goed_doel', 'anders'] as const;
export type BeloningSoort = (typeof BELONING_SOORTEN)[number];
export const BELONING_SOORT_LABEL: Record<BeloningSoort, string> = {
  korting_euro: 'Korting in euro',
  gratis_artikel: 'Gratis artikel',
  gratis_logo: 'Gratis logo aanbrengen',
  cadeaubon: 'Cadeaubon',
  goed_doel: 'Goed doel',
  anders: 'Anders',
};

export const INWISSEL_STATUSSEN = ['aangevraagd', 'goedgekeurd', 'verwerkt', 'afgewezen'] as const;
export type InwisselStatus = (typeof INWISSEL_STATUSSEN)[number];
export const INWISSEL_STATUS_LABEL: Record<InwisselStatus, string> = {
  aangevraagd: 'Aangevraagd',
  goedgekeurd: 'Goedgekeurd',
  verwerkt: 'Verwerkt',
  afgewezen: 'Afgewezen',
};

export type SpaarInstellingen = { actief: boolean; puntenPerEuro: number; euroPerPunt: number };

export type SpaarInstellingenUitgebreid = SpaarInstellingen & {
  /** 0 = punten vervallen nooit. */
  vervalMaanden: number;
  niveauBasis: 'omzet' | 'punten';
  portaalAanvragen: boolean;
  meldingEmail: string;
  voorwaarden: string;
};

export type SpaarRegel = {
  id: string;
  naam: string;
  soort: RegelSoort;
  actief: boolean;
  punten: number;
  factor: number;
  drempelEuro: number | null;
  maanden: number | null;
  startDatum: string | null;
  eindDatum: string | null;
  geldigVanaf: string | null;
  omschrijving: string | null;
  systeem: boolean;
  sortering: number;
};

export type SpaarNiveau = {
  id: string;
  naam: string;
  drempel: number;
  kleur: string | null;
  kortingPct: number;
  puntenFactor: number;
  gratisLogo: boolean;
  gratisPassen: boolean;
  voorrang: boolean;
  extraVoordelen: string | null;
  sortering: number;
};

export type SpaarBeloning = {
  id: string;
  naam: string;
  soort: BeloningSoort;
  omschrijving: string | null;
  puntenPrijs: number;
  waardeEuro: number;
  minNiveauId: string | null;
  actief: boolean;
  inPortaal: boolean;
  voorraad: number | null;
  sortering: number;
};

export type MutatieSoort = 'bij' | 'af' | 'vervallen' | 'inwisseling';

/** Eén regel in het puntengrootboek van een klant. */
export type GrootboekRegel = {
  id: string;
  organisatieId: string;
  datum: string;
  punten: number;
  soort: MutatieSoort;
  regelSoort: string | null;
  omschrijving: string;
  reden: string | null;
  door: string | null;
  orderId: string | null;
  inwisselStatus: InwisselStatus | null;
};

export type Inwisseling = {
  id: string;
  organisatieId: string;
  organisatieNaam: string;
  punten: number;
  kortingEuro: number;
  omschrijving: string | null;
  beloningId: string | null;
  beloningNaam: string | null;
  status: InwisselStatus;
  bron: 'dashboard' | 'portaal';
  aangevraagdDoor: string | null;
  notitie: string | null;
  behandeldDoor: string | null;
  goedgekeurdOp: string | null;
  verwerktOp: string | null;
  afgewezenReden: string | null;
  factuurId: string | null;
  taakId: string | null;
  createdAt: string;
};

export type NiveauStand = {
  huidig: SpaarNiveau | null;
  volgende: SpaarNiveau | null;
  /** Omzet of punten in de laatste 12 maanden, afhankelijk van de basis. */
  waarde: number;
  /** 0..1 op weg naar het volgende niveau. 1 als er geen volgend niveau is. */
  voortgang: number;
  nogTeGaan: number;
  /** Niveau over 60 dagen als er niets bijkomt (oude orders vallen buiten de 12 maanden). */
  straks: SpaarNiveau | null;
};

export type KlantSpaarStand = {
  organisatieId: string;
  naam: string;
  plaats: string | null;
  verdiend: number;
  ingewisseld: number;
  vervallen: number;
  /** Punten in aangevraagde of goedgekeurde inwisselingen, nog niet verwerkt. */
  gereserveerd: number;
  saldo: number;
  euroWaarde: number;
  omzet12m: number;
  punten12m: number;
  niveau: NiveauStand;
  laatsteOrder: string | null;
  aantalOrders: number;
  /** Punten die binnen 60 dagen vervallen als ze niet worden gebruikt. */
  vervaltBinnenkort: number;
  vervaltOp: string | null;
};

export function ronde2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

export function parseGetal(waarde: string | null | undefined, fallback: number): number {
  if (waarde == null || String(waarde).trim() === '') return fallback;
  const n = Number(String(waarde).replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

/** Datum plus n maanden, als Date. */
export function plusMaanden(d: Date, n: number): Date {
  const r = new Date(d.getTime());
  r.setMonth(r.getMonth() + n);
  return r;
}

/** Hoogste niveau waarvan de drempel gehaald is. */
export function niveauVoor(niveaus: SpaarNiveau[], waarde: number): SpaarNiveau | null {
  let gevonden: SpaarNiveau | null = null;
  for (const n of niveaus) if (waarde >= n.drempel && (!gevonden || n.drempel > gevonden.drempel)) gevonden = n;
  return gevonden;
}

export function niveauStand(niveaus: SpaarNiveau[], waarde: number, waardeStraks: number): NiveauStand {
  const gesorteerd = [...niveaus].sort((a, b) => a.drempel - b.drempel || a.sortering - b.sortering);
  const huidig = niveauVoor(gesorteerd, waarde);
  const idx = huidig ? gesorteerd.findIndex((n) => n.id === huidig.id) : -1;
  const volgende = gesorteerd[idx + 1] ?? null;
  const onder = huidig?.drempel ?? 0;
  const voortgang = volgende ? Math.max(0, Math.min(1, (waarde - onder) / Math.max(1, volgende.drempel - onder))) : 1;
  return {
    huidig,
    volgende,
    waarde,
    voortgang,
    nogTeGaan: volgende ? Math.max(0, volgende.drempel - waarde) : 0,
    straks: niveauVoor(gesorteerd, waardeStraks),
  };
}

/** Voordelen van een niveau als korte zinnen. */
export function niveauVoordelen(n: SpaarNiveau | null): string[] {
  if (!n) return [];
  const uit: string[] = [];
  if (n.kortingPct > 0) uit.push(`${n.kortingPct.toLocaleString('nl-NL')}% korting op kleding`);
  if (n.puntenFactor > 1) uit.push(`${Math.round((n.puntenFactor - 1) * 100)}% meer punten per euro`);
  if (n.gratisLogo) uit.push('Gratis logo borduren of bedrukken');
  if (n.gratisPassen) uit.push('Gratis passen op locatie');
  if (n.voorrang) uit.push('Voorrang in de planning');
  if (n.extraVoordelen?.trim()) uit.push(n.extraVoordelen.trim());
  return uit;
}

/** Tailwind-klassen voor een niveaubadge. Kleur is een vrije tekst; bekende namen krijgen een tint. */
export function niveauKleur(n: SpaarNiveau | null): string {
  const k = (n?.kleur ?? n?.naam ?? '').toLowerCase();
  if (k.includes('goud') || k.includes('gold')) return 'bg-amber-500 text-ink-900 ring-amber-600';
  if (k.includes('zilver') || k.includes('silver')) return 'bg-ink-100 text-ink-800 ring-ink-300';
  if (k.includes('brons') || k.includes('bronze')) return 'bg-amber-50 text-amber-800 ring-amber-200';
  if (k.includes('platina') || k.includes('platinum')) return 'bg-ink-900 text-white ring-ink-700';
  return 'bg-mist text-ink-800 ring-line';
}

export const STANDAARD_NIVEAUS: SpaarNiveau[] = [
  { id: 'std-brons', naam: 'Brons', drempel: 0, kleur: 'brons', kortingPct: 0, puntenFactor: 1, gratisLogo: false, gratisPassen: false, voorrang: false, extraVoordelen: null, sortering: 0 },
  { id: 'std-zilver', naam: 'Zilver', drempel: 2500, kleur: 'zilver', kortingPct: 2, puntenFactor: 1.1, gratisLogo: false, gratisPassen: true, voorrang: false, extraVoordelen: null, sortering: 10 },
  { id: 'std-goud', naam: 'Goud', drempel: 7500, kleur: 'goud', kortingPct: 5, puntenFactor: 1.25, gratisLogo: true, gratisPassen: true, voorrang: true, extraVoordelen: null, sortering: 20 },
];
