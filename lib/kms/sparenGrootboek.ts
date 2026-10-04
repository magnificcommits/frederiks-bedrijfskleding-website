import { kmsAdmin } from '@/lib/kms/adminClient';
import {
  getSpaarInstellingenUitgebreid,
  haalAlles,
  listNiveaus,
  listRegels,
  loyaliteitActief,
} from '@/lib/kms/sparenData';
import {
  INWISSEL_STATUSSEN,
  NIET_TELLENDE_STATUSSEN,
  niveauStand,
  niveauVoor,
  plusMaanden,
  ronde2,
  vloerPunten,
  type GrootboekRegel,
  type InwisselStatus,
  type Inwisseling,
  type KlantSpaarStand,
  type MutatieSoort,
  type SpaarInstellingenUitgebreid,
  type SpaarNiveau,
  type SpaarRegel,
} from '@/lib/kms/sparenTypes';

/**
 * Het puntengrootboek en de rekenkern van het spaarprogramma.
 *
 * Opzet
 * - Automatische punten (per euro, drempelbonus, eerste order, nabestellen,
 *   actieperiode, niveaubonus, jubileum, aangebrachte klant) worden bij het
 *   openen van een sparenpagina in `spaar_mutaties` geboekt. Elke boeking heeft
 *   een unieke `sleutel`, dus dubbel boeken kan niet, ook niet als twee pagina's
 *   tegelijk synchroniseren.
 * - Een eenmaal geboekte order wordt alleen herrekend als het orderbedrag
 *   verandert. Wijzigt Jessi later een regel, dan geldt die voor nieuwe orders.
 *   Vervalt een order (status terug naar concept, of verwijderd), dan worden de
 *   punten teruggeboekt.
 * - Inwisselingen staan in `spaar_inwisselingen` en tellen als afboeking zolang
 *   ze niet zijn afgewezen.
 * - Verval: punten vervallen na de ingestelde termijn, oudste eerst (FIFO).
 *
 * Zonder migratie bestaat `spaar_mutaties` niet. Dan rekent alles zoals vroeger:
 * punten per euro over alle orders, min de inwisselingen.
 */

type OrderRij = {
  id: string;
  ordernummer: number | null;
  organisatie_id: string | null;
  bedrag: number | null;
  status: string | null;
  besteldatum: string | null;
};

type OrgRij = { id: string; naam: string | null; plaats: string | null; datum_klant: string | null };

export type MutatieRij = {
  id: string;
  organisatie_id: string;
  punten: number;
  soort: string;
  regel_id: string | null;
  regel_soort: string | null;
  order_id: string | null;
  sleutel: string | null;
  omschrijving: string | null;
  reden: string | null;
  door: string | null;
  datum: string;
  details: Record<string, unknown> | null;
  created_at?: string;
};

type InwisselRij = {
  id: string;
  organisatie_id: string;
  punten: number;
  korting_euro: number | null;
  omschrijving: string | null;
  created_at: string;
  beloning_id?: string | null;
  beloning_naam?: string | null;
  status?: string | null;
  bron?: string | null;
  aangevraagd_door?: string | null;
  notitie?: string | null;
  behandeld_door?: string | null;
  goedgekeurd_op?: string | null;
  verwerkt_op?: string | null;
  afgewezen_reden?: string | null;
  factuur_id?: string | null;
  taak_id?: string | null;
};

type AanbrengRij = {
  id: string;
  organisatie_id: string;
  nieuwe_organisatie_id: string | null;
  nieuwe_naam: string | null;
  status: string;
  punten: number;
  notitie: string | null;
  door: string | null;
  beloond_op: string | null;
  created_at: string;
};

export type SpaarBundel = {
  loyaliteit: boolean;
  instellingen: SpaarInstellingenUitgebreid;
  regels: SpaarRegel[];
  niveaus: SpaarNiveau[];
  niveausUitTabel: boolean;
  /** Datum (yyyy-mm-dd) waarop het eerste niveau is aangemaakt; daarvoor geen niveaubonus. */
  niveausSinds: string | null;
  orgs: OrgRij[];
  orders: OrderRij[];
  mutaties: MutatieRij[];
  inwisselingen: InwisselRij[];
  aanbrengingen: AanbrengRij[];
};

const DAG = 24 * 60 * 60 * 1000;
const BINNENKORT_DAGEN = 60;

const telt = (o: OrderRij) => !NIET_TELLENDE_STATUSSEN.includes(String(o.status ?? ''));
const datumVan = (o: OrderRij) => o.besteldatum ?? '1970-01-01T00:00:00Z';
const dagVan = (iso: string) => iso.slice(0, 10);
const euro = (n: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n || 0);

function inwisselStatus(r: InwisselRij): InwisselStatus {
  const s = String(r.status ?? 'verwerkt');
  return (INWISSEL_STATUSSEN as readonly string[]).includes(s) ? (s as InwisselStatus) : 'verwerkt';
}

const telInwisseling = (r: InwisselRij) => inwisselStatus(r) !== 'afgewezen';

// ---------------------------------------------------------------------------
// Laden
// ---------------------------------------------------------------------------

