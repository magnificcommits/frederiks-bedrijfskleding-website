import { kmsAdmin } from '@/lib/kms/adminClient';
import { zoekWoorden, ilikeInKolommen, KLANT_ZOEKKOLOMMEN, klantIdsViaContactpersonen } from '@/lib/kms/zoeken';
import { AFGEHANDELDE_ORDERSTATUSSEN } from '@/lib/kms/orders';
import type { Organisatie } from '@/lib/portaalAdmin';
import type { FilterOptie } from '@/lib/filterBalk';
import { alleRijen } from '@/lib/alleRijen';
import { eisData } from '@/lib/dbFout';

/**
 * De klantenlijst met filters. Een lokale zaak heeft er een paar honderd, dus
 * de lijst wordt in één keer opgehaald (max. 1000, alleen de kolommen die de
 * lijst en de filters nodig hebben) en in geheugen gefilterd en gepagineerd.
 * Dat maakt filters als "klant sinds" (datum_klant, anders aanmaakdatum) en
 * "heeft open orders" eenvoudig en snel, zonder lange id-lijsten in de URL.
 *
 * De zoekterm gaat wel via de database: elk woord moet voorkomen in naam,
 * plaats, klantnummer of contactpersoon, of in naam of e-mail van een van de
 * contactpersonen van de klant.
 *
 * Boven ~1000 klanten moet dit terug naar filters in de query.
 */

const KOLOMMEN =
  'id, naam, plaats, telefoon, adres, postcode, created_at, klantnummer, branche, contactpersoon, actief, accountmanager, email_algemeen, factuur_email, datum_klant';

export type KlantLijstRij = Organisatie & {
  accountmanager: string | null;
  email_algemeen: string | null;
  factuur_email: string | null;
  datum_klant: string | null;
  open_orders: number;
  heeft_portaal: boolean;
};

export type KlantLijstFilters = {
  zoek?: string;
  branches?: string[];
  plaats?: string | null;
  actief?: 'ja' | 'nee' | null;
  portaal?: 'ja' | 'nee' | null;
  openOrders?: 'ja' | 'nee' | null;
  /** Klant sinds, inclusief, ISO-datum. Op datum_klant, anders de aanmaakdatum. */
  sindsVan?: string | null;
  /** Klant sinds, exclusief, ISO-datum. */
  sindsTotExclusief?: string | null;
  /** Naam van de accountmanager, of '-' voor "niet ingevuld". */
  accountmanager?: string | null;
  email?: 'met' | 'zonder' | null;
  contact?: 'met' | 'zonder' | null;
  /** Alleen deze ids (bijv. mogelijk dubbele klanten). */
  ids?: string[] | null;
};

export type KlantFilterOpties = {
  branches: FilterOptie[];
  plaatsen: FilterOptie[];
  accountmanagers: FilterOptie[];
  totaal: number;
};

const leeg = (s: string | null | undefined) => !String(s ?? '').trim();

