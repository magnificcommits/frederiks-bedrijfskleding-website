/**
 * Wie stellen we deze week voor voor een Google-reviewuitnodiging? Puur
 * rekenwerk zonder database, zodat de regels te testen zijn.
 *
 * Regels:
 *  - de klant kreeg in de afgelopen 60 dagen een order geleverd;
 *  - geen cijfer van 6 of lager in de tevredenheidsmail in het afgelopen halfjaar;
 *  - nog geen uitnodiging verstuurd in het afgelopen jaar (een klant schrijft
 *    op Google toch maar één review);
 *  - niet in de afgelopen 90 dagen al voorgesteld of door Jessi overgeslagen;
 *  - hooguit MAX_PER_WEEK, wie een 9 of 10 gaf eerst, daarna de meest recente levering.
 */

export const MAX_PER_WEEK = 15;
const DAG = 86_400_000;

export type KandidaatOrder = { id: string; organisatie_id: string; geleverd_op: string; ordernummer: number | null };
export type KandidaatReview = { klant_id: string | null; score: number | null; beantwoord_op: string | null; created_at: string };
export type KandidaatUitnodiging = { organisatie_id: string; status: string; created_at: string; verstuurd_op: string | null };

export type Voorstel = { organisatie_id: string; order_id: string; reden: string; promotor: boolean; geleverd_op: string };

/** ISO-weeknummer als tekst, bv. 2026-W42. */
export function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dagNr = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dagNr);
  const jaarStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - jaarStart.getTime()) / DAG + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const datumNl = (iso: string) =>
  new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' });

export function kiesKandidaten(
  orders: KandidaatOrder[],
  reviews: KandidaatReview[],
  uitnodigingen: KandidaatUitnodiging[],
  nu: Date,
  max = MAX_PER_WEEK,
): Voorstel[] {
  const ouder = (iso: string | null, dagen: number) => !iso || nu.getTime() - new Date(iso).getTime() > dagen * DAG;

  const laatsteOrder = new Map<string, KandidaatOrder>();
  for (const o of orders) {
    if (!o.geleverd_op) continue;
    const leeftijd = nu.getTime() - new Date(o.geleverd_op).getTime();
    if (leeftijd < 0 || leeftijd > 60 * DAG) continue;
    const huidig = laatsteOrder.get(o.organisatie_id);
    if (!huidig || huidig.geleverd_op < o.geleverd_op) laatsteOrder.set(o.organisatie_id, o);
  }

  const laag = new Set<string>();
  const besteScore = new Map<string, number>();
  for (const r of reviews) {
    if (!r.klant_id || r.score === null) continue;
    const moment = r.beantwoord_op ?? r.created_at;
    if (r.score <= 6 && !ouder(moment, 180)) laag.add(r.klant_id);
    if (!ouder(moment, 90)) besteScore.set(r.klant_id, Math.max(besteScore.get(r.klant_id) ?? 0, r.score));
  }

  const geblokkeerd = new Set<string>();
  for (const u of uitnodigingen) {
    if (u.status === 'verstuurd' && !ouder(u.verstuurd_op ?? u.created_at, 365)) geblokkeerd.add(u.organisatie_id);
    if (u.status !== 'verstuurd' && !ouder(u.created_at, 90)) geblokkeerd.add(u.organisatie_id);
  }

  const lijst: Voorstel[] = [];
  for (const [org, o] of laatsteOrder) {
    if (laag.has(org) || geblokkeerd.has(org)) continue;
    const score = besteScore.get(org);
    const promotor = score !== undefined && score >= 9;
    const delen = [`${o.ordernummer ? `Order #${o.ordernummer}` : 'Order'} geleverd op ${datumNl(o.geleverd_op)}`];
    if (score !== undefined) delen.push(`gaf een ${score} in de tevredenheidsmail`);
    lijst.push({ organisatie_id: org, order_id: o.id, reden: delen.join(', '), promotor, geleverd_op: o.geleverd_op });
  }
  return lijst
    .sort((a, b) => Number(b.promotor) - Number(a.promotor) || (a.geleverd_op < b.geleverd_op ? 1 : -1))
    .slice(0, max);
}
