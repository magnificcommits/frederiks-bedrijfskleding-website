import type { Metadata } from 'next';
import { PageHero } from '@/components/PageHero';
import { site } from '@/content/site';

export const metadata: Metadata = {
  title: 'Disclaimer',
  description: 'Disclaimer voor de website van Frederiks Bedrijfskleding.',
  alternates: { canonical: '/disclaimer' },
  robots: { index: false, follow: true },
};

export default function DisclaimerPage() {
  return (
    <>
      <PageHero eyebrow="Juridisch" title="Disclaimer" />
      <section className="container-lees py-16">
        <div className="prose-nl">
          <p>We stellen de informatie op deze website met zorg samen. Toch kunnen we niet garanderen dat alles altijd volledig, juist en actueel is. Aan de inhoud kunnen geen rechten worden ontleend.</p>
          <h2>Informatie over normen en regels</h2>
          <p>Onze kennisbank geeft praktische uitleg over onder meer veiligheidsnormen en fiscale regels. Dit is algemene informatie, geen bindend advies. Voor jouw specifieke situatie verwijzen we naar de officiele bron of een adviseur.</p>
          <h2>Links naar andere sites</h2>
          <p>Deze website kan verwijzingen bevatten naar websites van derden. We zijn niet verantwoordelijk voor de inhoud of het privacybeleid van die sites.</p>
          <h2>Auteursrecht</h2>
          <p>Teksten, beeld en vormgeving op deze site zijn eigendom van {site.name}. Overname zonder toestemming is niet toegestaan.</p>
          <h2>Vragen</h2>
          <p>Heb je een vraag over deze disclaimer? Neem contact op via {site.email}.</p>
        </div>
      </section>
    </>
  );
}
