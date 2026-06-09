import type { Metadata } from 'next';
import Image from 'next/image';
import { PageHero } from '@/components/PageHero';
import { CtaBand } from '@/components/CtaBand';
import { site } from '@/content/site';

export const metadata: Metadata = {
  title: 'Over ons',
  description: 'Frederiks Bedrijfskleding wordt gerund door Jessi Frederiks vanuit de Brouwersmolen in Hengelo (Gld). Persoonlijk advies voor bedrijven in de Achterhoek.',
  alternates: { canonical: '/over-ons' },
};

export default function OverOnsPage() {
  return (
    <>
      <PageHero eyebrow="Over ons" title="Persoonlijke aandacht is bij ons geen extra"
        intro={`${site.name} wordt gerund door ${site.owner}, vanuit de Brouwersmolen in ${site.address.city} (Gld).`} />
      <section className="container-x py-16">
        <div className="grid items-start gap-12 lg:grid-cols-2">
          <div className="prose-nl text-lg">
            <p>Het begon klein, tijdens corona, naast twee kledingwinkels in het dorp. Wat als bijzaak startte, groeide uit tot een vaste waarde voor bedrijfskleding in de Achterhoek. Inmiddels zit ik met showroom en bedrukkerij in de Brouwersmolen, een molen uit 1801 in Hengelo.</p>
            <p>Mijn aanpak is simpel. Ik luister naar wat je nodig hebt en denk mee. Je krijgt mij als vast aanspreekpunt, niet elke keer een ander. Ik kom langs om te passen, stel samen met je een pakket samen dat klopt, en regel het bedrukken en borduren in eigen huis. Ook grote maten en een snelle nalevering horen daarbij.</p>
            <p>De meeste van mijn klanten zitten in de bouw. Maar inmiddels kleed ik net zo goed bedrijven in techniek, transport, horeca, zorg, beauty en de agrarische sector. Wat ze gemeen hebben: ze willen geholpen worden door iemand die ze kent, niet door een webshop.</p>
          </div>
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-line shadow-card">
            <Image src="/Frederiks-bedrijfskleding-1.jpg" alt="Jessi Frederiks in de showroom in de Brouwersmolen te Hengelo"
              fill sizes="(max-width: 1024px) 90vw, 45vw" className="object-cover" />
          </div>
        </div>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {site.usps.map((u) => (
            <div key={u.title} className="seam-card">
              <h3 className="text-base font-bold text-ink-900">{u.title}</h3>
              <p className="mt-2 text-sm text-warm">{u.text}</p>
            </div>
          ))}
        </div>
      </section>
      <CtaBand />
    </>
  );
}