export async function laadSpaarBundel(orgId?: string): Promise<SpaarBundel> {
  const sb = kmsAdmin();
  const [instellingen, { regels }, niv, loyaliteit] = await Promise.all([
    getSpaarInstellingenUitgebreid(),
    listRegels(),
    listNiveaus(),
    loyaliteitActief(),
  ]);
  const leeg: SpaarBundel = {
    loyaliteit,
    instellingen,
    regels,
    niveaus: niv.niveaus,
    niveausUitTabel: niv.tabel,
    niveausSinds: null,
    orgs: [],
    orders: [],
    mutaties: [],
    inwisselingen: [],
    aanbrengingen: [],
  };
  if (!sb) return leeg;

  const orgQ = (van: number, tot: number) => {
    let q = sb.from('organisaties').select('id, naam, plaats, datum_klant').order('id').range(van, tot);
    if (orgId) q = q.eq('id', orgId);
    return q;
  };
  const orderQ = (van: number, tot: number) => {
    let q = sb.from('orders').select('id, ordernummer, organisatie_id, bedrag, status, besteldatum').order('id').range(van, tot);
    if (orgId) q = q.eq('organisatie_id', orgId);
    return q;
  };
  const inwisselQ = (van: number, tot: number) => {
    let q = sb
      .from('spaar_inwisselingen')
      .select(loyaliteit ? '*' : 'id, organisatie_id, punten, korting_euro, omschrijving, created_at')
      .order('id')
      .range(van, tot);
    if (orgId) q = q.eq('organisatie_id', orgId);
    return q;
  };
  const mutatieQ = (van: number, tot: number) => {
    let q = sb.from('spaar_mutaties').select('*').order('id').range(van, tot);
    if (orgId) q = q.eq('organisatie_id', orgId);
    return q;
  };
  const aanbrengQ = (van: number, tot: number) => {
    let q = sb.from('spaar_aanbrengingen').select('*').order('id').range(van, tot);
    if (orgId) q = q.eq('organisatie_id', orgId);
    return q;
  };

  const sindsQ = niv.tabel
    ? sb.from('spaar_niveaus').select('created_at').order('created_at').limit(1).maybeSingle()
    : Promise.resolve({ data: null });
  const [orgs, orders, inwisselingen, mutaties, aanbrengingen, sinds] = await Promise.all([
    haalAlles<OrgRij>(orgQ),
    haalAlles<OrderRij>(orderQ),
    haalAlles<InwisselRij>(inwisselQ),
    loyaliteit ? haalAlles<MutatieRij>(mutatieQ) : Promise.resolve([] as MutatieRij[]),
    loyaliteit ? haalAlles<AanbrengRij>(aanbrengQ) : Promise.resolve([] as AanbrengRij[]),
    sindsQ,
  ]);
  const niveausSinds = (sinds.data as { created_at?: string } | null)?.created_at?.slice(0, 10) ?? null;

  return { ...leeg, niveausSinds, orgs, orders, inwisselingen, mutaties, aanbrengingen };
}

// ---------------------------------------------------------------------------
// Synchroniseren
// ---------------------------------------------------------------------------

type NieuweMutatie = Omit<MutatieRij, 'id'>;

/**
 * Niveau van een organisatie op het moment van een order: de omzet (of punten)
 * in de 365 dagen vóór die order, de order zelf niet meegerekend. Zo levert
 * herrekenen altijd hetzelfde op, en krijgen oude orders niet met terugwerkende
 * kracht de bonus van het niveau van nu.
 */
function niveauOpMoment(
  b: SpaarBundel,
  orgOrders: OrderRij[],
  orgMutaties: MutatieRij[],
  orderId: string,
  iso: string,
): SpaarNiveau | null {
  const t = new Date(iso).getTime();
  const van = t - 365 * DAG;
  let waarde = 0;
  if (b.instellingen.niveauBasis === 'punten') {
    orgMutaties.forEach((m) => {
      if (m.soort !== 'bij' || m.punten <= 0 || m.order_id === orderId) return;
      const x = new Date(m.datum).getTime();
      if (x >= van && x < t) waarde += m.punten;
    });
  } else {
    orgOrders.forEach((o) => {
      if (o.id === orderId) return;
      const x = new Date(datumVan(o)).getTime();
      if (x >= van && x < t) waarde += Number(o.bedrag) || 0;
    });
  }
  return niveauVoor(b.niveaus, waarde);
}

type Doel = { punten: number; regelId: string | null; regelSoort: string; omschrijving: string; bedragAfhankelijk: boolean };

