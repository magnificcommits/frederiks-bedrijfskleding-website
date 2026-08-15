import type { Metadata } from 'next';
import { PageHero } from '@/components/PageHero';
import { site } from '@/content/site';

export const metadata: Metadata = {
  title: 'Algemene voorwaarden',
  description: 'De algemene voorwaarden van Frederiks Bedrijfskleding.',
  alternates: { canonical: '/algemene-voorwaarden' },
  robots: { index: false, follow: true },
};

export default function VoorwaardenPage() {
  return (
    <>
      <PageHero eyebrow="Juridisch" title="Algemene voorwaarden" />
      <section className="container-lees py-16">
        <div className="prose-nl">
          <p>Dit is een werkversie van de algemene voorwaarden. Laat deze voor livegang controleren en aanvullen door een jurist, of gebruik de voorwaarden van je brancheorganisatie.</p>
          <h2>Toepasselijkheid</h2>
          <p>Deze voorwaarden gelden voor alle offertes, opdrachten en leveringen van {site.name}, gevestigd aan {site.address.street}, {site.address.postalCode} {site.address.city}.</p>
          <h2>Offertes en prijzen</h2>
          <p>Offertes zijn vrijblijvend en dertig dagen geldig, tenzij anders vermeld. Prijzen zijn exclusief btw, tenzij anders aangegeven. Bedrukken en borduren gebeurt op basis van het door de klant aangeleverde logo.</p>
          <h2>Levering en maatwerk</h2>
          <p>Genoemde levertijden zijn een indicatie. Op maat bedrukte of geborduurde artikelen worden in opdracht van de klant gepersonaliseerd en kunnen daarom niet worden geretourneerd, tenzij er sprake is van een fout van onze kant.</p>
          <h2>Betaling</h2>
          <p>Betaling vindt plaats volgens de op de factuur vermelde termijn. Bij niet-tijdige betaling kunnen kosten in rekening worden gebracht.</p>
          <h2>Aansprakelijkheid</h2>
          <p>We voeren elke opdracht naar beste kunnen uit. Onze aansprakelijkheid is beperkt tot het factuurbedrag van de betreffende opdracht, voor zover wettelijk toegestaan.</p>
          <h2>Klachten</h2>
          <p>Klachten over een levering meld je binnen een redelijke termijn na ontvangst via {site.email}, zodat we samen tot een oplossing kunnen komen.</p>
        </div>
      </section>
    </>
  );
}
