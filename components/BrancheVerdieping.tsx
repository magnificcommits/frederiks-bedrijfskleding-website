import Link from 'next/link';
import type { BrancheVerdieping as V } from '@/content/branche-verdieping';
import { LeesVerder } from '@/components/MeerTonen';

/** Eerste zin van een tekst, voor de dichte stand van een uitklapblok. */
function eersteZin(t: string): string {
  const m = t.match(/^(.{30,}?[.!?])\s/);
  return m ? m[1] : t;
}

const Pijl = () => (
  <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-ink-500 transition group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 8l5 5 5-5" /></svg>
);

/**
 * Verdiepende branche-inhoud: de branche in de regio, functies, problemen in de
 * praktijk, wat er verandert en de kansen. Data in content/branche-verdieping/.
 *
 * Compact opgezet: dicht zie je per onderdeel de kop en één zin, de rest staat
 * in uitklapblokken. Alle tekst blijft in de HTML, dus zoekmachines en
 * AI-zoekers lezen alles mee; de bezoeker ziet eerst alleen de kern. Was ruim
 * 2.000 woorden zichtbaar per pagina.
 */
export function BrancheVerdieping({ v, label, pakketHref }: { v: V; label: string; pakketHref: string }) {
  return (
    <>
      {/* De branche in de regio */}
      <section className="container-x sec-md" data-plek="verdieping-regio">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <div>
            <h2 className="kop-2">{label} in de Achterhoek</h2>
            <LeesVerder className="mt-4 text-lg leading-relaxed text-ink-700">{v.regioIntro}</LeesVerder>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            {v.kerncijfers.map((k) => (
              <div key={k.label} className="min-w-0 rounded-xl border-l-4 border-amber-500 bg-mist px-3 py-3 sm:px-5 sm:py-4">
                <dt className="sr-only">{k.label}</dt>
                <dd className="font-display text-2xl font-extrabold text-ink-900 sm:text-3xl">{k.waarde}</dd>
                <dd className="mt-1 text-[13px] leading-snug text-ink-700 sm:text-sm">{k.label}</dd>
                <dd className="mt-2 hidden text-xs text-warm sm:block">
                  Bron: <a href={k.bronUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink-900">{k.bron}</a>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Per functie */}
      <section className="border-y border-line bg-mist">
        <div className="container-x sec-md">
          <h2 className="kop-2">Per functie: wat je team nodig heeft</h2>
          <p className="mt-2 max-w-[62ch] text-warm">Klik op een functie voor de kleding, de normen en het aantal sets dat we adviseren.</p>

          <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {v.functies.map((f) => (
              <details key={f.functie} className="group rounded-xl border border-line bg-white shadow-soft">
                <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0">
                    <span className="block font-display text-[17px] font-extrabold text-ink-900">{f.functie}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-warm line-clamp-1 group-open:line-clamp-none">{f.werk}</span>
                  </span>
                  <Pijl />
                </summary>
                <div className="px-4 pb-4">
                  <dl className="space-y-1.5 text-sm">
                    <div><dt className="inline font-semibold text-ink-900">Kleding: </dt><dd className="inline text-ink-700">{f.kleding}</dd></div>
                    <div><dt className="inline font-semibold text-ink-900">Normen: </dt><dd className="inline text-ink-700">{f.normen}</dd></div>
                    <div><dt className="inline font-semibold text-ink-900">Sets: </dt><dd className="inline text-ink-700">{f.sets}</dd></div>
                  </dl>
                  {f.vakgebied && <Link href={`/voor/${f.vakgebied}`} className="mt-2 inline-flex min-h-[40px] items-center text-sm font-semibold text-amber-700 underline underline-offset-2">Meer over {f.functie.toLowerCase()}</Link>}
                </div>
              </details>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={pakketHref} className="btn-primary" data-cta="verdieping-pakket">Maak er een pakket van</Link>
            <Link href="/normen" className="btn-secondary">Alle normen uitgelegd</Link>
          </div>
        </div>
      </section>

      {/* Uitdagingen: dicht de kop en onze aanpak in één zin, open het hele verhaal. */}
      <section className="container-x sec-md">
        <h2 className="kop-2">Waar het in de praktijk misgaat</h2>
        <div className="mt-6 grid grid-cols-1 gap-2 md:grid-cols-2">
          {v.uitdagingen.map((u) => (
            <details key={u.titel} className="group rounded-xl border border-line bg-white">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0">
                  <span className="block font-display text-lg font-extrabold text-ink-900">{u.titel}</span>
                  <span className="mt-1 block text-sm text-ink-700"><span className="font-semibold text-amber-800">Onze aanpak: </span>{eersteZin(u.aanpak)}</span>
                </span>
                <Pijl />
              </summary>
              <div className="space-y-2 px-5 pb-5 text-sm text-ink-700">
                <p>{u.probleem}</p>
                <p>{u.aanpak}</p>
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* Wat verandert en kansen */}
      <section className="bg-ink-900 text-white">
        <div className="container-x sec-md grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl font-extrabold text-white sm:text-3xl">Wat er verandert</h2>
            <div className="mt-5 divide-y divide-white/10 border-y border-white/10">
              {v.veranderingen.map((c) => (
                <details key={c.titel} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3.5 [&::-webkit-details-marker]:hidden">
                    <span className="font-display text-[17px] font-extrabold text-white">{c.titel}</span>
                    <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-ink-300 transition group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 8l5 5 5-5" /></svg>
                  </summary>
                  <div className="pb-4 text-sm text-ink-200">
                    <p>{c.tekst}</p>
                    {c.bronUrl && <a href={c.bronUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-ink-300 underline underline-offset-2 hover:text-white">Bron</a>}
                  </div>
                </details>
              ))}
            </div>
          </div>
          <div>
            <h2 className="font-display text-2xl font-extrabold text-white sm:text-3xl">Kansen voor jouw bedrijf</h2>
            <div className="mt-5 divide-y divide-white/10 border-y border-white/10">
              {v.kansen.map((k) => (
                <details key={k.titel} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3.5 [&::-webkit-details-marker]:hidden">
                    <span className="font-display text-[17px] font-extrabold text-amber-300">{k.titel}</span>
                    <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-ink-300 transition group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 8l5 5 5-5" /></svg>
                  </summary>
                  <p className="pb-4 text-sm text-ink-100">{k.tekst}</p>
                </details>
              ))}
            </div>
            <Link href="/pakket-samenstellen#onbelast" className="mt-5 inline-flex min-h-[44px] items-center font-semibold text-amber-400 underline underline-offset-2 hover:text-amber-300">
              Reken uit wat onbelast verstrekken je team scheelt
            </Link>
          </div>
        </div>
      </section>

      {/* Bronnen */}
      {v.bronnen.length > 0 && (
        <section className="container-x pt-8">
          <details className="rounded-xl border border-line bg-white px-5 py-4 text-sm">
            <summary className="cursor-pointer font-semibold text-ink-900">Bronnen bij deze pagina (bijgewerkt {v.bijgewerkt.split('-').reverse().join('-')})</summary>
            <ul className="mt-3 space-y-1.5 text-warm">
              {v.bronnen.map((b) => (
                <li key={b.url}><a href={b.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink-900">{b.titel}</a></li>
              ))}
            </ul>
          </details>
        </section>
      )}
    </>
  );
}