/** Wat een order volgens de huidige regels oplevert, per regelsleutel. */
function doelenVoorOrders(b: SpaarBundel): Map<string, Map<string, Doel>> {
  const uit = new Map<string, Map<string, Doel>>();
  const actief = b.regels.filter((r) => r.actief);
  const perOrg = new Map<string, OrderRij[]>();
  b.orders.filter(telt).forEach((o) => {
    if (!o.organisatie_id) return;
    const lijst = perOrg.get(o.organisatie_id) ?? [];
    lijst.push(o);
    perOrg.set(o.organisatie_id, lijst);
  });

  const mutPerOrg = new Map<string, MutatieRij[]>();
  if (b.instellingen.niveauBasis === 'punten') {
    b.mutaties.forEach((m) => {
      const l = mutPerOrg.get(m.organisatie_id) ?? [];
      l.push(m);
      mutPerOrg.set(m.organisatie_id, l);
    });
  }

  perOrg.forEach((lijst, orgId) => {
    lijst.sort((a, c) => datumVan(a).localeCompare(datumVan(c)) || a.id.localeCompare(c.id));
    lijst.forEach((o, i) => {
      const dag = dagVan(datumVan(o));
      const geldig = (r: SpaarRegel) => !r.geldigVanaf || dag >= r.geldigVanaf;
      const bedrag = Number(o.bedrag) || 0;
      const nr = o.ordernummer ? `Order ${o.ordernummer}` : 'Order';
      const doelen = new Map<string, Doel>();
      let basis = 0;

      for (const r of actief.filter((x) => x.soort === 'per_euro' && geldig(x))) {
        const p = vloerPunten(bedrag * r.factor);
        basis += p;
        if (p > 0) {
          doelen.set(r.id, {
            punten: p,
            regelId: r.id === 'basis' ? null : r.id,
            regelSoort: 'per_euro',
            omschrijving: `${nr}, ${euro(bedrag)}`,
            bedragAfhankelijk: true,
          });
        }
      }

      // Niveaubonus alleen voor orders van na de invoering van niveaus; bestaande saldi blijven zo gelijk.
      const niveau = b.niveausSinds && dag >= b.niveausSinds ? niveauOpMoment(b, lijst, mutPerOrg.get(orgId) ?? [], o.id, datumVan(o)) : null;
      if (niveau && niveau.puntenFactor > 1 && basis > 0) {
        const p = vloerPunten(basis * (niveau.puntenFactor - 1));
        if (p > 0) {
          doelen.set('niveau', {
            punten: p,
            regelId: null,
            regelSoort: 'niveau_bonus',
            omschrijving: `${nr}, extra punten niveau ${niveau.naam}`,
            bedragAfhankelijk: true,
          });
        }
      }

      for (const r of actief.filter(geldig)) {
        if (r.soort === 'drempel_bonus' && r.drempelEuro != null && bedrag >= r.drempelEuro && r.punten > 0) {
          doelen.set(r.id, { punten: r.punten, regelId: r.id, regelSoort: r.soort, omschrijving: `${nr}, ${r.naam}`, bedragAfhankelijk: true });
        }
        if (r.soort === 'eerste_order' && i === 0 && r.punten > 0) {
          doelen.set(r.id, { punten: r.punten, regelId: r.id, regelSoort: r.soort, omschrijving: `${nr}, ${r.naam}`, bedragAfhankelijk: false });
        }
        if (r.soort === 'nabestellen' && i > 0 && r.punten > 0 && r.maanden) {
          const vorige = new Date(datumVan(lijst[i - 1]));
          if (new Date(datumVan(o)).getTime() <= plusMaanden(vorige, r.maanden).getTime()) {
            doelen.set(r.id, { punten: r.punten, regelId: r.id, regelSoort: r.soort, omschrijving: `${nr}, ${r.naam}`, bedragAfhankelijk: false });
          }
        }
        if (r.soort === 'periode_actie') {
          const binnen = (!r.startDatum || dag >= r.startDatum) && (!r.eindDatum || dag <= r.eindDatum);
          if (binnen) {
            const p = vloerPunten(basis * Math.max(0, r.factor - 1)) + Math.max(0, r.punten);
            if (p > 0) {
              doelen.set(r.id, { punten: p, regelId: r.id, regelSoort: r.soort, omschrijving: `${nr}, ${r.naam}`, bedragAfhankelijk: true });
            }
          }
        }
      }
      if (doelen.size > 0) uit.set(o.id, doelen);
    });
  });
  return uit;
}

function plusJaren(d: Date, n: number): Date {
  const r = new Date(d.getTime());
  r.setFullYear(r.getFullYear() + n);
  return r;
}

