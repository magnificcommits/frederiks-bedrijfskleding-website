import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { CrossLinks } from '@/components/CrossLinks';
import { ContactSectie } from '@/components/ContactSectie';
import { Faq } from '@/components/Faq';
import { JsonLd } from '@/components/JsonLd';
import { PortaalPreview } from '@/components/PortaalPreview';
import { serviceJsonLd, faqJsonLd } from '@/lib/jsonld';
import { site } from '@/content/site';

export const metadata: Metadata = {
  title: 'Online kledingbeheer en bestelportaal',
  description: 'Bij Frederiks krijg je een eigen online kledingbeheersysteem: medewerkers, maten en budgetten op een plek, bestellen binnen kaders, goedkeuren en rapporteren. Gratis bij je bedrijfskleding.',
  alternates: { canonical: '/kledingbeheer' },
  keywords: [
    'kledingbeheersysteem', 'kleding management systeem', 'bestelportaal werkkleding',
    'klantportaal bedrijfskleding', 'werkkleding budget per medewerker', 'bedrijfskleding beheer Achterhoek',
  ],
};

const voordelen = [
  { t: 'Voor de office manager', d: 'Geen losse mailtjes en lijstjes meer. Medewerkers, maten, budgetten en bestellingen staan op een plek, en nieuwe collega’s zet je in een minuut klaar.' },
  { t: 'Voor de inkoper', d: 'Grip op de uitgaven. Stel een budget per medewerker in, laat bestellingen goedkeuren en zie per afdeling of vestiging wat er omgaat.' },
  { t: 'Voor de medewerker', d: 'Zelf bestellen binnen de afgesproken kaders, met de eigen maat al ingevuld. Snel geregeld, zonder dat er iemand tussen hoeft te zitten.' },
];

const functies = [
  { t: 'Eigen bestelomgeving per medewerker', d: 'Iedere medewerker ziet alleen het toegestane assortiment met de eigen maat, en bestelt in een paar klikken.' },
  { t: 'Budget en goedkeuring', d: 'Werk met een budget per persoon en laat bestellingen waar nodig eerst goedkeuren door een leidinggevende.' },
  { t: 'Maten en voorkeursmaat', d: 'Leg de maat per medewerker vast. De bestelomgeving vult die voor, met de optie om een maat groter of kleiner te kiezen.' },
  { t: 'Vestigingen en afdelingen', d: 'Richt meerdere vestigingen en afdelingen in, elk met een eigen lever- en factuuradres.' },
  { t: 'Rapportages en verbruik', d: 'Zie het verbruik per medewerker, afdeling, vestiging en functie, en het budgetgebruik in een oogopslag.' },
  { t: 'Retouren en vragen', d: 'Medewerkers melden een retour of stellen een vraag, jij handelt het overzichtelijk af.' },
  { t: 'Logo en werkbon', d: 'Je logo en de plaatsing leggen we vast, zodat elke bestelling met de juiste bedrukking of borduring de deur uit gaat.' },
  { t: 'Track en trace', d: 'Volg de status van bestellingen, van aangevraagd tot geleverd.' },
];

const stappen = [
  { nr: '01', t: 'Wij richten je bedrijf in', d: 'We zetten je vestigingen, afdelingen, assortiment en budgetten klaar, afgestemd op hoe jullie werken.' },
  { nr: '02', t: 'Je medewerkers krijgen toegang', d: 'Iedereen logt in met het eigen e-mailadres. Jij bepaalt wie beheerder, leidinggevende of besteller is.' },
  { nr: '03', t: 'Ze bestellen binnen budget', d: 'Medewerkers kiezen hun kleding binnen de afgesproken kaders. Waar nodig keurt een leidinggevende het goed.' },
  { nr: '04', t: 'Jij houdt overzicht', d: 'Bestellingen, verbruik en budgetten staan voor je klaar, plus de rapportages die je nodig hebt.' },
];

