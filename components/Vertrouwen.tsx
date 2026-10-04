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
 * Links het portret van Jessi als beeld, rechts één vergelijking waarin de
 * Frederiks-kolom het donkere vlak is. De zekerheden staan als één strook
 * eronder, zodat het één verhaal blijft en geen zes losse blokjes.
 */
export function WieJeKrijgt() {
  const jaren = new Date().getFullYear() - site.foundedYear;
  const voornaam = contactpersoon.naam.split(' ')[0];
  return (
    <section className="border-y border-line bg-mist" aria-labelledby="wie-je-krijgt">
      <div className="container-x sec">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-8">
          {/* Portretkaart */}
          <div className="paneel-donker flex flex-col">
            <div className="relative min-h-[18rem] flex-1">
              {contactpersoon.foto ? (
                <Image
                  src={contactpersoon.foto}
                  alt={`${contactpersoon.naam}, ${site.name}`}
                  fill
                  sizes="(max-width: 1024px) 100vw, 24rem"
                  className="object-cover object-[62%_20%]"
                />
              ) : (
                <Portret className="h-full w-full" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/10 to-transparent" aria-hidden="true" />
            </div>
            <div className="p-6 pt-0">
              <p className="font-display text-xl font-extrabold text-white">{contactpersoon.naam}</p>
              <p className="text-sm text-ink-200">{contactpersoon.rol}</p>
              <p className="mt-3 border-l-2 border-amber-500 pl-3 text-[15px] leading-relaxed text-white">{contactpersoon.tekst}</p>
              <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/15 pt-4 text-sm">
                <div>
                  <dt className="text-ink-300">Actief sinds</dt>
                  <dd className="font-semibold text-white">{site.foundedYear}{jaren >= 2 ? ` (${jaren} jaar)` : ''}</dd>
                </div>
                <div>
                  <dt className="text-ink-300">KvK</dt>
                  <dd className="font-semibold text-white">{bedrijf.kvk}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-ink-300">Showroom en bedrukkerij</dt>
                  <dd className="font-semibold text-white">{site.address.street}, {site.address.postalCode} {site.address.city} (Gld)</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Vergelijking */}
          <div className="flex flex-col">
            <h2 id="wie-je-krijgt" className="kop-2">Geen klantenservice. Gewoon {voornaam}.</h2>
            <p className="mt-2 max-w-[60ch] text-warm">Dit krijg je bij ons, en bij een webshop niet.</p>

            <div className="mt-6 flex-1 overflow-hidden rounded-2xl border border-line bg-white shadow-card">
              <div className="hidden grid-cols-[7.5rem_minmax(0,1fr)_minmax(0,1.15fr)] text-sm font-semibold md:grid" aria-hidden="true">
                <span />
                <span className="px-5 py-3 text-warm">Webshop</span>
                <span className="bg-ink-900 px-5 py-3 text-white">{site.name}</span>
              </div>
              <ul>
                {verschilMetWebshop.map((r, i) => (
                  <li key={r.onderwerp} className={`grid md:grid-cols-[7.5rem_minmax(0,1fr)_minmax(0,1.15fr)] ${i > 0 ? 'border-t border-line' : 'md:border-t md:border-line'}`}>
                    <p className="px-5 pt-4 font-display font-extrabold text-ink-900 md:py-4">{r.onderwerp}</p>
                    <p className="flex gap-2.5 px-5 pt-2 text-sm text-warm md:py-4">
                      <svg className="mt-0.5 h-4 w-4 shrink-0 text-ink-300" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                      <span><span className="font-semibold md:sr-only">Webshop: </span>{r.webshop}</span>
                    </p>
                    <p className="mt-3 flex gap-2.5 bg-ink-900 px-5 py-3 text-sm font-medium text-white md:mt-0 md:py-4">
                      <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 5" /></svg>
                      <span><span className="sr-only">{site.name}: </span>{r.wij}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <ul className="mt-4 grid overflow-hidden rounded-2xl border border-line bg-white sm:grid-cols-3">
              {zekerheden.map((z, i) => (
                <li key={z.titel} className={`p-5 ${i > 0 ? 'border-t border-line sm:border-l sm:border-t-0' : ''}`}>
                  <p className="font-display font-extrabold text-ink-900">{z.titel}</p>
                  <p className="mt-1 text-sm leading-snug text-warm">{z.tekst}</p>
                  {z.href && (
                    <Link href={z.href} className="mt-1 inline-flex min-h-[44px] items-center text-sm font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-800">
                      Lees hoe dat werkt
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Teaser voor het spaarprogramma: één compacte strook. Rendert niets als het in content uit staat. */
export function SpaarTeaser() {
  if (!spaarprogramma.actief) return null;
  return (
    <section className="bg-white" aria-labelledby="spaar-teaser">
      <div className="container-x pt-10 sm:pt-14">
        <div className="grid items-center gap-5 rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50 p-5 sm:p-6 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:gap-8">
          <span className="hidden h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-ink-900 lg:flex" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l2.6 5.6 6 .7-4.5 4.2 1.2 6L12 16.6 6.700 19.500l1.200-6L3.400 9.300l6-.7z" /></svg>
          </span>
          <div>
            <h2 id="spaar-teaser" className="font-display text-xl font-extrabold text-ink-900">{spaarprogramma.titel}</h2>
            <p className="mt-1 max-w-[70ch] text-[15px] text-ink-800">{spaarprogramma.tekst}</p>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold text-ink-900">
              {spaarprogramma.punten.map((p) => (
                <li key={p} className="flex items-center gap-2">
                  <svg className="h-4 w-4 shrink-0 text-amber-700" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 5" /></svg>
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <div data-plek="spaar-teaser">
            <Link href="/kledingbeheer" className="btn-secondary w-full lg:w-auto" data-cta="kledingbeheer">
              Zo werkt het kledingportaal
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
