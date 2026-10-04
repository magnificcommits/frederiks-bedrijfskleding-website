import type { Metadata } from 'next';
import { PageHero } from '@/components/PageHero';
import { getReviewInstellingen, getReviewOpToken } from '@/lib/reviews/reviews';
import { site } from '@/content/site';
import Beoordeling from './Beoordeling';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Hoe tevreden ben je?',
  robots: { index: false, follow: false },
};

export default async function BeoordelingPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ score?: string }>;
}) {
  const [{ token }, { score }] = await Promise.all([params, searchParams]);
  const [review, inst] = await Promise.all([getReviewOpToken(token), getReviewInstellingen()]);

  if (!review) {
    return (
      <PageHero
        eyebrow="Beoordeling"
        title="Deze link werkt niet (meer)"
        intro={`Wil je toch iets kwijt over je bestelling? Mail ${site.email} of bel ${site.phone}. Jessi leest alles zelf.`}
      />
    );
  }

  const gevraagd = score !== undefined && /^(10|[0-9])$/.test(score) ? Number(score) : null;

  return (
    <>
      <PageHero eyebrow="Beoordeling" title="Bedankt dat je even de tijd neemt" />
      <section className="container-x sec-md">
        <div className="mx-auto max-w-[44rem]">
          <Beoordeling
            token={review.token ?? token}
            opgeslagenScore={review.score}
            gevraagdeScore={gevraagd}
            naam={review.naam ?? ''}
            bedrijf={review.bedrijf ?? ''}
            tekst={review.tekst ?? ''}
            toestemming={review.toestemming_publiceren}
            googleLink={inst.googleLink}
          />
        </div>
      </section>
    </>
  );
}
