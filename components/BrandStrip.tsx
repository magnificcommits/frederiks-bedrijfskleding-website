import Image from 'next/image';
import { alleMerken } from '@/lib/kms/catalogus';
import { extraMerken, merkLogos } from '@/content/merken';
import { ContactKnop } from '@/components/ContactPopup';

/**
 * Merkenblok "Onze merken" (werkdocument Jessi, 20 okt 2026).
 *
 * Geen links meer naar openbare productoverzichten: van veel merken staat maar
 * een klein deel online, en dat wekt de indruk dat de rest niet leverbaar is.
 * Jessi adviseert persoonlijk over het assortiment; de knop opent de
 * contact-pop-up.
 *
 * Elk merk staat in een gelijk vak. Met een officieel logobestand (content/
 * merken.ts merkLogos) toont het vak het logo, anders de merknaam. Ontbrekende
 * logo's vul je aan in public/merken en merkLogos.
 */
export async function BrandStrip() {
  const uitKms = await alleMerken();
  const gezien = new Set<string>();
  const merken = [
    ...uitKms.map((m) => ({ naam: m.naam, slug: m.slug })),
    ...extraMerken.map((naam) => ({ naam, slug: naam.toLowerCase().replace(/[^a-z0-9]+/g, '-') })),
  ].filter((m) => (gezien.has(m.slug) ? false : (gezien.add(m.slug), true)));
  if (!merken.length) return null;

  return (
    <section className="border-y border-line bg-mist">
      <div className="container-x sec-md">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="kop-2">Onze merken</h2>
          <p className="mt-3 text-lg text-warm">
            Wij werken met een ruim assortiment kwaliteitsmerken. Op zoek naar een specifiek merk of artikel?
            Neem contact met ons op, dan kijken we samen naar de mogelijkheden.
          </p>
        </div>
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {merken.map((m) => {
            const logo = merkLogos[m.slug];
            return (
              <li key={m.slug} className="flex h-20 items-center justify-center rounded-xl border border-line bg-white px-4">
                {logo ? (
                  <Image src={logo} alt={m.naam} width={140} height={48} className="max-h-10 w-auto object-contain" />
                ) : (
                  <span className="text-center font-display text-base font-bold tracking-tight text-ink-700 sm:text-lg">{m.naam}</span>
                )}
              </li>
            );
          })}
        </ul>
        <div className="mt-8 text-center" data-plek="merken">
          <ContactKnop className="btn-primary" bron="merken">Vraag naar de mogelijkheden</ContactKnop>
        </div>
      </div>
    </section>
  );
}
