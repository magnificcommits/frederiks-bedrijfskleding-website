import type { Metadata } from 'next';
import Link from 'next/link';
import { plaatsen } from '@/content/plaatsen';
import { branches } from '@/content/branches';
import { site } from '@/content/site';
import { PageHero } from '@/components/PageHero';
import { ContactSectie } from '@/components/ContactSectie';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbJsonLd } from '@/lib/jsonld';

export const metadata: Metadata = {
  title: 'Werkgebied in de Achterhoek',
  description: 'Frederiks Bedrijfskleding werkt door de hele Achterhoek en omgeving. Bekijk alle plaatsen waar we werkkleding leveren, met persoonlijk advies en passen op locatie.',
  alternates: { canonical: '/regio' },
};

export default function RegioIndex() {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: 'Home', url: site.url }, { name: 'Regio', url: `${site.url}/regio` }])} />
      <PageHero eyebrow="Werkgebied" title="Bedrijfskleding in de hele Achterhoek"
        intro="We zitten in Hengelo (Gld) en werken door de hele Achterhoek, de Liemers en de Oude IJsselstreek. Overal met dezelfde persoonlijke aanpak: we komen langs om te passen en brengen het logo in eigen huis aan." />
      <section className="container-x py-16">
        <h2 className="kop-2">Plaatsen waar we werken</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plaatsen.map((p) => (
            <Link key={p.slug} href={`/regio/${p.slug}`} className="group flex items-center justify-between rounded-lg border border-line bg-white px-5 py-4 shadow-soft transition hover:border-amber-400">
              <span>
                <span className="block font-bold text-ink-900 group-hover:text-amber-800">{p.name}</span>
                <span className="text-xs text-warm">{p.afstand}</span>
              </span>
              <span className="text-amber-700" aria-hidden="true">&rarr;</span>
            </Link>
          ))}
        </div>
        <p className="mt-6 max-w-[60ch] text-warm">Staat jouw plaats er niet bij? We werken in de hele regio. <Link href="/kledingadvies" className="font-semibold text-amber-700 hover:underline">Vraag gerust advies aan</Link>.</p>

        <h2 className="mt-14 kop-2">Of kies je branche</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {branches.map((b) => (
            <Link key={b.slug} href={`/branches/${b.slug}`} className="rounded-lg border border-line bg-white px-5 py-4 font-semibold text-ink-900 shadow-soft transition hover:border-amber-400 hover:text-amber-800">{b.navLabel}</Link>
          ))}
        </div>
      </section>
      <ContactSectie title="Bedrijfskleding nodig in jouw plaats?" />
    </>
  );
}
