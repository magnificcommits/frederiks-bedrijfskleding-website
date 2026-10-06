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

      <section className="bg-mist">
        <div className="container-x sec-md">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-center lg:gap-10">
            <p className="max-w-[68ch] text-lg text-warm">
              Pak een meetlint en meet over je gewone kleding heen, niet over je werkkleding. Twijfel je tussen twee
              maten, kies dan meestal de grootste, zodat je vrij kunt bewegen. Bij elke tabel staat hoe je meet.
            </p>
            <div className="paneel-donker p-5 sm:p-6">
              <p className="font-display text-lg font-extrabold text-white">Liever zeker weten dat het past?</p>
              <p className="mt-1 text-sm text-ink-200">We komen langs met pasmodellen, ook in grote maten.</p>
              <Link href="/afspraak?soort=pasdag" className="btn-primary mt-4 w-full" data-cta="afspraak">Plan een pasdag</Link>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-5 xl:grid-cols-3">
            {maattabellen.map((tabel) => (
              <article key={tabel.id} id={tabel.id} className="flex scroll-mt-28 flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-card">
                <div className="p-5 pb-4">
                  <h2 className="font-display text-xl font-extrabold text-ink-900">{tabel.titel}</h2>
                  <p className="mt-1 text-sm leading-snug text-warm">{tabel.intro}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm tabular-nums">
                    <thead>
                      <tr className="bg-ink-900 text-white">
                        {tabel.kolommen.map((kop) => (
                          <th key={kop} scope="col" className="px-4 py-2.5 font-semibold">{kop}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tabel.rijen.map((rij, rijIndex) => (
                        <tr key={rij[0]} className={rijIndex % 2 === 1 ? 'bg-mist' : 'bg-white'}>
                          {rij.map((cel, celIndex) => (
                            <td
                              key={`${tabel.id}-${rijIndex}-${celIndex}`}
                              className={celIndex === 0 ? 'px-4 py-2 font-bold text-ink-900' : 'px-4 py-2 text-ink-800'}
                            >
                              {cel}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-auto border-t-2 border-dashed border-amber-400 bg-amber-50 p-5">
                  <h3 className="text-sm font-bold text-ink-900">Hoe meet je?</h3>
                  <p className="mt-1 text-sm leading-snug text-ink-800">{tabel.hoeMeten}</p>
                </div>
              </article>
            ))}
          </div>
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
