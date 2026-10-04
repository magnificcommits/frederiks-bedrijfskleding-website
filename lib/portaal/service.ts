import { getServerSupabase } from './supabaseServer';
import { kmsAdmin } from '@/lib/kms/adminClient';
import { getMijnToegang } from './team';
import { metIdTerugval } from '@/lib/kms/kolomTerugval';
import {
  berichtenVoorKlant,
  getKlachtInstellingen,
  getRetourbeleid,
  getReparatieInstellingen,
  slaDeadline,
  ONDERDEEL_LABEL,
  type ReparatieOnderdeel,
  type ReparatieStatus,
  type RetourSoort,
  termijnVoorKlant,
  voegKlachtBerichtToe,
  voorwaardenTekst,
  type KlachtBericht,
} from '@/lib/kms/service';

export type RetourStatus = 'aangemeld' | 'goedgekeurd' | 'afgewezen' | 'verwerkt';
export type KlachtSoort = 'vraag' | 'klacht';
export type KlachtStatus = 'open' | 'in_behandeling' | 'afgehandeld';

export type OrderKeuze = { id: string; ordernummer: string | null; status: string | null };

/** Eén regel die geretourneerd kan worden, met het aantal dat oorspronkelijk besteld is. */
export type OrderregelKeuze = {
  orderregel_id: string;
  item_naam: string;
  maat: string | null;
  kleur: string | null;
  besteld_aantal: number;
};

/** Een bestelling die binnen de retourtermijn valt, met de regels die geretourneerd kunnen worden. */
export type RetourneerbareOrder = {
  id: string;
  ordernummer: string | null;
  besteldatum: string;
  regels: OrderregelKeuze[];
};

/** Eén geretourneerd artikel zoals opgeslagen in retouren.regels (JSON). */
export type RetourRegel = {
  orderregel_id: string;
  item_naam: string;
  maat: string | null;
  kleur: string | null;
  aantal: number;
  /** Gekozen reden uit de vaste lijst (Instellingen > Service). */
  reden?: string | null;
};

const RETOURTERMIJN_STANDAARD = 30;

/**
 * Leest de retourtermijn (dagen) via de service-role client, omdat de tabel
 * `instellingen` RLS aan heeft zonder policies en dus niet via de portaal-client leesbaar is.
 * Met een organisatie-id telt een afwijkende termijn voor die klant (Instellingen > Service).
 * Valt terug op 30 dagen.
 */
export async function getRetourtermijn(organisatieId?: string | null): Promise<number> {
  const admin = kmsAdmin();
  if (!admin) return RETOURTERMIJN_STANDAARD;
  const beleid = await getRetourbeleid();
  return termijnVoorKlant(beleid, organisatieId);
}

/** Wat het portaal over het retourbeleid laat zien: termijn, voorwaarden en de vaste redenen. */
export async function getRetourInfo(organisatieId?: string | null): Promise<{
  termijn: number;
  voorwaarden: string[];
  redenen: string[];
  /** Reparaties: aan/uit, standaardkosten en de uitleg voor de klant (Instellingen > Service). */
  reparatie: { aan: boolean; kosten: number | null; tekst: string };
}> {
  const [beleid, reparatie] = await Promise.all([getRetourbeleid(), getReparatieInstellingen()]);
  return {
    termijn: termijnVoorKlant(beleid, organisatieId),
    voorwaarden: voorwaardenTekst(beleid.voorwaarden),
    redenen: beleid.redenen,
    reparatie,
  };
}

/**
 * Zet de retourtermijn (dagen) via de service-role client (upsert op sleutel).
 * Alleen server-side gebruiken; in het dashboard achter dashAuthed().
 */
export async function zetRetourtermijn(dagen: number): Promise<boolean> {
  const admin = kmsAdmin();
  if (!admin) return false;
  const veilig = Number.isFinite(dagen) && dagen > 0 ? Math.floor(dagen) : RETOURTERMIJN_STANDAARD;
  const { error } = await admin
    .from('instellingen')
    .upsert({ sleutel: 'retourtermijn_dagen', waarde: String(veilig) }, { onConflict: 'sleutel' });
  return !error;
}

