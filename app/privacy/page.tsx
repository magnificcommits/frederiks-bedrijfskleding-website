import type { Metadata } from 'next';
import { PageHero } from '@/components/PageHero';
import { site } from '@/content/site';

export const metadata: Metadata = {
  title: 'Privacyverklaring',
  description: 'Privacyverklaring van Frederiks Bedrijfskleding: welke gegevens we verwerken, waarom, hoe lang en wat je rechten zijn.',
  alternates: { canonical: '/privacy' },
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return (
    <>
      <PageHero eyebrow="Juridisch" title="Privacyverklaring" />
      <section className="container-lees py-16">
        <div className="prose-nl">
          <p>Frederiks Bedrijfskleding hecht waarde aan je privacy. We verwerken alleen de gegevens die nodig zijn om je vraag of aanvraag te beantwoorden, en gaan daar zorgvuldig mee om. Laat deze tekst voor livegang nog even controleren door een specialist.</p>
          <h2>Wie zijn wij</h2>
          <p>{site.name}, {site.address.street}, {site.address.postalCode} {site.address.city}. Te bereiken via {site.email} en {site.phone}.</p>
          <h2>Welke gegevens we verwerken</h2>
          <p>Als je het advies- of contactformulier invult, verwerken we je naam, bedrijfsnaam, e-mailadres, telefoonnummer en je bericht. We gebruiken die gegevens uitsluitend om je aanvraag te beantwoorden en je een passend aanbod te doen.</p>
          <h2>Statistieken</h2>
          <p>We gebruiken anonieme websitestatistieken (Google Analytics) om de site te verbeteren. Dit gebeurt alleen na jouw toestemming via de cookiemelding, en IP-adressen worden geanonimiseerd. We gebruiken geen advertentiecookies.</p>
          <h2>Wie je gegevens verder verwerkt</h2>
          <p>Voor de werking van de site en het formulier schakelen we dienstverleners in: onze hostingpartij (Vercel), onze e-maildienst (Resend) en, na toestemming, Google Analytics. Met deze partijen zijn of worden verwerkersafspraken gemaakt. We verkopen je gegevens niet.</p>
          <h2>Bewaartermijn</h2>
          <p>We bewaren aanvragen niet langer dan nodig is voor de afhandeling en een redelijke opvolging daarna.</p>
          <h2>Je rechten</h2>
          <p>Je hebt recht op inzage, correctie en verwijdering van je gegevens, en je kunt een gegeven toestemming intrekken. Neem hiervoor contact op via {site.email}. Je kunt ook een klacht indienen bij de Autoriteit Persoonsgegevens.</p>
        </div>
      </section>
    </>
  );
}
