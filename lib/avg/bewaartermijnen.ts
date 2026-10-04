import { kmsAdmin } from '@/lib/kms/adminClient';

/**
 * Bewaartermijnen (AVG: niet langer bewaren dan nodig). Draait dagelijks mee in
 * /api/cron/nieuwsbrief. Logregels, plus persoonsgegevens die hun doel hebben
 * gehad. Nooit bedrijfsgegevens (orders, facturen, klanten). Wijzig een termijn
 * hier en leg de reden vast in docs/security-audit-2026-10.md.
 *
 *   login_pogingen              1 dag      gehashte inlog-/formulierpogingen (rate limiting)
 *   api_log                     90 dagen   verzoeken op de klant-API (sleutel, pad, medewerker-id)
 *   taak_meldingen_log          90 dagen   welke taakmail naar wie ging
 *   campagne_events             12 maanden opens/kliks per campagne-inschrijving
 *   prospect_bezoeken           24 maanden bezoeken aan kennismakingspagina's
 *   audit_log                   24 maanden wie deed wat in het KMS
 *   nieuwsbrief_inschrijvingen  30 dagen   alleen aanmeldingen die nooit zijn bevestigd (double opt-in)
 *   afspraken                   24 maanden na de afspraak zelf (start_op)
 *   reviews                     12 maanden alleen verzoeken waar nooit een score op kwam
 *
 * Bewust NIET opgeschoond: factuur_mail_log (bewijs van factuurverzending, valt
 * onder de fiscale bewaarplicht van 7 jaar), status_historie (hoort bij de order)
 * en beantwoorde reviews (die tellen mee in de NPS).
 */
export type Bewaartermijn = {
  tabel: string;
  /** Datumkolom waarop de termijn telt. */
  kolom: string;
  dagen: number;
  /** Alleen rijen waarin deze kolommen leeg zijn. */
  leeg?: string[];
  /** Alleen rijen waarin deze kolommen gevuld zijn. */
  gevuld?: string[];
};

export const BEWAARTERMIJNEN: Bewaartermijn[] = [
  { tabel: 'login_pogingen', kolom: 'created_at', dagen: 1 },
  { tabel: 'api_log', kolom: 'created_at', dagen: 90 },
  { tabel: 'taak_meldingen_log', kolom: 'verstuurd_op', dagen: 90 },
  { tabel: 'campagne_events', kolom: 'created_at', dagen: 365 },
  { tabel: 'prospect_bezoeken', kolom: 'created_at', dagen: 730 },
  { tabel: 'audit_log', kolom: 'created_at', dagen: 730 },
  // Double opt-in: wel aangemeld (er is een bevestig_token), nooit op de link geklikt.
  // Inschrijvingen van voor de opt-in hebben geen token en blijven dus staan.
  { tabel: 'nieuwsbrief_inschrijvingen', kolom: 'created_at', dagen: 30, leeg: ['bevestigd_op'], gevuld: ['bevestig_token'] },
  { tabel: 'afspraken', kolom: 'start_op', dagen: 730 },
  { tabel: 'reviews', kolom: 'created_at', dagen: 365, leeg: ['score', 'beantwoord_op'] },
];

/** De grens (ISO) waarvoor rijen van deze regel weg mogen. */
export function bewaarGrens(regel: Pick<Bewaartermijn, 'dagen'>, nu = Date.now()): string {
  return new Date(nu - regel.dagen * 86_400_000).toISOString();
}

export type OpschoonUitkomst = { tabel: string; verwijderd: number | null; fout?: string };

/** Verwijdert rijen ouder dan de bewaartermijn (met de filters van de regel). Faalt nooit hard: een fout per tabel wordt teruggegeven. */
export async function ruimOudeLogsOp(nu = Date.now()): Promise<OpschoonUitkomst[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const uitkomst: OpschoonUitkomst[] = [];
  for (const regel of BEWAARTERMIJNEN) {
    const { tabel, kolom } = regel;
    const grens = bewaarGrens(regel, nu);
    try {
      let q = sb.from(tabel).delete({ count: 'exact' }).lt(kolom, grens);
      for (const k of regel.leeg ?? []) q = q.is(k, null);
      for (const k of regel.gevuld ?? []) q = q.not(k, 'is', null);
      const { error, count } = await q;
      uitkomst.push(error ? { tabel, verwijderd: null, fout: error.message } : { tabel, verwijderd: count ?? 0 });
    } catch (e) {
      uitkomst.push({ tabel, verwijderd: null, fout: e instanceof Error ? e.message : 'onbekend' });
    }
  }
  return uitkomst;
}
