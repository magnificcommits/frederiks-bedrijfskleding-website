import { verstuurAfspraakHerinneringen } from '@/lib/afspraken/afspraken';
import { verstuurNpsMails, type NpsRapport } from '@/lib/reviews/reviews';
import { stelReviewUitnodigingenVoor, type VoorstelRapport } from '@/lib/reviews/uitnodigingen';

/**
 * Dagelijkse klantmails, aangeroepen door de dagelijkse Vercel-cron
 * (/api/cron/nieuwsbrief, 06:00 UTC) en handmatig via /api/cron/klantmails:
 *  - herinnering voor de online afspraken van morgen;
 *  - tevredenheidsmail (NPS) voor orders die lang genoeg geleverd zijn;
 *  - op maandag de voorstellijst voor Google-reviewuitnodigingen (Jessi accordeert, er gaat niets vanzelf uit).
 * Beide zijn idempotent: een tweede ronde op dezelfde dag verstuurt niets dubbel.
 */
export type KlantmailRapport = {
  afspraakHerinneringen: { verstuurd: number; mislukt: number } | { fout: string };
  nps: NpsRapport | { fout: string };
  reviewUitnodigingen: VoorstelRapport | { fout: string };
};

export async function verwerkDagelijkseKlantmails(nu = new Date()): Promise<KlantmailRapport> {
  const [herinnering, nps, uitnodigingen] = await Promise.allSettled([verstuurAfspraakHerinneringen(nu), verstuurNpsMails({ nu }), stelReviewUitnodigingenVoor(nu)]);
  return {
    afspraakHerinneringen: herinnering.status === 'fulfilled' ? herinnering.value : { fout: String(herinnering.reason) },
    nps: nps.status === 'fulfilled' ? nps.value : { fout: String(nps.reason) },
    reviewUitnodigingen: uitnodigingen.status === 'fulfilled' ? uitnodigingen.value : { fout: String(uitnodigingen.reason) },
  };
}
