import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { CtaBand } from '@/components/CtaBand';
import { CrossLinks } from '@/components/CrossLinks';
import { maattabellen } from '@/content/maattabellen';

export const metadata: Metadata = {
  title: 'Maattabellen',
  description:
    'Vind zelf de juiste maat voor je werkkleding. Maattabellen voor bovenkleding, werkbroeken en veiligheidsschoenen, met borst-, taille- en voetmaten als richtlijn. Twijfel je? Frederiks komt langs om te passen.',
  alternates: { canonical: '/maattabellen' },
  keywords: [
    'maattabel werkkleding', 'maattabel bedrijfskleding', 'maat werkbroek',
    'maat veiligheidsschoenen', 'borstomvang maat bepalen', 'werkkleding maten Achterhoek',
  ],
};

export default function MaattabellenPage() {
  return (
    <>
      <PageHero
        eyebrow="Maatadvies"
        title="Maattabellen voor je werkkleding"
        intro="Bepaal zelf de juiste maat met onderstaande richtlijnen voor bovenkleding, broeken en schoenen. De getallen zijn richtwaarden; maten verschillen per merk en model."
      />

      <section className="container-x py-16">
        <div className="prose-nl max-w-2xl text-lg">
          <p>
            Pak een meetlint en meet over je gewone kleding heen, niet over je
            werkkleding. Twijfel je tussen twee maten, kies dan meestal de grootste,
            zodat je vrij kunt bewegen. Per tabel hieronder lees je precies hoe je meet.
          </p>
          <p>
            Twijfel je over de maat? Wij komen langs om te passen, ook in grote maten. Zo
            zit elke collega in de juiste maat zonder gedoe.{' '}
            <Link href="/kledingadvies" className="font-semibold text-amber-600 hover:underline">
              Vraag advies aan
            </Link>
            .
          </p>
        </div>
      </section>

      {maattabellen.map((tabel, index) => (
        <section
          key={tabel.id}
          id={tabel.id}
          className={index % 2 === 1 ? 'border-y border-line bg-mist' : ''}
        >
          <div className="container-x py-16">
            <p className="eyebrow">Maattabel</p>
            <h2 className="mt-3 text-2xl font-extrabold sm:text-3xl">{tabel.titel}</h2>
            <p className="mt-3 max-w-2xl text-warm">{tabel.intro}</p>

            <div className="mt-8 overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
              <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
                <thead className="bg-mist">
                  <tr>
                    {tabel.kolommen.map((kop) => (
                      <th
                        key={kop}
                        scope="col"
                        className="border-b border-line px-4 py-3 font-bold text-ink-900"
                      >
                        {kop}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tabel.rijen.map((rij, rijIndex) => (
                    <tr
                      key={rij[0]}
                      className={rijIndex % 2 === 1 ? 'bg-mist/50' : 'bg-white'}
                    >
                      {rij.map((cel, celIndex) => (
                        <td
                          key={`${tabel.id}-${rijIndex}-${celIndex}`}
                          className={
                            celIndex === 0
                              ? 'border-b border-line px-4 py-3 font-semibold text-ink-900'
                              : 'border-b border-line px-4 py-3 text-warm'
                          }
                        >
                          {cel}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 rounded-xl border-l-2 border-dashed border-amber-500 bg-white p-5 shadow-soft">
              <h3 className="text-sm font-bold text-ink-900">Hoe meet je?</h3>
              <p className="mt-2 text-sm text-warm">{tabel.hoeMeten}</p>
            </div>
          </div>
        </section>
      ))}

      <section className="container-x py-16">
        <div className="rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h2 className="text-2xl font-extrabold text-ink-900 sm:text-3xl">
            Liever zeker weten dat het past?
          </h2>
          <p className="mt-3 max-w-2xl text-warm">
            Een maattabel is een goede start, maar passen geeft de meeste zekerheid. Wij
            komen bij je langs met pasmodellen, ook in grote maten, zodat iedereen in het
            team in de juiste maat zit.
          </p>
          <Link href="/kledingadvies" className="btn-primary mt-6 inline-flex">
            Vraag advies aan
          </Link>
        </div>
      </section>

      <CrossLinks title="Bekijk ook" />
      <CtaBand
        title="Twijfel je over de maat?"
        text="Wij komen langs om te passen, ook in grote maten. Vraag vrijblijvend advies aan, dan regelen we de juiste maat voor je team."
      />
    </>
  );
}