/** Berekent alle nog niet geboekte automatische mutaties. Puur, zonder database. */
export function berekenSynchronisatie(b: SpaarBundel, nu = new Date()): { nieuw: NieuweMutatie[]; beloondeAanbrengingen: string[] } {
  const nieuw: NieuweMutatie[] = [];
  const sleutels = new Set(b.mutaties.map((m) => m.sleutel).filter(Boolean) as string[]);
  const voegToe = (m: NieuweMutatie) => {
    if (m.sleutel && sleutels.has(m.sleutel)) return;
    if (m.sleutel) sleutels.add(m.sleutel);
    nieuw.push(m);
  };
  const nuIso = nu.toISOString();

  // 1. Orders ---------------------------------------------------------------
  const orderOp = new Map(b.orders.map((o) => [o.id, o]));
  const doelen = doelenVoorOrders(b);
  type Geboekt = { som: number; n: number; laatsteBedrag: number | null; regelId: string | null; regelSoort: string | null; orgId: string };
  const geboekt = new Map<string, Map<string, Geboekt>>();
  b.mutaties
    .filter((m) => m.order_id && m.sleutel?.startsWith('order:'))
    .sort((a, c) => String(a.created_at ?? a.datum).localeCompare(String(c.created_at ?? c.datum)))
    .forEach((m) => {
      const delen = String(m.sleutel).split(':');
      const regelKey = delen[2] ?? 'onbekend';
      const perOrder = geboekt.get(m.order_id!) ?? new Map<string, Geboekt>();
      const g = perOrder.get(regelKey) ?? { som: 0, n: 0, laatsteBedrag: null, regelId: m.regel_id, regelSoort: m.regel_soort, orgId: m.organisatie_id };
      g.som += m.punten;
      g.n += 1;
      const bedrag = Number((m.details as { bedrag?: unknown } | null)?.bedrag);
      if (Number.isFinite(bedrag)) g.laatsteBedrag = bedrag;
      perOrder.set(regelKey, g);
      geboekt.set(m.order_id!, perOrder);
    });

  const actieveRegelIds = new Set(b.regels.filter((r) => r.actief).map((r) => r.id));
  const orderIds = new Set<string>([...doelen.keys(), ...geboekt.keys()]);
  orderIds.forEach((orderId) => {
    const o = orderOp.get(orderId);
    const doelMap = doelen.get(orderId) ?? new Map<string, Doel>();
    const geboektMap = geboekt.get(orderId) ?? new Map<string, Geboekt>();
    const regelKeys = new Set<string>([...doelMap.keys(), ...geboektMap.keys()]);
    regelKeys.forEach((regelKey) => {
      const d = doelMap.get(regelKey);
      const g = geboektMap.get(regelKey);
      const som = g?.som ?? 0;
      const n = g?.n ?? 0;
      const sleutel = `order:${orderId}:${regelKey}:${n}`;
      const orgId = o?.organisatie_id ?? g?.orgId;
      if (!orgId) return;

      // Order telt niet meer mee (of is weg): alles terugboeken.
      if (!o || !telt(o)) {
        if (som !== 0) {
          voegToe({
            organisatie_id: orgId,
            punten: -som,
            soort: som > 0 ? 'af' : 'bij',
            regel_id: g?.regelId ?? null,
            regel_soort: g?.regelSoort ?? null,
            order_id: orderId,
            sleutel,
            omschrijving: `${o?.ordernummer ? `Order ${o.ordernummer}` : 'Order'} telt niet meer mee, punten teruggeboekt`,
            reden: null,
            door: 'systeem',
            datum: nuIso,
            details: { bedrag: Number(o?.bedrag) || 0 },
          });
        }
        return;
      }

      const bedrag = Number(o.bedrag) || 0;
      // Nog niets (netto) geboekt: boeken wat de regels nu zeggen.
      if (som === 0) {
        if (d && d.punten !== 0) {
          voegToe({
            organisatie_id: orgId,
            punten: d.punten,
            soort: 'bij',
            regel_id: d.regelId,
            regel_soort: d.regelSoort,
            order_id: orderId,
            sleutel,
            omschrijving: d.omschrijving,
            reden: null,
            door: 'systeem',
            datum: datumVan(o),
            details: { bedrag },
          });
        }
        return;
      }

      // Al geboekt: alleen bijstellen als het bedrag veranderde en de regel nog actief is.
      const regelNogActief = regelKey === 'niveau' || regelKey === 'basis' || actieveRegelIds.has(regelKey);
      const bedragAfhankelijk = d?.bedragAfhankelijk ?? ['per_euro', 'niveau_bonus', 'drempel_bonus', 'periode_actie'].includes(String(g?.regelSoort));
      if (bedragAfhankelijk && regelNogActief && g?.laatsteBedrag != null && Math.abs(g.laatsteBedrag - bedrag) > 0.004) {
        const delta = (d?.punten ?? 0) - som;
        if (delta !== 0) {
          voegToe({
            organisatie_id: orgId,
            punten: delta,
            soort: delta > 0 ? 'bij' : 'af',
            regel_id: d?.regelId ?? g?.regelId ?? null,
            regel_soort: d?.regelSoort ?? g?.regelSoort ?? null,
            order_id: orderId,
            sleutel,
            omschrijving: `${o.ordernummer ? `Order ${o.ordernummer}` : 'Order'}: bedrag gewijzigd naar ${euro(bedrag)}`,
            reden: null,
            door: 'systeem',
            datum: nuIso,
            details: { bedrag },
          });
        }
      }
    });
  });

  // 2. Jaren klant --------------------------------------------------------
  const ordersPerOrg = new Map<string, OrderRij[]>();
  b.orders.filter(telt).forEach((o) => {
    if (!o.organisatie_id) return;
    const l = ordersPerOrg.get(o.organisatie_id) ?? [];
    l.push(o);
    ordersPerOrg.set(o.organisatie_id, l);
  });
  const vandaag = dagVan(nuIso);
  for (const r of b.regels.filter((x) => x.actief && x.soort === 'jubileum' && x.punten > 0)) {
    b.orgs.forEach((org) => {
      const orders = ordersPerOrg.get(org.id);
      if (!orders || orders.length === 0) return;
      const eerste = orders.map(datumVan).sort()[0];
      const start = new Date(org.datum_klant ?? eerste);
      if (Number.isNaN(start.getTime())) return;
      for (let jaar = 1; jaar <= 100; jaar++) {
        const dag = dagVan(plusJaren(start, jaar).toISOString());
        if (dag > vandaag) break;
        if (r.geldigVanaf && dag < r.geldigVanaf) continue;
        voegToe({
          organisatie_id: org.id,
          punten: r.punten,
          soort: 'bij',
          regel_id: r.id,
          regel_soort: 'jubileum',
          order_id: null,
          sleutel: `jubileum:${r.id}:${org.id}:${dag.slice(0, 4)}`,
          omschrijving: `${jaar} jaar klant`,
          reden: null,
          door: 'systeem',
          datum: `${dag}T08:00:00Z`,
          details: { jaar },
        });
      }
    });
  }

  // 3. Aangebrachte klanten -----------------------------------------------
  const beloondeAanbrengingen: string[] = [];
  b.aanbrengingen
    .filter((a) => a.status === 'wacht' && a.nieuwe_organisatie_id)
    .forEach((a) => {
      const orders = ordersPerOrg.get(a.nieuwe_organisatie_id!);
      if (!orders || orders.length === 0) return;
      const sleutel = `aanbrengen:${a.id}`;
      beloondeAanbrengingen.push(a.id);
      if (a.punten <= 0) return;
      const eerste = orders.map(datumVan).sort()[0];
      voegToe({
        organisatie_id: a.organisatie_id,
        punten: a.punten,
        soort: 'bij',
        regel_id: null,
        regel_soort: 'aanbrengen',
        order_id: null,
        sleutel,
        omschrijving: `Klant aangebracht: ${a.nieuwe_naam || 'nieuwe klant'} plaatste de eerste order`,
        reden: null,
        door: 'systeem',
        datum: eerste,
        details: { aanbrenging_id: a.id, nieuwe_organisatie_id: a.nieuwe_organisatie_id },
      });
    });

  // 4. Verval -------------------------------------------------------------
  if (b.instellingen.vervalMaanden > 0) {
    const alle = [...b.mutaties, ...nieuw.map((m, i) => ({ ...m, id: `nieuw-${i}` }))];
    const perOrg = new Map<string, MutatieRij[]>();
    alle.forEach((m) => {
      const l = perOrg.get(m.organisatie_id) ?? [];
      l.push(m as MutatieRij);
      perOrg.set(m.organisatie_id, l);
    });
    perOrg.forEach((lijst, orgId) => {
      const inw = b.inwisselingen.filter((r) => r.organisatie_id === orgId && telInwisseling(r));
      const vervalRegels = vervalVoorOrg(lijst, inw, b.instellingen.vervalMaanden, nu);
      vervalRegels.verlopen.forEach((v) =>
        voegToe({
          organisatie_id: orgId,
          punten: -v.punten,
          soort: 'vervallen',
          regel_id: null,
          regel_soort: 'verval',
          order_id: null,
          sleutel: `verval:${v.lotId}:${v.n}`,
          omschrijving: `Punten van ${new Date(v.lotDatum).toLocaleDateString('nl-NL')} vervallen`,
          reden: `Na ${b.instellingen.vervalMaanden} maanden niet gebruikt`,
          door: 'systeem',
          datum: v.vervalOp,
          details: { lot: v.lotId },
        }),
      );
    });
  }

  return { nieuw, beloondeAanbrengingen };
}

