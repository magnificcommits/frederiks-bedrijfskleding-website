import Link from 'next/link';
import Image from 'next/image';
import { Hero } from '@/components/Hero';
import { BrandStrip } from '@/components/BrandStrip';
import { TrustStrip } from '@/components/TrustStrip';
import { BrancheGrid } from '@/components/BrancheGrid';
import { Reviews } from '@/components/Reviews';
import { CtaBand } from '@/components/CtaBand';
import { Faq } from '@/components/Faq';
import { KledingadviesWizard } from '@/components/KledingadviesWizard';
import { PortaalUsp } from '@/components/PortaalUsp';
import { site } from '@/content/site';
import { JsonLd } from '@/components/JsonLd';
import { faqJsonLd } from '@/lib/jsonld';

const homeFaq = [
  { q: 'Leveren jullie ook aan zzp’ers?', a: 'Ja. Van zzp’er tot bedrijven met meer dan vijftig medewerkers, iedereen is welkom. We denken ook mee bij kleine aantallen.' },
  { q: 'Komen jullie langs om te passen?', a: 'Zeker. Passen op locatie is juist onze kracht. Zo raak je geen werktijd kwijt en zit iedereen goed in z’n kleding.' },
  { q: 'Kunnen jullie ons logo aanbrengen?', a: 'Ja, we bedrukken en borduren in eigen huis. Daardoor gaat het snel en is de kwaliteit slijtvast.' },
  { q: 'In welke regio zijn jullie actief?', a: 'We zitten in Hengelo (Gld) en werken door de hele Achterhoek, waaronder Doetinchem, Zutphen, Doesburg, Lichtenvoorde en Winterswijk.' },
];

const aanbod = [
  { t: 'Werkkleding', d: 'Werkbroeken, jassen, polo’s en meer, voor elke branche.', href: '/werkkleding' },
  { t: 'Werkschoenen', d: 'Veiligheidsschoenen van S1 tot S3 met persoonlijk pasadvies.', href: '/werkschoenen' },
  { t: 'Bedrukken en borduren', d: 'Je logo strak en slijtvast, in eigen huis aangebracht.', href: '/bedrukken-borduren' },
];

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustStrip />
      <BrandStrip />

      <section className="container-x py-16 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Bedrijfskleding met persoonlijke aandacht</p>
            <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">We komen langs, passen op de zaak en kennen de Achterhoek</h2>
            <div className="prose-nl mt-4 text-lg">
              <p>Zoek je een vaste partner voor bedrijfskleding in de Achterhoek? Bij {site.name} regel je alles op één plek: van advies en maatvoering tot bedrukken en nalevering.</p>
              <p>Je krijgt één vast aanspreekpunt dat je bedrijf kent. Samen kiezen we een kledingpakket dat past bij je branche, je eisen en je uitstraling.</p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/kledingadvies" className="btn-primary">Gratis kledingadvies</Link>
              <Link href="/werkkleding" className="btn-outline">Bekijk werkkleding</Link>
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-line shadow-card">
            <Image src="/Frederiks-bedrijfskleding-hengelo-.jpg" alt="Showroom van Frederiks Bedrijfskleding in de Brouwersmolen te Hengelo"
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

      <BrancheGrid />
      <PortaalUsp />
      <Reviews limit={6} />

      <section className="container-x py-16 sm:py-24">
        <div className="max-w-2xl">
          <p className="eyebrow">Ons aanbod</p>
          <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">Alles voor je bedrijfskleding onder één dak</h2>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {aanbod.map((c) => (
            <Link key={c.href} href={c.href} className="group flex flex-col rounded-xl border border-line bg-white p-6 shadow-card transition hover:-translate-y-1 hover:border-amber-400">
              <h3 className="text-xl font-bold text-ink-900 group-hover:text-amber-600">{c.t}</h3>
              <p className="mt-2 grow text-sm text-warm">{c.d}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold uppercase tracking-wide text-amber-600">Lees meer <span aria-hidden="true">→</span></span>
            </Link>
          ))}
        </div>
      </section>

      {/* Pakketsamensteller */}
      <section className="bg-ink-900 text-white">
        <div className="container-x grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-2">
          <div>
            <p className="eyebrow text-amber-500">Pakketsamensteller</p>
            <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">Stel je pakket samen en zie je logo meteen op de kleding</h2>
            <p className="mt-4 text-lg text-white/80">Kies de kleding en kleuren die bij je werk passen. Upload je logo en bekijk live hoe het op de polo, jas of broek staat. Geen webshop, geen verplichtingen.</p>
            <p className="mt-4 text-white/80">Tevreden over je pakket? Vraag het in één klik vrijblijvend als offerte aan. Jessi kijkt mee, denkt mee over maten en aantallen en belt je terug.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/pakket-samenstellen" className="btn-primary">Stel je pakket samen</Link>
              <Link href="/bedrukken-borduren" className="btn-outline border-white/40 text-white hover:bg-white hover:text-ink-900">Zo brengen we je logo aan</Link>
            </div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/5 p-6">
            <ol className="space-y-4">
              <li className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-ink-900">1</span>
                <p className="text-white/80"><span className="font-bold text-white">Kies je kleding.</span> Stel je set samen uit polo’s, jassen, broeken en schoenen.</p>
              </li>
              <li className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-ink-900">2</span>
                <p className="text-white/80"><span className="font-bold text-white">Zet je logo erop.</span> Upload je logo en zie direct hoe het op de kleding staat.</p>
              </li>
              <li className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-ink-900">3</span>
                <p className="text-white/80"><span className="font-bold text-white">Vraag je offerte aan.</span> Wij rekenen het uit en nemen contact op. Vrijblijvend.</p>
              </li>
            </ol>
          </div>
        </div>
      </section>

      {/* Leadtool */}
      <section className="border-y border-line bg-mist">
        <div className="container-x grid gap-10 py-16 sm:py-24 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <p className="eyebrow">Kledingadvies in 1 minuut</p>
            <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">Niet zeker wat je nodig hebt?</h2>
            <p className="mt-4 text-lg text-warm">Beantwoord vier korte vragen. We bellen je binnen een werkdag terug met advies dat past bij je werk. Vrijblijvend.</p>
            <p className="mt-4 text-sm text-warm">Liever bellen? <a href={`tel:${site.phoneIntl}`} className="font-semibold text-amber-600 hover:underline">{site.phone}</a></p>
          </div>
          <div className="lg:col-span-3">
            <KledingadviesWizard />
          </div>
        </div>
      </section>

      <JsonLd data={faqJsonLd(homeFaq)} />
      <Faq items={homeFaq} />
      <CtaBand />
    </>
  );
}