const faq = [
  { q: 'Wat kost het kledingbeheersysteem?', a: 'Het hoort bij de samenwerking. Neem je je bedrijfskleding bij Frederiks af, dan krijg je het beheersysteem erbij. Je betaalt voor de kleding, het overzicht en het gemak krijg je erbij.' },
  { q: 'Wie kan er inloggen?', a: 'Jij en je medewerkers, elk met een eigen e-mailadres en een rol. Een beheerder regelt alles, een leidinggevende keurt bestellingen goed en bestelt voor het team, en een medewerker bestelt binnen het eigen budget.' },
  { q: 'Kan een medewerker alleen de eigen spullen zien?', a: 'Ja. Een medewerker ziet alleen het eigen assortiment, de eigen maat, het eigen budget en de eigen bestellingen. Beheerders en leidinggevenden zien het geheel.' },
  { q: 'Is mijn bedrijf afgeschermd van andere klanten?', a: 'Ja. Elk bedrijf heeft een eigen, afgeschermde omgeving. Gegevens worden per organisatie gescheiden bewaard, conform de privacyregels.' },
  { q: 'Werkt het ook op de telefoon?', a: 'Ja. Het portaal werkt op telefoon, tablet en computer, zodat medewerkers ook onderweg kunnen bestellen.' },
  { q: 'Hoe begin ik?', a: 'Vraag een demo aan. We laten je het systeem zien met jouw situatie als voorbeeld en richten het daarna voor je in.' },
];

export default function KledingbeheerPage() {
  return (
    <>
      <JsonLd data={serviceJsonLd({ name: 'Online kledingbeheer en bestelportaal', description: metadata.description as string, url: `${site.url}/kledingbeheer` })} />
      <JsonLd data={faqJsonLd(faq)} />

      <PageHero eyebrow="Klantportaal" title="Een eigen kledingbeheersysteem bij je bedrijfskleding"
        intro="Regel je werkkleding online op een plek. Medewerkers, maten en budgetten beheer je eenvoudig, je team bestelt zelf binnen de kaders, en jij houdt grip en overzicht. Je krijgt het erbij als je je kleding bij Frederiks afneemt." />

      <section className="container-x py-16">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="prose-nl text-lg">
            <p>Werkkleding regelen kost vaak meer tijd dan nodig: wie heeft welke maat, wat mag iemand bestellen, en wat is er al de deur uit. In het klantportaal van Frederiks staat dat allemaal bij elkaar.</p>
            <p>Je richt je bedrijf in met vestigingen, afdelingen, functies en budgetten, en je medewerkers bestellen daarna zelf hun kleding binnen de afgesproken kaders. Jij houdt overzicht en bespaart je kantoor een hoop geregel.</p>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-line shadow-card">
            <Image src="/Frederiks-bedrijfskleding-1.jpg" alt="Bedrijfskleding van Frederiks, beheerd via het klantportaal"
              fill sizes="(max-width: 1024px) 90vw, 45vw" className="object-cover" />
          </div>
        </div>
      </section>

      <PortaalPreview />

      <section className="border-y border-line bg-mist">
        <div className="container-x py-16">
          <p className="eyebrow">Waarde voor je organisatie</p>
          <h2 className="mt-3 text-2xl font-extrabold sm:text-3xl">Minder geregel, meer grip</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {voordelen.map((v) => (
              <div key={v.t} className="rounded-xl border border-line bg-white p-6">
                <h3 className="text-base font-bold text-ink-900">{v.t}</h3>
                <p className="mt-2 text-sm text-warm">{v.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-x py-16">
        <p className="eyebrow">Wat het kan</p>
        <h2 className="mt-3 text-2xl font-extrabold sm:text-3xl">Alles voor je kledingbeheer op een plek</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {functies.map((f) => (
            <div key={f.t} className="rounded-xl border-l-2 border-dashed border-amber-500 bg-white p-6 shadow-soft">
              <h3 className="text-base font-bold text-ink-900">{f.t}</h3>
              <p className="mt-2 text-sm text-warm">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-mist">
        <div className="container-x py-16">
          <h2 className="text-2xl font-extrabold sm:text-3xl">Hoe het werkt</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {stappen.map((s) => (
              <li key={s.nr} className="rounded-xl border border-line bg-white p-5 shadow-soft">
                <span className="font-display text-2xl font-extrabold text-amber-500">{s.nr}</span>
                <h3 className="mt-2 text-base font-bold text-ink-900">{s.t}</h3>
                <p className="mt-2 text-sm text-warm">{s.d}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-warm">Benieuwd hoe dit er voor jouw bedrijf uitziet? <Link href="/kledingadvies" className="font-semibold text-amber-600 hover:underline">Vraag advies aan</Link> of plan een demo via het formulier hieronder.</p>
        </div>
      </section>

      <Faq items={faq} />
      <CrossLinks exclude="/kledingbeheer" />
      <ContactSectie title="Vraag een demo van het kledingbeheer aan"
        intro="We laten je het portaal zien met jouw situatie als voorbeeld: vestigingen, budgetten en bestellen door medewerkers. Vul je gegevens in, dan nemen we persoonlijk contact op." />
    </>
  );
}