/**
 * Verval per organisatie, oudste punten eerst. Geeft de te boeken vervallingen
 * en wat binnenkort vervalt. Nieuwe (nog niet opgeslagen) mutaties met id
 * 'nieuw-…' tellen niet als lot, want die hebben nog geen vaste id.
 */
function vervalVoorOrg(
  mutaties: MutatieRij[],
  inwisselingen: InwisselRij[],
  maanden: number,
  nu: Date,
): {
  verlopen: { lotId: string; lotDatum: string; punten: number; vervalOp: string; n: number }[];
  binnenkort: number;
  eersteVervalOp: string | null;
} {
  const lots = mutaties
    .filter((m) => m.soort === 'bij' && m.punten > 0 && !m.id.startsWith('nieuw-'))
    .sort((a, c) => a.datum.localeCompare(c.datum) || a.id.localeCompare(c.id));
  const vervallenPerLot = new Map<string, { som: number; n: number }>();
  mutaties
    .filter((m) => m.soort === 'vervallen')
    .forEach((m) => {
      const lot = String((m.details as { lot?: unknown } | null)?.lot ?? '');
      const v = vervallenPerLot.get(lot) ?? { som: 0, n: 0 };
      v.som += -m.punten;
      v.n += 1;
      vervallenPerLot.set(lot, v);
    });
  let gebruik =
    mutaties.filter((m) => m.soort === 'af').reduce((s, m) => s + Math.max(0, -m.punten), 0) +
    inwisselingen.reduce((s, r) => s + (Number(r.punten) || 0), 0);
  // Een 'bij' met negatieve punten (terugboeking van een negatieve correctie) telt ook als gebruik.
  gebruik += mutaties.filter((m) => m.soort === 'bij' && m.punten < 0).reduce((s, m) => s - m.punten, 0);

  const verlopen: { lotId: string; lotDatum: string; punten: number; vervalOp: string; n: number }[] = [];
  let binnenkort = 0;
  let eersteVervalOp: string | null = null;
  const grens = nu.getTime() + BINNENKORT_DAGEN * DAG;
  for (const lot of lots) {
    const vv = vervallenPerLot.get(lot.id) ?? { som: 0, n: 0 };
    const beschikbaar = Math.max(0, lot.punten - vv.som);
    const pak = Math.min(beschikbaar, gebruik);
    gebruik -= pak;
    const rest = beschikbaar - pak;
    if (rest <= 0) continue;
    const vervalOp = plusMaanden(new Date(lot.datum), maanden);
    if (vervalOp.getTime() <= nu.getTime()) {
      verlopen.push({ lotId: lot.id, lotDatum: lot.datum, punten: rest, vervalOp: vervalOp.toISOString(), n: vv.n });
    } else if (vervalOp.getTime() <= grens) {
      binnenkort += rest;
      if (!eersteVervalOp || vervalOp.toISOString() < eersteVervalOp) eersteVervalOp = vervalOp.toISOString();
    }
  }
  return { verlopen, binnenkort, eersteVervalOp };
}

/**
 * Boekt alle openstaande automatische punten en vult de bundel bij, zodat de
 * aanroeper meteen met verse cijfers verder kan. Faalt stil: een mislukte
 * synchronisatie mag een pagina nooit laten crashen.
 */