export type Retour = {
  id: string;
  order_id: string | null;
  reden: string | null;
  status: RetourStatus;
  retouradres: string | null;
  instructie: string | null;
  created_at: string;
  ordernummer: string | null;
  regels: RetourRegel[];
  soort: RetourSoort;
  reparatie_onderdeel: ReparatieOnderdeel | null;
  reparatie_status: ReparatieStatus | null;
  reparatie_kosten: number | null;
};

const SOORTEN: readonly string[] = ['retour', 'ruilen', 'reparatie'];
const REPARATIESTAPPEN: readonly string[] = ['aangemeld', 'ontvangen', 'in_reparatie', 'klaar', 'teruggestuurd', 'opgehaald'];

/** Maakt van de ruwe JSON-kolom `regels` een net getypeerde array. */
function leesRetourRegels(raw: unknown): RetourRegel[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      const aantal = Number(o.aantal);
      return {
        orderregel_id: String(o.orderregel_id ?? ''),
        item_naam: String(o.item_naam ?? ''),
        maat: o.maat == null ? null : String(o.maat),
        kleur: o.kleur == null ? null : String(o.kleur),
        aantal: Number.isFinite(aantal) && aantal > 0 ? aantal : 1,
      };
    })
    .filter((r) => r.item_naam !== '');
}

export type Klacht = {
  id: string;
  order_id: string | null;
  soort: KlachtSoort;
  omschrijving: string;
  status: KlachtStatus;
  antwoord: string | null;
  created_at: string;
  ordernummer: string | null;
  categorie: string | null;
  /** Antwoorden van Frederiks en reacties van de klant, oudste eerst. Leeg zonder migratie. */
  berichten: KlachtBericht[];
};

/** Bestellingen van de eigen organisatie voor de keuzelijst bij een retour of klacht. RLS scoopt op org. */
export async function getMijnOrders(): Promise<OrderKeuze[]> {
  const sb = await getServerSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from('orders')
    .select('id, ordernummer, status')
    .order('created_at', { ascending: false });
  return (data as unknown as OrderKeuze[]) ?? [];
}

/** Retouren van de eigen organisatie, nieuwste eerst. RLS scoopt op org. */
export async function getMijnRetouren(): Promise<Retour[]> {
  const sb = await getServerSupabase();
  if (!sb) return [];
  // select('*'): de reparatiekolommen verschijnen vanzelf zodra de migratie gedraaid is.
  const { data } = await sb
    .from('retouren')
    .select('*, orders(ordernummer)')
    .order('created_at', { ascending: false });
  const rijen =
    (data as unknown as {
      id: string;
      order_id: string | null;
      reden: string | null;
      status: RetourStatus;
      retouradres: string | null;
      instructie: string | null;
      created_at: string;
      regels: unknown;
      orders: { ordernummer: string | null } | null;
      soort?: string | null;
      beslissing?: string | null;
      reparatie_onderdeel?: string | null;
      reparatie_status?: string | null;
      reparatie_kosten?: number | string | null;
    }[]) ?? [];
  return rijen.map((r) => ({
    soort: (SOORTEN.includes(r.soort ?? '') ? (r.soort === 'retour' && r.beslissing === 'omruilen' ? 'ruilen' : r.soort) : 'retour') as RetourSoort,
    reparatie_onderdeel: r.reparatie_onderdeel && r.reparatie_onderdeel in ONDERDEEL_LABEL ? (r.reparatie_onderdeel as ReparatieOnderdeel) : null,
    reparatie_status: REPARATIESTAPPEN.includes(r.reparatie_status ?? '')
      ? (r.reparatie_status as ReparatieStatus)
      : r.soort === 'reparatie'
        ? 'aangemeld'
        : null,
    reparatie_kosten: r.reparatie_kosten != null && Number.isFinite(Number(r.reparatie_kosten)) ? Number(r.reparatie_kosten) : null,
    id: r.id,
    order_id: r.order_id,
    reden: r.reden,
    status: r.status,
    retouradres: r.retouradres,
    instructie: r.instructie,
    created_at: r.created_at,
    ordernummer: r.orders?.ordernummer ?? null,
    regels: leesRetourRegels(r.regels),
  }));
}

