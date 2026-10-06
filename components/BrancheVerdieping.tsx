import Link from 'next/link';
import type { BrancheVerdieping as V } from '@/content/branche-verdieping';

/**
 * Verdiepende branche-inhoud: de branche in de regio, functies, problemen in de
 * praktijk, wat er verandert en de kansen. Data in content/branche-verdieping/.
 */
export function BrancheVerdieping({ v, label, pakketHref }: { v: V; label: string; pakketHref: string }) {
  return (
    <>
      {/* De branche in de regio */}
      <section className="container-x sec-md" data-plek="verdieping-regio">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <div>
            <h2 className="kop-2">{label} in de Achterhoek</h2>
            <p className="mt-4 text-lg leading-relaxed text-ink-700">{v.regioIntro}</p>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            {v.kerncijfers.map((k) => (
              <div key={k.label} className="rounded-xl border-l-4 border-amber-500 bg-mist px-5 py-4">
                <dt className="sr-only">{k.label}</dt>
                <dd className="font-display text-3xl font-extrabold text-ink-900">{k.waarde}</dd>
                <dd className="mt-1 text-sm text-ink-700">{k.label}</dd>
                <dd className="mt-2 text-xs text-warm">
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
          <p className="mt-2 max-w-[62ch] text-warm">Een monteur draagt iets anders dan een uitvoerder. Zo stellen we de lijn per functie samen, met de normen die gelden en het aantal sets dat we meestal adviseren.</p>

          {/* Desktop: tabel */}
          <div className="mt-8 hidden overflow-hidden rounded-xl border border-line bg-white shadow-soft lg:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-ink-900 text-white">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">Functie</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Het werk</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Kleding</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Normen</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Sets</th>
                </tr>
              </thead>
              <tbody>
                {v.functies.map((f, i) => (
                  <tr key={f.functie} className={i % 2 ? 'bg-mist/60' : ''}>
                    <th scope="row" className="px-5 py-4 align-top font-display font-extrabold text-ink-900">
                      {f.vakgebied ? <Link href={`/voor/${f.vakgebied}`} className="underline decoration-amber-500 underline-offset-4 hover:text-amber-800">{f.functie}</Link> : f.functie}
                    </th>
                    <td className="px-5 py-4 align-top text-ink-700">{f.werk}</td>
                    <td className="px-5 py-4 align-top text-ink-700">{f.kleding}</td>
                    <td className="px-5 py-4 align-top text-ink-700">{f.normen}</td>
                    <td className="px-5 py-4 align-top font-semibold text-ink-900">{f.sets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobiel en tablet: kaarten */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:hidden">
            {v.functies.map((f) => (
              <div key={f.functie} className="rounded-xl border border-line bg-white p-5 shadow-soft">
                <h3 className="font-display text-lg font-extrabold text-ink-900">
                  {f.vakgebied ? <Link href={`/voor/${f.vakgebied}`} className="underline decoration-amber-500 underline-offset-4">{f.functie}</Link> : f.functie}
                </h3>
                <p className="mt-1 text-sm text-warm">{f.werk}</p>
                <dl className="mt-3 space-y-1.5 text-sm">
                  <div><dt className="inline font-semibold text-ink-900">Kleding: </dt><dd className="inline text-ink-700">{f.kleding}</dd></div>
                  <div><dt className="inline font-semibold text-ink-900">Normen: </dt><dd className="inline text-ink-700">{f.normen}</dd></div>
                  <div><dt className="inline font-semibold text-ink-900">Sets: </dt><dd className="inline text-ink-700">{f.sets}</dd></div>
                </dl>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={pakketHref} className="btn-primary" data-cta="verdieping-pakket">Maak er een pakket van</Link>
            <Link href="/normen" className="btn-secondary">Alle normen uitgelegd</Link>
          </div>
        </div>
      </section>

      {/* Uitdagingen */}
      <section className="container-x sec-md">
        <h2 className="kop-2">Waar het in de praktijk misgaat</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {v.uitdagingen.map((u, i, arr) => (
            <div key={u.titel} className={`flex flex-col rounded-xl border-2 border-ink-200 bg-white p-6 ${arr.length % 2 && i === arr.length - 1 ? 'md:col-span-2' : ''}`}>
              <h3 className="font-display text-xl font-extrabold text-ink-900">{u.titel}</h3>
              <p className="mt-2 text-ink-700">{u.probleem}</p>
              <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-ink-800">
                <span className="font-bold text-amber-800">Zo pakken we het aan: </span>{u.aanpak}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Wat verandert en kansen */}
      <section className="bg-ink-900 text-white">
        <div className="container-x sec-md grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl font-extrabold text-white sm:text-3xl">Wat er verandert</h2>
            <ul className="mt-6 space-y-5">
              {v.veranderingen.map((c) => (
                <li key={c.titel} className="border-l-2 border-amber-500 pl-4">
                  <p className="font-display text-lg font-extrabold text-white">{c.titel}</p>
                  <p className="mt-1 text-ink-200">{c.tekst}</p>
                  {c.bronUrl && <a href={c.bronUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-ink-300 underline underline-offset-2 hover:text-white">Bron</a>}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-display text-2xl font-extrabold text-white sm:text-3xl">Kansen voor jouw bedrijf</h2>
            <div className="mt-6 grid gap-3">
              {v.kansen.map((k) => (
                <div key={k.titel} className="rounded-xl bg-white/10 p-5">
                  <p className="font-display text-lg font-extrabold text-amber-300">{k.titel}</p>
                  <p className="mt-1 text-ink-100">{k.tekst}</p>
                </div>
              ))}
            </div>
            <Link href="/pakket-samenstellen#onbelast" className="mt-6 inline-flex min-h-[44px] items-center font-semibold text-amber-400 underline underline-offset-2 hover:text-amber-300">
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