export async function synchroniseerBundel(b: SpaarBundel): Promise<{ geboekt: number }> {
  if (!b.loyaliteit || !b.instellingen.actief) return { geboekt: 0 };
  const sb = kmsAdmin();
  if (!sb) return { geboekt: 0 };
  try {
    const { nieuw, beloondeAanbrengingen } = berekenSynchronisatie(b);
    let geboekt = 0;
    for (let i = 0; i < nieuw.length; i += 500) {
      const blok = nieuw.slice(i, i + 500);
      const { data, error } = await sb
        .from('spaar_mutaties')
        .upsert(blok, { onConflict: 'sleutel', ignoreDuplicates: true })
        .select('*');
      if (error) break;
      const rijen = (data as MutatieRij[]) ?? [];
      b.mutaties.push(...rijen);
      geboekt += rijen.length;
    }
    if (beloondeAanbrengingen.length > 0) {
      await sb
        .from('spaar_aanbrengingen')
        .update({ status: 'beloond', beloond_op: new Date().toISOString() })
        .in('id', beloondeAanbrengingen)
        .eq('status', 'wacht');
      b.aanbrengingen.forEach((a) => {
        if (beloondeAanbrengingen.includes(a.id)) a.status = 'beloond';
      });
    }
    // Verval hangt af van wat net geboekt is; één tweede ronde vangt lots die nu pas een id hebben.
    if (geboekt > 0 && b.instellingen.vervalMaanden > 0) {
      const tweede = berekenSynchronisatie(b).nieuw.filter((m) => m.soort === 'vervallen');
      if (tweede.length > 0) {
        const { data } = await sb.from('spaar_mutaties').upsert(tweede, { onConflict: 'sleutel', ignoreDuplicates: true }).select('*');
        b.mutaties.push(...(((data as MutatieRij[]) ?? [])));
      }
    }
    return { geboekt };
  } catch {
    return { geboekt: 0 };
  }
}

/** Laden plus synchroniseren in één stap. */
export async function laadEnSynchroniseer(orgId?: string): Promise<SpaarBundel> {
  const b = await laadSpaarBundel(orgId);
  if (orgId && b.loyaliteit) {
    // Aangebrachte klanten van deze organisatie: orders van de nieuwe klant erbij halen.
    const nieuweIds = b.aanbrengingen.filter((a) => a.status === 'wacht' && a.nieuwe_organisatie_id).map((a) => a.nieuwe_organisatie_id!);
    if (nieuweIds.length > 0) {
      const sb = kmsAdmin();
      const { data } = sb
        ? await sb.from('orders').select('id, ordernummer, organisatie_id, bedrag, status, besteldatum').in('organisatie_id', nieuweIds)
        : { data: [] };
      const extra = ((data as OrderRij[]) ?? []).filter(telt);
      // Alleen voor de aanbreng-check; niet als eigen orders meetellen.
      const kopie: SpaarBundel = { ...b, orders: [...b.orders, ...extra], regels: [] };
      const { beloondeAanbrengingen, nieuw } = berekenSynchronisatie(kopie);
      const aanbreng = nieuw.filter((m) => m.regel_soort === 'aanbrengen');
      if (aanbreng.length > 0 && sb && b.instellingen.actief) {
        const { data: rijen } = await sb.from('spaar_mutaties').upsert(aanbreng, { onConflict: 'sleutel', ignoreDuplicates: true }).select('*');
        b.mutaties.push(...(((rijen as MutatieRij[]) ?? [])));
        await sb.from('spaar_aanbrengingen').update({ status: 'beloond', beloond_op: new Date().toISOString() }).in('id', beloondeAanbrengingen).eq('status', 'wacht');
        b.aanbrengingen.forEach((a) => {
          if (beloondeAanbrengingen.includes(a.id)) a.status = 'beloond';
        });
      }
    }
  }
  await synchroniseerBundel(b);
  return b;
}

// ---------------------------------------------------------------------------
// Standen
// ---------------------------------------------------------------------------

/** Zonder migratie: punten per euro per order, als virtuele mutaties. */
function virtueleMutaties(b: SpaarBundel): MutatieRij[] {
  const basis = b.regels.find((r) => r.soort === 'per_euro' && r.actief);
  const factor = basis?.factor ?? b.instellingen.puntenPerEuro;
  return b.orders.filter(telt).flatMap((o) => {
    const p = vloerPunten((Number(o.bedrag) || 0) * factor);
    if (!o.organisatie_id || p <= 0) return [];
    return [
      {
        id: `v-${o.id}`,
        organisatie_id: o.organisatie_id,
        punten: p,
        soort: 'bij',
        regel_id: null,
        regel_soort: 'per_euro',
        order_id: o.id,
        sleutel: null,
        omschrijving: `${o.ordernummer ? `Order ${o.ordernummer}` : 'Order'}, ${euro(Number(o.bedrag) || 0)}`,
        reden: null,
        door: 'systeem',
        datum: datumVan(o),
        details: null,
      },
    ];
  });
}

export function mutatiesVan(b: SpaarBundel): MutatieRij[] {
  return b.loyaliteit ? b.mutaties : virtueleMutaties(b);
}