/**
 * Bestellingen van de eigen organisatie die nog binnen de retourtermijn vallen
 * (besteldatum + termijn-dagen >= vandaag), met per order de regels die geretourneerd
 * kunnen worden. RLS scoopt op org. Nieuwste besteldatum eerst.
 */
export async function getMijnRetourneerbareOrders(termijnDagen: number): Promise<RetourneerbareOrder[]> {
  const sb = await getServerSupabase();
  if (!sb) return [];
  const grens = new Date();
  grens.setHours(0, 0, 0, 0);
  // Orders die op of na (vandaag - termijn) zijn besteld vallen nog binnen de termijn.
  grens.setDate(grens.getDate() - termijnDagen);
  const { data } = await sb
    .from('orders')
    .select('id, ordernummer, besteldatum, orderregels(id, item_naam, maat, kleur, aantal)')
    .gte('besteldatum', grens.toISOString())
    .order('besteldatum', { ascending: false });
  const rijen =
    (data as unknown as {
      id: string;
      ordernummer: string | null;
      besteldatum: string;
      orderregels: { id: string; item_naam: string | null; maat: string | null; kleur: string | null; aantal: number | null }[] | null;
    }[]) ?? [];
  return rijen
    .map((o) => ({
      id: o.id,
      ordernummer: o.ordernummer != null ? String(o.ordernummer) : null,
      besteldatum: o.besteldatum,
      regels: (o.orderregels ?? []).map((r) => ({
        orderregel_id: r.id,
        item_naam: r.item_naam ?? 'Artikel',
        maat: r.maat,
        kleur: r.kleur,
        besteld_aantal: r.aantal != null && r.aantal > 0 ? r.aantal : 1,
      })),
    }))
    .filter((o) => o.regels.length > 0);
}

/**
 * Meldt een retour aan binnen de eigen organisatie. Zet organisatie_id en medewerker_id op de eigen waarden.
 * Slaat de geselecteerde regels op in de JSON-kolom `regels`. Weigert orders die buiten de
 * retourtermijn vallen en retouren zonder geselecteerde regels.
 */
