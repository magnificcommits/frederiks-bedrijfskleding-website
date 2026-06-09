import type { Metadata } from 'next';
import { PageHero } from '@/components/PageHero';
import { site } from '@/content/site';

export const metadata: Metadata = {
  title: 'Privacyverklaring',
  description: 'Privacyverklaring van Frederiks Bedrijfskleding: welke gegevens we verwerken en waarom.',
  alternates: { canonical: '/privacy' },
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return (
    <>
      <PageHero eyebrow="Juridisch" title="Privacyverklaring" />
      <section className="container-x py-16">
        <div className="prose-nl">
          <p><em>Concept. Laat dit vóór livegang controleren en aanvullen (AVG). Zie project-standards/data/AVG.md.</em></p>
          <h2>Wie zijn wij</h2>
          <p>{site.name}, {site.address.street}, {site.address.postalCode} {site.address.city}. Contact: {site.email}, {site.phone}.</p>
          <h2>Welke gegevens verwerken we</h2>
          <p>Als u het contact- of adviesformulier invult, verwerken we uw naam, bedrijf, e-mailadres, telefoonnummer en uw bericht. We gebruiken deze gegevens uitsluitend om uw aanvraag te beantwoorden en u een passend aanbod te doen.</p>
          <h2>Bewaartermijn</h2>
          <p>We bewaren aanvragen niet langer dan nodig voor de afhandeling en eventuele opvolging.</p>
          <h2>Uw rechten</h2>
          <p>U heeft het recht op inzage, correctie en verwijdering van uw gegevens. Neem hiervoor contact met ons op via {site.email}.</p>
          <h2>Statistieken</h2>
          <p>We gebruiken (na toestemming) statistieken om de website te verbeteren. IP-adressen worden daarbij geanonimiseerd.</p>
        </div>
      </section>
    </>
  );
}