export function berekenStanden(b: SpaarBundel, nu = new Date()): KlantSpaarStand[] {
  const mutaties = mutatiesVan(b);
  const sinds = nu.getTime() - 365 * DAG;
  const sindsStraks = sinds + BINNENKORT_DAGEN * DAG;
  const perOrgMut = new Map<string, MutatieRij[]>();
  mutaties.forEach((m) => {
    const l = perOrgMut.get(m.organisatie_id) ?? [];
    l.push(m);
    perOrgMut.set(m.organisatie_id, l);
  });
  const perOrgInw = new Map<string, InwisselRij[]>();
  b.inwisselingen.forEach((r) => {
    const l = perOrgInw.get(r.organisatie_id) ?? [];
    l.push(r);
    perOrgInw.set(r.organisatie_id, l);
  });
  const perOrgOrd = new Map<string, OrderRij[]>();
  b.orders.filter(telt).forEach((o) => {
    if (!o.organisatie_id) return;
    const l = perOrgOrd.get(o.organisatie_id) ?? [];
    l.push(o);
    perOrgOrd.set(o.organisatie_id, l);
  });

  const { euroPerPunt } = b.instellingen;
  return b.orgs.map((org) => {
    const muts = perOrgMut.get(org.id) ?? [];
    const inw = perOrgInw.get(org.id) ?? [];
    const ords = perOrgOrd.get(org.id) ?? [];
    const verdiend = muts.filter((m) => m.soort === 'bij').reduce((s, m) => s + m.punten, 0);
    const afgeboekt = muts.filter((m) => m.soort === 'af').reduce((s, m) => s - m.punten, 0);
    const vervallen = muts.filter((m) => m.soort === 'vervallen').reduce((s, m) => s - m.punten, 0);
    const telInw = inw.filter(telInwisseling);
    const ingewisseld = telInw.reduce((s, r) => s + (Number(r.punten) || 0), 0);
    const gereserveerd = telInw
      .filter((r) => ['aangevraagd', 'goedgekeurd'].includes(inwisselStatus(r)))
      .reduce((s, r) => s + (Number(r.punten) || 0), 0);
    const saldo = verdiend - afgeboekt - vervallen - ingewisseld;

    const omzet12m = ords.filter((o) => new Date(datumVan(o)).getTime() >= sinds).reduce((s, o) => s + (Number(o.bedrag) || 0), 0);
    const omzetStraks = ords.filter((o) => new Date(datumVan(o)).getTime() >= sindsStraks).reduce((s, o) => s + (Number(o.bedrag) || 0), 0);
    const punten12m = muts.filter((m) => m.soort === 'bij' && m.punten > 0 && new Date(m.datum).getTime() >= sinds).reduce((s, m) => s + m.punten, 0);
    const puntenStraks = muts.filter((m) => m.soort === 'bij' && m.punten > 0 && new Date(m.datum).getTime() >= sindsStraks).reduce((s, m) => s + m.punten, 0);
    const opPunten = b.instellingen.niveauBasis === 'punten';
    const niveau = niveauStand(b.niveaus, opPunten ? punten12m : omzet12m, opPunten ? puntenStraks : omzetStraks);

    let vervaltBinnenkort = 0;
    let vervaltOp: string | null = null;
    if (b.loyaliteit && b.instellingen.vervalMaanden > 0) {
      const v = vervalVoorOrg(muts, telInw, b.instellingen.vervalMaanden, nu);
      vervaltBinnenkort = v.binnenkort;
      vervaltOp = v.eersteVervalOp;
    }

    const laatste = ords.map(datumVan).sort().pop() ?? null;
    return {
      organisatieId: org.id,
      naam: org.naam ?? '',
      plaats: org.plaats,
      verdiend: verdiend - afgeboekt,
      ingewisseld,
      vervallen,
      gereserveerd,
      saldo,
      euroWaarde: ronde2(Math.max(0, saldo) * euroPerPunt),
      omzet12m: ronde2(omzet12m),
      punten12m,
      niveau,
      laatsteOrder: laatste,
      aantalOrders: ords.length,
      vervaltBinnenkort,
      vervaltOp,
    };
  });
}

/** Grootboek van één klant, nieuwste bovenaan, met lopend saldo. */
export function grootboekVan(b: SpaarBundel, orgId: string): (GrootboekRegel & { saldoNa: number })[] {
  const regels: GrootboekRegel[] = [
    ...mutatiesVan(b)
      .filter((m) => m.organisatie_id === orgId)
      .map<GrootboekRegel>((m) => ({
        id: m.id,
        organisatieId: m.organisatie_id,
        datum: m.datum,
        punten: m.punten,
        soort: (['bij', 'af', 'vervallen'].includes(m.soort) ? m.soort : 'bij') as MutatieSoort,
        regelSoort: m.regel_soort,
        omschrijving: m.omschrijving ?? '',
        reden: m.reden,
        door: m.door,
        orderId: m.order_id,
        inwisselStatus: null,
      })),
    ...b.inwisselingen
      .filter((r) => r.organisatie_id === orgId)
      .map<GrootboekRegel>((r) => ({
        id: r.id,
        organisatieId: r.organisatie_id,
        datum: r.created_at,
        punten: -(Number(r.punten) || 0),
        soort: 'inwisseling',
        regelSoort: null,
        omschrijving: r.beloning_naam || r.omschrijving || `Ingewisseld voor ${euro(Number(r.korting_euro) || 0)} korting`,
        reden: r.afgewezen_reden ?? r.notitie ?? null,
        door: r.aangevraagd_door ?? r.behandeld_door ?? null,
        orderId: null,
        inwisselStatus: inwisselStatus(r),
      })),
  ].sort((a, c) => a.datum.localeCompare(c.datum) || a.id.localeCompare(c.id));

  let saldo = 0;
  const metSaldo = regels.map((r) => {
    if (!(r.soort === 'inwisseling' && r.inwisselStatus === 'afgewezen')) saldo += r.punten;
    return { ...r, saldoNa: saldo };
  });
  return metSaldo.reverse();
}

