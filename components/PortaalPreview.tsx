/**
 * Productbeelden van het klantportaal, opgebouwd in de huisstijl (geen externe
 * afbeeldingen). Twee schermen in een browserframe: de werknemer-webshop met
 * budget en het beheeroverzicht met rapportage.
 */
function BrowserFrame({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      <div className="flex items-center gap-2 border-b border-line bg-mist px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-line" aria-hidden="true" />
        <span className="h-2.5 w-2.5 rounded-full bg-line" aria-hidden="true" />
        <span className="h-2.5 w-2.5 rounded-full bg-line" aria-hidden="true" />
        <span className="ml-3 truncate rounded-md bg-white px-3 py-1 text-xs text-warm">{url}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

const producten = [
  { naam: 'Softshell jas', merk: 'Tricorp', prijs: '64,95', maat: 'L' },
  { naam: 'Polo marineblauw', merk: 'Tricorp', prijs: '24,95', maat: 'L' },
  { naam: 'Werkbroek', merk: 'Snickers', prijs: '89,50', maat: '52' },
];

const afdelingen = [
  { naam: 'Buitendienst', orders: 18, bedrag: '2.140' },
  { naam: 'Magazijn', orders: 9, bedrag: '880' },
  { naam: 'Kantoor', orders: 4, bedrag: '310' },
];

export function PortaalPreview() {
  return (
    <section className="container-x py-16">
      <p className="eyebrow">Zo ziet het eruit</p>
      <h2 className="mt-3 text-2xl font-extrabold sm:text-3xl">Een rondje door het portaal</h2>
      <p className="mt-3 max-w-2xl text-warm">Links bestelt een medewerker binnen het eigen budget. Rechts houdt de beheerder grip met cijfers per afdeling.</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <BrowserFrame url="portaal.frederiksbedrijfskleding.nl/webshop">
          <div className="flex items-center justify-between">
            <p className="font-display text-base font-extrabold text-ink-900">Jouw werkkleding</p>
            <span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold text-ink-700">Mark Wassink</span>
          </div>
          <div className="mt-3 rounded-xl border border-line bg-mist p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-warm">Resterend budget</span>
              <span className="font-bold text-ink-900">&euro; 212 van &euro; 350</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-amber-500" style={{ width: '60%' }} aria-hidden="true" />
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {producten.map((p) => (
              <div key={p.naam} className="rounded-lg border border-line p-3">
                <div className="h-14 rounded-md bg-mist" aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold text-ink-900">{p.naam}</p>
                <p className="text-xs text-warm">{p.merk}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-ink-900">&euro; {p.prijs}</span>
                  <span className="rounded-md border border-line px-2 py-0.5 text-xs text-ink-700">maat {p.maat}</span>
                </div>
                <div className="mt-2 rounded-md bg-ink-900 px-2 py-1.5 text-center text-xs font-semibold text-white">In winkelwagen</div>
              </div>
            ))}
          </div>
        </BrowserFrame>

        <BrowserFrame url="portaal.frederiksbedrijfskleding.nl/beheer">
          <p className="font-display text-base font-extrabold text-ink-900">Overzicht</p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {[
              { l: 'Open orders', v: '7' },
              { l: 'Te bestellen', v: '12' },
              { l: 'Omzet maand', v: '€ 4.180' },
            ].map((k) => (
              <div key={k.l} className="rounded-lg border border-line p-3">
                <p className="text-[11px] uppercase tracking-wide text-warm">{k.l}</p>
                <p className="mt-1 font-display text-xl font-extrabold text-ink-900">{k.v}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-warm">Verbruik per afdeling</p>
          <div className="mt-2 overflow-hidden rounded-lg border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-mist text-[11px] uppercase tracking-wide text-warm">
                <tr><th className="px-3 py-2">Afdeling</th><th className="px-3 py-2 text-right">Orders</th><th className="px-3 py-2 text-right">Verbruik</th></tr>
              </thead>
              <tbody>
                {afdelingen.map((a) => (
                  <tr key={a.naam} className="border-t border-line">
                    <td className="px-3 py-2 text-ink-900">{a.naam}</td>
                    <td className="px-3 py-2 text-right text-warm">{a.orders}</td>
                    <td className="px-3 py-2 text-right font-semibold text-ink-900">&euro; {a.bedrag}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </BrowserFrame>
      </div>
      <p className="mt-4 text-xs text-warm">Voorbeeldweergave van het klantportaal.</p>
    </section>
  );
}