export async function meldRetour(input: {
  orderId: string | null;
  reden: string;
  /** Gekozen reden uit de vaste lijst; komt ook op elke regel, voor de analyse per artikel en maat. */
  redenKeuze?: string | null;
  regels: RetourRegel[];
  /** Terugsturen of ruilen; reparaties gaan via meldReparatie. */
  soort?: 'retour' | 'ruilen';
}): Promise<{ ok: boolean; error?: string }> {
  const sb = await getServerSupabase();
  if (!sb) return { ok: false, error: 'Portaal niet geconfigureerd' };
  const toegang = await getMijnToegang();
  if (!toegang.organisatieId) return { ok: false, error: 'Geen organisatie gekoppeld' };

  if (!input.orderId) return { ok: false, error: 'Kies een bestelling om te retourneren' };
  if (input.regels.length === 0) return { ok: false, error: 'Kies minstens één artikel om te retourneren' };

  // Controleer dat de order binnen de termijn valt en hoor bij de eigen organisatie (RLS),
  // en valideer de geselecteerde regels tegen de werkelijke orderregels.
  const termijn = await getRetourtermijn(toegang.organisatieId);
  const orders = await getMijnRetourneerbareOrders(termijn);
  const order = orders.find((o) => o.id === input.orderId);
  if (!order) return { ok: false, error: 'Deze bestelling valt buiten de retourtermijn of is niet van jou' };

  const perRegel = new Map(order.regels.map((r) => [r.orderregel_id, r]));
  const schoneRegels: RetourRegel[] = [];
  for (const r of input.regels) {
    const bron = perRegel.get(r.orderregel_id);
    if (!bron) continue;
    const aantal = Math.min(Math.max(1, Math.floor(r.aantal)), bron.besteld_aantal);
    schoneRegels.push({
      orderregel_id: bron.orderregel_id,
      item_naam: bron.item_naam,
      maat: bron.maat,
      kleur: bron.kleur,
      aantal,
      reden: input.redenKeuze ?? null,
    });
  }
  if (schoneRegels.length === 0) return { ok: false, error: 'Kies minstens één geldig artikel om te retourneren' };

  const rij: Record<string, unknown> = {
    organisatie_id: toegang.organisatieId,
    medewerker_id: toegang.medewerkerId,
    order_id: input.orderId,
    reden: input.redenKeuze && !input.reden.startsWith(input.redenKeuze)
      ? `${input.redenKeuze}. ${input.reden}`.trim()
      : input.reden,
    status: 'aangemeld',
    regels: schoneRegels,
    soort: input.soort === 'ruilen' ? 'ruilen' : 'retour',
  };
  const { error } = await metIdTerugval(rij, ['soort'], (x) => sb.from('retouren').insert(x));
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Meldt een reparatie aan binnen de eigen organisatie. Een bestelling is optioneel
 * (kleding van jaren terug kan ook kapot gaan); zonder bestelling noemt de klant
 * het kledingstuk zelf. Foto's zijn al geüpload; hier komen alleen de URL's binnen.
 * Geen terugbetaling: de reparatie doorloopt eigen stappen in het KMS.
 */
export async function meldReparatie(input: {
  orderId: string | null;
  orderregelId: string | null;
  kledingstuk: string;
  aantal: number;
  onderdeel: ReparatieOnderdeel;
  toelichting: string;
  fotos: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const sb = await getServerSupabase();
  if (!sb) return { ok: false, error: 'Portaal niet geconfigureerd' };
  const toegang = await getMijnToegang();
  if (!toegang.organisatieId) return { ok: false, error: 'Geen organisatie gekoppeld' };
  const inst = await getReparatieInstellingen();
  if (!inst.aan) return { ok: false, error: 'Reparaties staan uit' };

  // Bestelling en artikel alleen overnemen als ze echt van de eigen organisatie zijn (RLS).
  let orderId: string | null = null;
  let regel: RetourRegel | null = null;
  if (input.orderId) {
    const { data: order } = await sb
      .from('orders')
      .select('id, orderregels(id, item_naam, maat, kleur, aantal)')
      .eq('id', input.orderId)
      .maybeSingle();
    const o = order as { id: string; orderregels: { id: string; item_naam: string | null; maat: string | null; kleur: string | null; aantal: number | null }[] | null } | null;
    if (o) {
      orderId = o.id;
      const bron = (o.orderregels ?? []).find((r) => r.id === input.orderregelId);
      if (bron) {
        const max = bron.aantal != null && bron.aantal > 0 ? bron.aantal : 1;
        regel = {
          orderregel_id: bron.id,
          item_naam: bron.item_naam ?? 'Artikel',
          maat: bron.maat,
          kleur: bron.kleur,
          aantal: Math.min(Math.max(1, Math.floor(input.aantal || 1)), max),
          reden: ONDERDEEL_LABEL[input.onderdeel],
        };
      }
    }
  }
  if (!regel) {
    const naam = input.kledingstuk.trim().slice(0, 200);
    if (!naam) return { ok: false, error: 'Noem het kledingstuk' };
    regel = {
      orderregel_id: '',
      item_naam: naam,
      maat: null,
      kleur: null,
      aantal: Math.min(Math.max(1, Math.floor(input.aantal || 1)), 50),
      reden: ONDERDEEL_LABEL[input.onderdeel],
    };
  }

  const rij: Record<string, unknown> = {
    organisatie_id: toegang.organisatieId,
    medewerker_id: toegang.medewerkerId,
    order_id: orderId,
    reden: [`Reparatie: ${ONDERDEEL_LABEL[input.onderdeel]}.`, input.toelichting.trim()].filter(Boolean).join(' ').slice(0, 2000),
    status: 'aangemeld',
    regels: [regel],
    soort: 'reparatie',
    reparatie_onderdeel: input.onderdeel,
    reparatie_status: 'aangemeld',
    reparatie_kosten: inst.kosten,
    fotos: input.fotos.slice(0, 3),
  };
  const { error } = await metIdTerugval(rij, ['soort', 'reparatie_onderdeel', 'reparatie_status', 'reparatie_kosten', 'fotos'], (x) =>
    sb.from('retouren').insert(x),
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Klachten en vragen van de eigen organisatie, nieuwste eerst. RLS scoopt op org. */
export async function getMijnKlachten(): Promise<Klacht[]> {
  const sb = await getServerSupabase();
  if (!sb) return [];
  // select('*'): nieuwe kolommen (categorie) verschijnen vanzelf zodra de migratie gedraaid is.
  const { data } = await sb
    .from('klachten')
    .select('*, orders(ordernummer)')
    .order('created_at', { ascending: false });
  const rijen = (data as unknown as (Record<string, unknown> & { orders: { ordernummer: string | number | null } | null })[]) ?? [];
  // Berichten via de service role, maar alleen voor klachten die RLS hierboven al heeft doorgelaten.
  const berichten = await berichtenVoorKlant(rijen.map((k) => String(k.id)));
  return rijen.map((k) => ({
    id: String(k.id),
    order_id: (k.order_id as string) ?? null,
    soort: (k.soort === 'klacht' ? 'klacht' : 'vraag') as KlachtSoort,
    omschrijving: String(k.omschrijving ?? ''),
    status: (k.status as KlachtStatus) ?? 'open',
    antwoord: (k.antwoord as string) ?? null,
    created_at: String(k.created_at),
    ordernummer: k.orders?.ordernummer != null ? String(k.orders.ordernummer) : null,
    categorie: (k.categorie as string) ?? null,
    berichten: berichten.get(String(k.id)) ?? [],
  }));
}

/** Categorieën die de klant kan kiezen (beheerd onder Instellingen > Service). */
export async function getKlachtCategorieen(): Promise<string[]> {
  return (await getKlachtInstellingen()).categorieen;
}

/** Meldt een vraag of klacht aan binnen de eigen organisatie. Zet organisatie_id en medewerker_id op de eigen waarden. */
export async function meldKlacht(input: {
  orderId: string | null;
  soort: KlachtSoort;
  omschrijving: string;
  categorie?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = await getServerSupabase();
  if (!sb) return { ok: false, error: 'Portaal niet geconfigureerd' };
  const toegang = await getMijnToegang();
  if (!toegang.organisatieId) return { ok: false, error: 'Geen organisatie gekoppeld' };
  const inst = await getKlachtInstellingen();
  const categorie = input.categorie && inst.categorieen.includes(input.categorie) ? input.categorie : null;
  // Order alleen koppelen als RLS hem voor deze gebruiker laat zien (eigen organisatie).
  let orderId: string | null = null;
  if (input.orderId) {
    const { data: o } = await sb.from('orders').select('id').eq('id', input.orderId).maybeSingle();
    orderId = (o as { id: string } | null)?.id ?? null;
  }
  const rij: Record<string, unknown> = {
    organisatie_id: toegang.organisatieId,
    medewerker_id: toegang.medewerkerId,
    order_id: orderId,
    soort: input.soort,
    omschrijving: input.omschrijving,
    status: 'open',
    categorie,
    bron: 'portaal',
    prioriteit: 'normaal',
    sla_reactie_voor: slaDeadline(new Date().toISOString(), 'normaal', inst.sla),
  };
  const { error } = await metIdTerugval(rij, ['categorie', 'bron', 'prioriteit', 'sla_reactie_voor'], (x) =>
    sb.from('klachten').insert(x),
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Reactie van de klant op een eigen vraag of klacht. Eerst met RLS controleren dat de
 * klacht van de eigen organisatie is; pas dan via de service role het bericht wegschrijven.
 */
export async function reageerOpKlacht(klachtId: string, tekstIn: string): Promise<{ ok: boolean; error?: string }> {
  const sb = await getServerSupabase();
  if (!sb) return { ok: false, error: 'Portaal niet geconfigureerd' };
  const { data } = await sb.from('klachten').select('id').eq('id', klachtId).maybeSingle();
  if (!data) return { ok: false, error: 'Niet gevonden' };
  const { data: u } = await sb.auth.getUser();
  const res = await voegKlachtBerichtToe(klachtId, 'klant', tekstIn, u.user?.email ?? 'Klant');
  if (!res.ok) return { ok: false, error: res.zonderMigratie ? 'Reageren kan nog niet' : 'Opslaan mislukt' };
  return { ok: true };
}