export function inwisselingenVan(b: SpaarBundel): Inwisseling[] {
  const naam = new Map(b.orgs.map((o) => [o.id, o.naam ?? '']));
  return b.inwisselingen
    .map<Inwisseling>((r) => ({
      id: r.id,
      organisatieId: r.organisatie_id,
      organisatieNaam: naam.get(r.organisatie_id) ?? '',
      punten: Number(r.punten) || 0,
      kortingEuro: Number(r.korting_euro) || 0,
      omschrijving: r.omschrijving,
      beloningId: r.beloning_id ?? null,
      beloningNaam: r.beloning_naam ?? null,
      status: inwisselStatus(r),
      bron: r.bron === 'portaal' ? 'portaal' : 'dashboard',
      aangevraagdDoor: r.aangevraagd_door ?? null,
      notitie: r.notitie ?? null,
      behandeldDoor: r.behandeld_door ?? null,
      goedgekeurdOp: r.goedgekeurd_op ?? null,
      verwerktOp: r.verwerkt_op ?? null,
      afgewezenReden: r.afgewezen_reden ?? null,
      factuurId: r.factuur_id ?? null,
      taakId: r.taak_id ?? null,
      createdAt: r.created_at,
    }))
    .sort((a, c) => c.createdAt.localeCompare(a.createdAt));
}

export function aanbrengingenVan(b: SpaarBundel): (AanbrengRij & { aanbrengerNaam: string; nieuweNaamWeergave: string })[] {
  const naam = new Map(b.orgs.map((o) => [o.id, o.naam ?? '']));
  return [...b.aanbrengingen]
    .sort((a, c) => c.created_at.localeCompare(a.created_at))
    .map((a) => ({
      ...a,
      aanbrengerNaam: naam.get(a.organisatie_id) ?? '',
      nieuweNaamWeergave: (a.nieuwe_organisatie_id && naam.get(a.nieuwe_organisatie_id)) || a.nieuwe_naam || 'Onbekend',
    }));
}

// ---------------------------------------------------------------------------
// Statistiek voor het overzicht
// ---------------------------------------------------------------------------

export type SpaarMaand = {
  key: string;
  label: string;
  labelLang: string;
  bijgeboekt: number;
  ingewisseld: number;
  afgeboekt: number;
};

export type SpaarStatistiek = {
  maanden: SpaarMaand[];
  actieveSpaarders: number;
  actieveSpaardersVorig: number;
  uitgegeven12m: number;
  uitgegevenVorig12m: number;
  ingewisseld12m: number;
  ingewisseldEuro12m: number;
  ingewisseldVorig12m: number;
  openSaldo: number;
  openEuro: number;
  gereserveerd: number;
  openAanvragen: number;
};

export function berekenStatistiek(b: SpaarBundel, standen: KlantSpaarStand[], nu = new Date()): SpaarStatistiek {
  const mutaties = mutatiesVan(b);
  const maanden: SpaarMaand[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(nu.getFullYear(), nu.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const kort = d.toLocaleDateString('nl-NL', { month: 'short' }).replace('.', '');
    maanden.push({
      key,
      label: d.getMonth() === 0 || i === 11 ? `${kort} ${String(d.getFullYear()).slice(2)}` : kort,
      labelLang: d.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' }),
      bijgeboekt: 0,
      ingewisseld: 0,
      afgeboekt: 0,
    });
  }
  const opKey = new Map(maanden.map((m) => [m.key, m]));
  const maandKey = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  mutaties.forEach((m) => {
    const mnd = opKey.get(maandKey(m.datum));
    if (!mnd) return;
    if (m.soort === 'bij') mnd.bijgeboekt += m.punten;
    else mnd.afgeboekt += -m.punten;
  });
  b.inwisselingen.filter(telInwisseling).forEach((r) => {
    const mnd = opKey.get(maandKey(r.created_at));
    if (mnd) mnd.ingewisseld += Number(r.punten) || 0;
  });

  const t = nu.getTime();
  const in12 = (iso: string) => new Date(iso).getTime() >= t - 365 * DAG;
  const inVorig = (iso: string) => {
    const x = new Date(iso).getTime();
    return x < t - 365 * DAG && x >= t - 730 * DAG;
  };
  const spaarders = (f: (iso: string) => boolean) =>
    new Set(mutaties.filter((m) => m.soort === 'bij' && m.punten > 0 && f(m.datum)).map((m) => m.organisatie_id)).size;
  const som = (f: (iso: string) => boolean) => mutaties.filter((m) => m.soort === 'bij' && f(m.datum)).reduce((s, m) => s + m.punten, 0);
  const telInw = b.inwisselingen.filter(telInwisseling);
  const openSaldo = standen.reduce((s, k) => s + Math.max(0, k.saldo), 0);

  return {
    maanden,
    actieveSpaarders: spaarders(in12),
    actieveSpaardersVorig: spaarders(inVorig),
    uitgegeven12m: som(in12),
    uitgegevenVorig12m: som(inVorig),
    ingewisseld12m: telInw.filter((r) => in12(r.created_at)).reduce((s, r) => s + (Number(r.punten) || 0), 0),
    ingewisseldEuro12m: ronde2(telInw.filter((r) => in12(r.created_at)).reduce((s, r) => s + (Number(r.korting_euro) || 0), 0)),
    ingewisseldVorig12m: telInw.filter((r) => inVorig(r.created_at)).reduce((s, r) => s + (Number(r.punten) || 0), 0),
    openSaldo,
    openEuro: ronde2(openSaldo * b.instellingen.euroPerPunt),
    gereserveerd: standen.reduce((s, k) => s + k.gereserveerd, 0),
    openAanvragen: b.inwisselingen.filter((r) => inwisselStatus(r) === 'aangevraagd').length,
  };
}
