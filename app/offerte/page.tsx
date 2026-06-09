import type { Metadata } from 'next';
import { LeadForm } from '@/components/LeadForm';
import { PageHero } from '@/components/PageHero';
import { site } from '@/content/site';

export const metadata: Metadata = {
  title: 'Vraag vrijblijvend advies of een offerte aan',
  description: 'Vraag vrijblijvend kledingadvies of een offerte aan bij Frederiks Bedrijfskleding. Persoonlijk contact, passen op locatie en eigen bedrukken in de Achterhoek.',
  alternates: { canonical: '/offerte' },
};

export default async function OffertePage({ searchParams }: { searchParams: Promise<{ branche?: string }> }) {
  const { branche } = await searchParams;
  return (
    <>
      <PageHero eyebrow="Advies & offerte" title="Vraag vrijblijvend advies aan"
        intro="Vertel ons wat u zoekt. We nemen persoonlijk contact op, denken met u mee en komen graag langs om te passen." />
      <section className="container-x py-16">
        <div className="grid gap-10 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <LeadForm defaultBranche={branche ?? ''} />
          </div>
          <aside className="lg:col-span-2">
            <div className="card">
              <h2 className="text-lg font-semibold text-ink-800">Liever direct contact?</h2>
              <p className="mt-2 text-sm text-warm">We zijn telefonisch en via WhatsApp bereikbaar.</p>
              <p className="mt-4 text-sm">
                <a href={`tel:${site.phoneIntl}`} className="font-semibold text-amber-600 hover:underline">{site.phone}</a><br />
                <a href={`mailto:${site.email}`} className="font-semibold text-amber-600 hover:underline">{site.email}</a>
              </p>
              <hr className="my-5 border-line" />
              <h3 className="text-sm font-semibold text-ink-800">Wat u kunt verwachten</h3>
              <ul className="prose-nl mt-2 text-sm">
                <li>Persoonlijk advies, afgestemd op uw branche</li>
                <li>Passen op locatie, geen werktijd kwijt</li>
                <li>Eigen bedrukken & borduren, slijtvast</li>
                <li>Snelle nalevering van uw vaste kledinglijn</li>
              </ul>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
