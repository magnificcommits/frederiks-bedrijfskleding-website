import Image from 'next/image';
import Link from 'next/link';
import { site } from '@/content/site';
import { bedrijf } from '@/content/bedrijf';
import { contactpersoon, verschilMetWebshop, zekerheden, spaarprogramma } from '@/content/vertrouwen';

/**
 * Vertrouwensblokken. Losse server components zodat elke pagina kiest wat past;
 * ze sturen geen JavaScript naar de browser.
 */

/** Portret van Jessi, of een initialen-tegel zolang er geen foto is (geen stock). */
function Portret({ className = '' }: { className?: string }) {
  if (contactpersoon.foto) {
    return (
      <div className={`relative overflow-hidden rounded-lg bg-mist ${className}`}>
        <Image
          src={contactpersoon.foto}
          alt={`${contactpersoon.naam}, ${site.name}`}
          fill
          sizes="(max-width: 640px) 50vw, 20rem"
          className={`object-cover ${contactpersoon.fotoUitsnede}`}
        />
      </div>
    );
  }
  const initialen = contactpersoon.naam.split(' ').map((d) => d[0]).join('');
  return (
    <div
      className={`flex items-center justify-center rounded-lg border-2 border-dashed border-amber-500 bg-ink-900 ${className}`}
      role="img"
      aria-label={`Foto van ${contactpersoon.naam} volgt`}
    >
      <span className="font-display text-5xl font-extrabold text-amber-400" aria-hidden="true">{initialen}</span>
    </div>
  );
}

/**
 * Wie je krijgt + waarom dat anders is dan een webshop + zekerheden.
 * Eén sectie, zodat het als één verhaal leest en niet als drie losse blokjes.
 */
export function WieJeKrijgt() {
  const jaren = new Date().getFullYear() - site.foundedYear;
  return (
    <section className="container-x py-16 sm:py-24" aria-labelledby="wie-je-krijgt">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-16">
        <div>
          <p className="eyebrow">Wie je aan de lijn krijgt</p>
          <h2 id="wie-je-krijgt" className="kop-2 mt-3">Geen klantenservice. Gewoon {contactpersoon.naam.split(' ')[0]}.</h2>
          <div className="mt-6 flex items-start gap-5">
            <Portret className="aspect-[4/5] w-32 shrink-0 sm:w-40" />
            <div>
              <p className="font-display text-lg font-extrabold text-ink-900">{contactpersoon.naam}</p>
              <p className="text-sm text-warm">{contactpersoon.rol}</p>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-800">{contactpersoon.tekst}</p>
            </div>
          </div>
          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-6 text-sm">
            <div>
              <dt className="text-warm">Actief sinds</dt>
              <dd className="font-semibold text-ink-900">
                {site.foundedYear}
                {jaren >= 2 ? ` (${jaren} jaar)` : ''}
              </dd>
            </div>
            <div>
              <dt className="text-warm">KvK</dt>
              <dd className="font-semibold text-ink-900">{bedrijf.kvk}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-warm">Showroom en bedrukkerij</dt>
              <dd className="font-semibold text-ink-900">
                {site.address.street}, {site.address.postalCode} {site.address.city} (Gld)
              </dd>
            </div>
          </dl>
        </div>

        <div>
          <h3 className="kop-3 text-ink-900">Wat je bij ons anders krijgt dan bij een webshop</h3>
          {/* Tabel op desktop, gestapelde kaartjes op mobiel. Eén bron, twee weergaven via CSS. */}
          <table className="mt-5 hidden w-full border-collapse text-left text-sm md:table">
            <caption className="sr-only">Verschil tussen een webshop en {site.name}</caption>
            <thead>
              <tr className="border-b-2 border-ink-900">
                <th scope="col" className="w-28 py-3 pr-4 font-semibold text-warm"><span className="sr-only">Onderwerp</span></th>
                <th scope="col" className="py-3 pr-4 font-semibold text-warm">Webshop</th>
                <th scope="col" className="py-3 font-semibold text-ink-900">{site.name}</th>
              </tr>
            </thead>
            <tbody>
              {verschilMetWebshop.map((r) => (
                <tr key={r.onderwerp} className="border-b border-line align-top">
                  <th scope="row" className="py-4 pr-4 font-display font-extrabold text-ink-900">{r.onderwerp}</th>
                  <td className="py-4 pr-4 text-warm">{r.webshop}</td>
                  <td className="py-4 text-ink-900">
                    <span className="border-l-2 border-amber-500 pl-3 block">{r.wij}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="mt-5 space-y-3 md:hidden">
            {verschilMetWebshop.map((r) => (
              <li key={r.onderwerp} className="rounded-lg border border-line bg-white p-4">
                <p className="font-display font-extrabold text-ink-900">{r.onderwerp}</p>
                <p className="mt-1 text-sm text-warm"><span className="font-semibold">Webshop:</span> {r.webshop}</p>
                <p className="mt-2 border-l-2 border-amber-500 pl-3 text-sm text-ink-900">{r.wij}</p>
              </li>
            ))}
          </ul>

          <ul className="mt-8 grid gap-4 sm:grid-cols-3">
            {zekerheden.map((z) => (
              <li key={z.titel} className="kaart-nadruk">
                <p className="font-semibold text-ink-900">{z.titel}</p>
                <p className="mt-1 text-sm text-warm">{z.tekst}</p>
                {z.href && (
                  <Link href={z.href} className="mt-2 inline-flex min-h-[44px] items-center text-sm font-semibold text-amber-700 underline-offset-2 hover:underline">
                    Lees hoe dat werkt
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** Teaser voor het spaarprogramma. Rendert niets als het in content uit staat. */
export function SpaarTeaser() {
  if (!spaarprogramma.actief) return null;
  return (
    <section className="border-y border-line bg-mist" aria-labelledby="spaar-teaser">
      <div className="container-x grid items-center gap-8 py-12 sm:py-14 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="max-w-2xl">
          <p className="eyebrow">Voor zakelijke klanten</p>
          <h2 id="spaar-teaser" className="kop-3 mt-2 text-ink-900 sm:text-2xl">{spaarprogramma.titel}</h2>
          <p className="mt-3 text-warm">{spaarprogramma.tekst}</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {spaarprogramma.punten.map((p) => (
              <li key={p} className="rounded-md border border-line bg-white px-3 py-1.5 text-sm font-semibold text-ink-800">{p}</li>
            ))}
          </ul>
        </div>
        <div data-plek="spaar-teaser">
          <Link href="/kledingbeheer" className="btn-outline bg-white" data-cta="kledingbeheer">
            Zo werkt het kledingportaal
          </Link>
        </div>
      </div>
    </section>
  );
}