/** Eén pagina klanten met filters, plus het aantal na filteren en de opties voor de filters. */
export async function listKlantenGefilterd(
  opts: { pagina: number; perPagina: number } & KlantLijstFilters,
): Promise<{ rijen: KlantLijstRij[]; totaal: number; opties: KlantFilterOpties }> {
  const sb = kmsAdmin();
  const leegResultaat = { rijen: [], totaal: 0, opties: { branches: [], plaatsen: [], accountmanagers: [], totaal: 0 } };
  if (!sb) return leegResultaat;

  const woorden = zoekWoorden(opts.zoek);
  const zoekIds = async (): Promise<Set<string> | null> => {
    if (!woorden.length) return null;
    let q = sb.from('organisaties').select('id');
    // Per woord één or-filter; meerdere or-filters gelden samen (EN).
    const viaContact = await klantIdsViaContactpersonen(sb, woorden);
    woorden.forEach((w, i) => {
      const ids = viaContact[i] ?? [];
      const extra = ids.length ? `,id.in.(${ids.join(',')})` : '';
      q = q.or(ilikeInKolommen(KLANT_ZOEKKOLOMMEN, w) + extra);
    });
    const data = eisData('klanten.zoeken', await q.limit(1000));
    return new Set(((data as { id: string }[] | null) ?? []).map((r) => r.id));
  };

  // In blokken van 1000 (alleRijen): Supabase kapt elk verzoek stil af op 1000 rijen.
  // Een fout in de klantenquery zelf geeft een foutmelding in plaats van een lege lijst;
  // de hulptellingen (portaal, open orders, contacten) vallen bij een fout terug op leeg.
  type OrgId = { organisatie_id: string | null };
  const [alleRuw, gezocht, portaalRijen, orderRijen, contactRijen] = await Promise.all([
    alleRijen('klanten.lijst', (van, tot) => sb.from('organisaties').select(KOLOMMEN).order('naam').order('id').range(van, tot)),
    zoekIds(),
    alleRijen<OrgId>('klanten.portaal', (van, tot) => sb.from('portaal_gebruikers').select('organisatie_id').order('id').range(van, tot), { bijFout: 'leeg' }),
    alleRijen<OrgId>(
      'klanten.openOrders',
      (van, tot) =>
        sb
          .from('orders')
          .select('organisatie_id')
          .not('status', 'in', `(${AFGEHANDELDE_ORDERSTATUSSEN.join(',')})`)
          .order('id')
          .range(van, tot),
      { bijFout: 'leeg' },
    ),
    opts.contact
      ? alleRijen<OrgId>('klanten.contacten', (van, tot) => sb.from('contactpersonen').select('organisatie_id').order('id').range(van, tot), { bijFout: 'leeg' })
      : Promise.resolve([] as OrgId[]),
  ]);

  const alle = alleRuw as unknown as Omit<KlantLijstRij, 'open_orders' | 'heeft_portaal'>[];
  const metPortaal = new Set(portaalRijen.map((r) => r.organisatie_id).filter(Boolean) as string[]);
  const openPerOrg = new Map<string, number>();
  for (const r of orderRijen) {
    if (r.organisatie_id) openPerOrg.set(r.organisatie_id, (openPerOrg.get(r.organisatie_id) ?? 0) + 1);
  }
  const metContactRij = new Set(contactRijen.map((r) => r.organisatie_id).filter(Boolean) as string[]);

  // Opties voor de filters, geteld over alle klanten (niet over het filterresultaat):
  // zo zie je ook hoeveel er in een branche zitten die je nog niet gekozen hebt.
  const tel = (sleutel: (o: (typeof alle)[number]) => string | null) => {
    const m = new Map<string, number>();
    for (const o of alle) {
      const k = sleutel(o);
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'nl')).map(([waarde, aantal]) => ({ waarde, label: waarde, aantal }));
  };
  const zonderAm = alle.filter((o) => leeg(o.accountmanager)).length;
  const opties: KlantFilterOpties = {
    branches: tel((o) => o.branche?.trim() || null),
    plaatsen: tel((o) => o.plaats?.trim() || null),
    accountmanagers: [...tel((o) => o.accountmanager?.trim() || null), ...(zonderAm ? [{ waarde: '-', label: 'Niet ingevuld', aantal: zonderAm }] : [])],
    totaal: alle.length,
  };

  const branches = new Set((opts.branches ?? []).map((b) => b.toLowerCase()));
  const idsFilter = opts.ids ? new Set(opts.ids) : null;
  const gefilterd = alle.filter((o) => {
    if (gezocht && !gezocht.has(o.id)) return false;
    if (idsFilter && !idsFilter.has(o.id)) return false;
    if (branches.size && !branches.has((o.branche ?? '').trim().toLowerCase())) return false;
    if (opts.plaats && (o.plaats ?? '').trim().toLowerCase() !== opts.plaats.toLowerCase()) return false;
    // actief null telt als actief: zo staat het ook in de rest van het dashboard.
    if (opts.actief === 'ja' && o.actief === false) return false;
    if (opts.actief === 'nee' && o.actief !== false) return false;
    if (opts.portaal === 'ja' && !metPortaal.has(o.id)) return false;
    if (opts.portaal === 'nee' && metPortaal.has(o.id)) return false;
    if (opts.openOrders === 'ja' && !openPerOrg.has(o.id)) return false;
    if (opts.openOrders === 'nee' && openPerOrg.has(o.id)) return false;
    if (opts.sindsVan || opts.sindsTotExclusief) {
      const sinds = (o.datum_klant || o.created_at || '').slice(0, 10);
      if (!sinds) return false;
      if (opts.sindsVan && sinds < opts.sindsVan) return false;
      if (opts.sindsTotExclusief && sinds >= opts.sindsTotExclusief) return false;
    }
    if (opts.accountmanager) {
      if (opts.accountmanager === '-' ? !leeg(o.accountmanager) : (o.accountmanager ?? '').trim() !== opts.accountmanager) return false;
    }
    if (opts.email) {
      const heeft = !leeg(o.email_algemeen) || !leeg(o.factuur_email);
      if (opts.email === 'met' ? !heeft : heeft) return false;
    }
    if (opts.contact) {
      const heeft = !leeg(o.contactpersoon) || metContactRij.has(o.id);
      if (opts.contact === 'met' ? !heeft : heeft) return false;
    }
    return true;
  });

  const pagina = Math.max(1, opts.pagina);
  const from = (pagina - 1) * opts.perPagina;
  const rijen = gefilterd.slice(from, from + opts.perPagina).map((o) => ({
    ...o,
    open_orders: openPerOrg.get(o.id) ?? 0,
    heeft_portaal: metPortaal.has(o.id),
  }));
  return { rijen, totaal: gefilterd.length, opties };
}
