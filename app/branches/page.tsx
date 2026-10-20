import type { Metadata } from 'next';
import { PageHero } from '@/components/PageHero';
import { BrancheTegel } from '@/components/BrancheGrid';
import { CtaBand } from '@/components/CtaBand';
import { alleBranchesOverzicht } from '@/content/branches';

export const metadata: Metadata = {
  title: 'Bedrijfskleding per branche',
  description: 'Bedrijfskleding voor iedere branche in de Achterhoek: bouw, installatie, industrie, agrarisch, horeca, zorg, schoonmaak, sport en meer. Persoonlijk advies en jouw logo erop.',
  alternates: { canonical: '/branches' },
};

export default function BranchesPage() {
  return (
    <>
      <PageHero
        eyebrow="Branches"
        title="Bedrijfskleding voor iedere branche"
        intro="Van bouw en techniek tot horeca en sport. Wij helpen je de juiste kleding te vinden die past bij jouw werkzaamheden én de uitstraling van je bedrijf."
      />
      <section className="bg-white">
        <div className="container-x sec-md">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
            {alleBranchesOverzicht.map((b) => <BrancheTegel key={b.slug} b={b} />)}
          </div>
        </div>
      </section>
      <CtaBand />
    </>
  );
}
