import { kmsAdmin, leesLinkToken, maakLinkToken } from '@/lib/kms/adminClient';
import { getOfferte, maakOrderVanOfferteMetUitkomst, offerteTotalen, zetOfferteStatus, type OfferteDetail } from '@/lib/kms/offertes';
import { VOORWAARDEN_VERSIE } from '@/content/algemeneVoorwaarden';

/**
 * Offerte online goedkeuren (Jessi, 27 okt, punt 1.5). De klant krijgt in de
 * offertemail een knop naar /akkoord/<token>. Daar ziet hij de offerte en de
 * voorwaarden, vult zijn naam in en keurt goed. Dat wordt vastgelegd in
 * offerte_akkoorden, de offerte gaat op geaccepteerd en er komt meteen een order.
 *
 * De token is het offerte-id met een handtekening (geen database nodig). De link
 * werkt zolang de offerte geldig is en nog niet is goedgekeurd of afgewezen.
 */
const DOEL = 'offerte-akkoord';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function offerteAkkoordToken(offerteId: string): string | null {
  return maakLinkToken(DOEL, offerteId);
}

export function offerteIdUitToken(token: string): string | null {
  const id = leesLinkToken(DOEL, decodeURIComponent(token ?? ''));
  return id && UUID.test(id) ? id : null;
}

export type OfferteAkkoord = {
  naam: string;
  functie: string | null;
  email: string | null;
  totaal_incl: number | null;
  voorwaarden_versie: string;
  akkoord_op: string;
};

export async function getOfferteAkkoord(offerteId: string): Promise<OfferteAkkoord | null> {
  const sb = kmsAdmin(); if (!sb || !offerteId) return null;
  const { data, error } = await sb
    .from('offerte_akkoorden')
    .select('naam, functie, email, totaal_incl, voorwaarden_versie, akkoord_op')
    .eq('offerte_id', offerteId)
    .maybeSingle();
  if (error || !data) return null;
  return data as OfferteAkkoord;
}

function vandaag(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date());
}

export type AkkoordStaat =
  | { staat: 'onbekend' }
  | { staat: 'open'; offerte: OfferteDetail }
  | { staat: 'goedgekeurd'; offerte: OfferteDetail; akkoord: OfferteAkkoord | null }
  | { staat: 'afgewezen' | 'verlopen'; offerte: OfferteDetail };

/** Wat de klant op de akkoordpagina ziet. */
export async function akkoordStaatVoorToken(token: string): Promise<AkkoordStaat> {
  const id = offerteIdUitToken(token);
  if (!id) return { staat: 'onbekend' };
  const offerte = await getOfferte(id);
  if (!offerte || offerte.status === 'concept') return { staat: 'onbekend' };
  if (offerte.status === 'geaccepteerd') return { staat: 'goedgekeurd', offerte, akkoord: await getOfferteAkkoord(id) };
  if (offerte.status === 'afgewezen') return { staat: 'afgewezen', offerte };
  if (offerte.geldig_tot && String(offerte.geldig_tot).slice(0, 10) < vandaag()) return { staat: 'verlopen', offerte };
  return { staat: 'open', offerte };
}

export type AkkoordUitkomst =
  | { ok: true; offerte: OfferteDetail; orderId: string | null; totaal: number }
  | { ok: false; reden: 'onbekend' | 'al' | 'afgewezen' | 'verlopen' | 'opslaan' };

/** Legt het akkoord vast, zet de offerte op geaccepteerd en maakt de order. */
export async function registreerOfferteAkkoord(
  token: string,
  invoer: { naam: string; functie: string | null; email: string | null; ip: string | null; userAgent: string | null },
): Promise<AkkoordUitkomst> {
  const staat = await akkoordStaatVoorToken(token);
  if (staat.staat === 'onbekend') return { ok: false, reden: 'onbekend' };
  if (staat.staat === 'goedgekeurd') return { ok: false, reden: 'al' };
  if (staat.staat === 'afgewezen' || staat.staat === 'verlopen') return { ok: false, reden: staat.staat };
  const sb = kmsAdmin(); if (!sb) return { ok: false, reden: 'opslaan' };
  const { offerte } = staat;
  const { totaal } = offerteTotalen(offerte.regels, offerte.btw_pct);

  // Eerst het akkoord: de unieke sleutel op offerte_id voorkomt een dubbel akkoord.
  const { error } = await sb.from('offerte_akkoorden').insert({
    offerte_id: offerte.id,
    naam: invoer.naam,
    functie: invoer.functie,
    email: invoer.email,
    totaal_incl: Math.round(totaal * 100) / 100,
    voorwaarden_versie: VOORWAARDEN_VERSIE,
    ip: invoer.ip,
    user_agent: invoer.userAgent,
  });
  if (error) return { ok: false, reden: error.code === '23505' ? 'al' : 'opslaan' };

  // Order maken (zet de offerte ook op geaccepteerd). Zonder klant (offerte aan
  // een lead) kan dat niet: dan alleen de status, Jessi maakt de klant en order.
  let orderId: string | null = null;
  const uitkomst = await maakOrderVanOfferteMetUitkomst(offerte.id).catch(() => ({ fout: 'opslaan' as const }));
  if ('orderId' in uitkomst) {
    orderId = uitkomst.orderId;
    // De klant heeft akkoord gegeven: de order staat klaar voor de passessie.
    await sb.from('orders').update({ status: 'offerte_goedgekeurd' }).eq('id', orderId).eq('status', 'concept');
  } else {
    await zetOfferteStatus(offerte.id, 'geaccepteerd');
  }
  return { ok: true, offerte, orderId, totaal };
}
