import { unstable_cache } from 'next/cache';
import { reviews as vasteReviews } from '@/content/reviews';
import { site } from '@/content/site';
import { Stars } from '@/components/Stars';
import { JsonLd } from '@/components/JsonLd';
import { alleReviewCijfers, gepubliceerdeReviews, type PubliekeReview } from '@/lib/reviews/publiek';
import { reviewCijfers, type ReviewCijfers } from '@/lib/reviews/cijfers';
import { REVIEWS_TAG } from '@/lib/reviews/tag';

/**
 * Gepubliceerde reviews uit de database, een uur gecachet (en direct ververst
 * via revalidateTag bij publiceren in het KMS). Faalt de database of staat er
 * nog niets online, dan valt het blok terug op de vaste reviews in content/reviews.ts.
 */
const haalReviews = unstable_cache(
  async (): Promise<PubliekeReview[]> => {
    try {
      return await gepubliceerdeReviews();
    } catch {
      return [];
    }
  },
  ['gepubliceerde-reviews'],
  { revalidate: 3600, tags: [REVIEWS_TAG] },
);

/**
 * Gemiddelde en aantal over alle beantwoorde beoordelingen, niet alleen de
 * gepubliceerde. Zelfde cache en tag als de lijst.
 */
const haalCijfers = unstable_cache(
  async (): Promise<ReviewCijfers> => {
    try {
      return await alleReviewCijfers();
    } catch {
      return reviewCijfers([]);
    }
  },
  ['review-cijfers'],
  { revalidate: 3600, tags: [REVIEWS_TAG] },
);

type Kaart = { key: string; auteur: string; sub: string | null; tekst: string; sterren: number; cijfer: number | null };

function cijferTekst(n: number): string {
  return n.toFixed(1).replace('.', ',');
}

export async function Reviews({ limit }: { limit?: number }) {
  const [uitDb, cijfers] = await Promise.all([haalReviews(), haalCijfers()]);
  const echt = uitDb.length > 0;

  const kaarten: Kaart[] = echt
    ? uitDb.map((r) => ({
        key: r.id,
        auteur: r.bedrijf || r.naam || 'Klant van Frederiks',
        sub: r.bedrijf && r.naam ? r.naam : r.branche,
        tekst: r.tekst,
        sterren: Math.max(1, Math.round(r.score / 2)),
        cijfer: r.score,
      }))
    : vasteReviews.map((r) => ({ key: r.author, auteur: r.author, sub: null, tekst: r.text, sterren: r.rating, cijfer: null }));
  const lijst = limit ? kaarten.slice(0, limit) : kaarten;

  // Gemiddelde over alle beantwoorde beoordelingen; onder de vijf tonen we er geen.
  const gemiddelde = cijfers.toonbaar ? cijfers.gemiddelde : null;

  // Structured data alleen met echte beoordelingen. Schaal 0-10, zoals gevraagd in de mail.
  // aggregateRating telt alle antwoorden en komt er pas bij vanaf vijf; losse gepubliceerde
  // reviews mogen er altijd in.
  const jsonLd =
    echt || gemiddelde !== null
      ? {
          '@context': 'https://schema.org',
          '@type': 'LocalBusiness',
          '@id': `${site.url}/#bedrijf`,
          name: site.name,
          ...(gemiddelde !== null
            ? {
                aggregateRating: {
                  '@type': 'AggregateRating',
                  ratingValue: gemiddelde,
                  ratingCount: cijfers.aantal,
                  bestRating: 10,
                  worstRating: 0,
                },
              }
            : {}),
          ...(echt
            ? {
                review: uitDb.slice(0, 20).map((r) => ({
                  '@type': 'Review',
                  author: r.bedrijf ? { '@type': 'Organization', name: r.bedrijf } : { '@type': 'Person', name: r.naam || 'Klant' },
                  reviewRating: { '@type': 'Rating', ratingValue: r.score, bestRating: 10, worstRating: 0 },
                  reviewBody: r.tekst,
                })),
              }
            : {}),
        }
      : null;

  return (
    <section className="bg-ink-900 text-white">
      {jsonLd && <JsonLd data={jsonLd} />}
      <div className="container-x py-16 sm:py-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-amber-400">Referenties</p>
            <h2 className="mt-3 text-3xl font-extrabold text-white sm:text-4xl">Wat klanten over ons zeggen</h2>
          </div>
          {gemiddelde !== null ? (
            <div className="flex items-center gap-2 text-sm text-ink-200">
              <Stars value={Math.round(gemiddelde / 2)} />
              <span>
                Gemiddeld een <strong className="text-white">{cijferTekst(gemiddelde)}</strong> uit 10, van {cijfers.aantal} klanten
              </span>
            </div>
          ) : (
            !echt &&
            site.rating.count > 0 && (
              <div className="flex items-center gap-2 text-sm text-ink-200">
                <Stars value={Math.round(site.rating.value)} />
                <span>Beoordeeld met een <strong className="text-white">{site.rating.value.toFixed(1)}</strong> uit 5</span>
              </div>
            )
          )}
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {lijst.map((r) => (
            <figure key={r.key} className="flex flex-col rounded-xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center gap-2">
                <Stars value={r.sterren} />
                {r.cijfer !== null && <span className="text-xs font-semibold text-ink-200">{r.cijfer}/10</span>}
              </div>
              <blockquote className="mt-3 grow text-sm leading-relaxed text-ink-100">“{r.tekst}”</blockquote>
              <figcaption className="mt-4 text-sm font-bold text-white">
                {r.auteur}
                {r.sub && <span className="block text-xs font-normal text-ink-300">{r.sub}</span>}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
