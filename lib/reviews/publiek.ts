import { kmsAdmin } from '@/lib/kms/adminClient';
import { reviewCijfers, type ReviewCijfers } from '@/lib/reviews/cijfers';

/**
 * Gepubliceerde reviews voor de website. Los bestand met alleen de database-
 * client, zodat publieke pagina's niet de hele reviewmodule (mail, orders) laden.
 */

export type PubliekeReview = { id: string; score: number; tekst: string; naam: string | null; bedrijf: string | null; branche: string | null; uitgelicht: boolean };

/** Gepubliceerde reviews voor de site: uitgelicht eerst, dan nieuwste. Alleen met toestemming. */
export async function gepubliceerdeReviews(): Promise<PubliekeReview[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from('reviews')
    .select('id, score, tekst, naam, bedrijf, branche, uitgelicht, gepubliceerd_op')
    .eq('gepubliceerd', true)
    .eq('toestemming_publiceren', true)
    .not('score', 'is', null)
    .not('tekst', 'is', null)
    .order('uitgelicht', { ascending: false })
    .order('gepubliceerd_op', { ascending: false })
    .limit(60);
  if (error) return [];
  return ((data as (PubliekeReview & { gepubliceerd_op: string | null })[]) ?? []).map((r) => ({
    id: r.id,
    score: r.score,
    tekst: r.tekst,
    naam: r.naam,
    bedrijf: r.bedrijf,
    branche: r.branche,
    uitgelicht: r.uitgelicht,
  }));
}

/**
 * Gemiddelde en aantal over alle beantwoorde beoordelingen (ook de niet
 * gepubliceerde). Publieke lezer: bij een fout geen cijfers, de pagina blijft werken.
 */
export async function alleReviewCijfers(): Promise<ReviewCijfers> {
  const sb = kmsAdmin();
  if (!sb) return reviewCijfers([]);
  const { data, error } = await sb.from('reviews').select('score').not('score', 'is', null).limit(10000);
  if (error) return reviewCijfers([]);
  return reviewCijfers(((data as { score: number | null }[]) ?? []).map((r) => r.score));
}
