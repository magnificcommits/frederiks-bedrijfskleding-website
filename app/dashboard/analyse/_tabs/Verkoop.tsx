import Link from 'next/link';
import KpiTegel from '@/components/dashboard/overzicht/KpiTegel';
import OmzetGrafiek from '@/components/dashboard/overzicht/OmzetGrafiek';
import LegeStaat from '@/components/dashboard/overzicht/LegeStaat';
import { analyseVerkoop } from '@/lib/kms/analyse';
import { lijstFilter, periodeParams, plusDagen, plusMaanden, urlMet, type Periode } from '@/lib/kms/analysePeriode';
import Balken from '../_delen/Balken';
import Blok from '../_delen/Blok';
import { aantal, euro, pct } from '../_delen/opmaak';

export default async function Verkoop({ periode }: { periode: Periode }) {
  const d = await analyseVerkoop(periode);
  const vgl = periode.vgl?.label ?? null;
  const pp = periodeParams(periode);
  const labels = d.maanden.map((m) => m.label);
  const delta = (nu: number, vorige: number | null, richting: 'hoger-beter' | 'lager-beter' = 'hoger-beter') =>
    vgl && vorige !== null ? { nu, vorige, richting, vergelijk: vgl } : undefined;

  if (!d.heeftData) {
    return (
      <LegeStaat
        titel="Nog geen orders of facturen"
        tekst="Zodra de eerste order of factuur in het systeem staat, zie je hier per periode wat er verkocht is, aan wie en in welke branche."
        actieHref="/dashboard/orders/nieuw"
        actieLabel="Order aanmaken"
      />
    );
  }

  const totaalNT = d.nieuwTerug.nieuw.omzet + d.nieuwTerug.terug.omzet;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiTegel
          label="Omzet"
          waarde={euro(d.omzet.nu)}
          href={urlMet('/dashboard/facturen', lijstFilter(periode))}
          delta={delta(d.omzet.nu, d.omzet.vorige)}
          spark={{ waarden: d.maanden.map((m) => m.gefactureerd), labels, opmaak: 'euro', omschrijving: 'Omzet per maand' }}
          sub={<span className="text-warm">excl. btw, {euro(d.betaald)} al betaald</span>}
        />
        <KpiTegel
          label="Orders"
          waarde={aantal(d.orders.nu)}
          href={urlMet('/dashboard/orders', lijstFilter(periode))}
          delta={delta(d.orders.nu, d.orders.vorige)}
          spark={{ waarden: d.maanden.map((m) => m.orders), labels, omschrijving: 'Orders per maand' }}
          sub={<span className="text-warm">{euro(d.orderwaarde.nu)} orderwaarde</span>}
        />
        <KpiTegel
          label="Gemiddelde orderwaarde"
          waarde={d.gemOrder.nu > 0 ? euro(d.gemOrder.nu) : '–'}
          href={urlMet('/dashboard/orders', lijstFilter(periode), { sort: 'bedrag' })}
          delta={d.gemOrder.nu > 0 ? delta(d.gemOrder.nu, d.gemOrder.vorige) : undefined}
          sub={<span className="text-warm">orders met een bedrag, zonder concepten</span>}
        />
        <KpiTegel
          label="Klanten gefactureerd"
          waarde={aantal(d.klanten.nu)}
          href={urlMet('/dashboard/rapportages/omzet-klant', pp)}
          delta={delta(d.klanten.nu, d.klanten.vorige)}
        />
        <KpiTegel
          label="Nieuwe klanten"
          waarde={aantal(d.nieuweKlanten.nu)}
          href="/dashboard/klanten"
          delta={delta(d.nieuweKlanten.nu, d.nieuweKlanten.vorige)}
          sub={<span className="text-warm">eerste factuur ooit in deze periode</span>}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <OmzetGrafiek maanden={d.maanden} />
        <Blok
          titel="Per maand"
          uitleg="Klik op een maand om die maand te analyseren, of op het aantal orders voor de lijst."
        >
          <div className="-mx-4 -mb-4 overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Maand</th>
                  <th className="text-right">Omzet</th>
                  <th className="text-right">Orders</th>
                  <th className="text-right">Orderwaarde</th>
                </tr>
              </thead>
              <tbody>
                {[...d.maanden].reverse().map((m) => {
                  const van = `${m.key}-01`;
                  const tot = plusDagen(plusMaanden(van, 1), -1);
                  const inPeriode = tot >= periode.van && van <= periode.tot;
                  return (
                    <tr key={m.key} className={inPeriode ? 'bg-amber-50/50' : ''}>
                      <td>
                        <Link
                          className="rij-link capitalize"
                          href={urlMet('/dashboard/analyse', { tab: 'verkoop' }, periodeParams({ keuze: 'eigen', van, tot: tot > periode.vandaag ? periode.vandaag : tot, vergelijk: periode.vergelijk }))}
                        >
                          {m.labelLang}
                        </Link>
                      </td>
                      <td className="num">{m.gefactureerd ? euro(m.gefactureerd) : <span className="text-ink-300">–</span>}</td>
                      <td className="num">{m.orders ? <Link className="rij-link" href={urlMet('/dashboard/orders', lijstFilter({ van, tot }))}>{m.orders}</Link> : <span className="text-ink-300">–</span>}</td>
                      <td className="num stil">{m.orderwaarde ? euro(m.orderwaarde) : '–'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Blok>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Blok
          titel="Omzet per klant"
          uitleg={
            d.perKlant.totaalKlanten > 0
              ? `${aantal(d.perKlant.totaalKlanten)} ${d.perKlant.totaalKlanten === 1 ? 'klant' : 'klanten'}; de top tien en de rest als lange staart.`
              : 'Gefactureerd excl. btw.'
          }
          link={{ href: urlMet('/dashboard/rapportages/omzet-klant', pp), label: 'Rapport' }}
        >
          {d.perKlant.top.length === 0 ? (
            <LegeStaat titel="Geen facturen in deze periode" tekst="Kies een langere periode, of bekijk de orderwaarde in de grafiek hierboven." />
          ) : (
            <>
              <Balken
                vergelijk={vgl}
                rijen={d.perKlant.top.map((k) => ({
                  sleutel: k.id ?? k.naam,
                  label: k.naam,
                  waarde: k.omzet,
                  vorige: k.vorige,
                  extra: pct(k.aandeel),
                  sub: `${k.facturen} ${k.facturen === 1 ? 'factuur' : 'facturen'} · samen ${pct(k.cumulatief)} van de omzet`,
                  href: k.id ? urlMet('/dashboard/facturen', lijstFilter(periode, { klant: k.id })) : null,
                }))}
              />
              {d.perKlant.overig.aantal > 0 && (
                <p className="mt-2 border-t border-line pt-2 text-[12px] text-warm">
                  Lange staart: nog {aantal(d.perKlant.overig.aantal)} {d.perKlant.overig.aantal === 1 ? 'klant' : 'klanten'} samen goed voor{' '}
                  <span className="font-semibold text-ink-800">{euro(d.perKlant.overig.omzet)}</span> ({pct(d.omzet.nu ? d.perKlant.overig.omzet / d.omzet.nu : 0)}).
                </p>
              )}
            </>
          )}
        </Blok>

        <div className="grid gap-4">
          <Blok titel="Omzet per branche" uitleg="Op basis van de branche bij de klant. Klik voor de klanten in die branche.">
            {d.perBranche.length === 0 ? (
              <LegeStaat titel="Nog niets te verdelen" tekst="Zodra er in deze periode gefactureerd is, zie je hier welke branches de omzet dragen." />
            ) : (
              <Balken
                vergelijk={vgl}
                maxRijen={8}
                rijen={d.perBranche.map((b) => ({
                  sleutel: b.branche,
                  label: b.branche,
                  waarde: b.omzet,
                  vorige: b.vorige,
                  sub: `${b.klanten} ${b.klanten === 1 ? 'klant' : 'klanten'}`,
                  href: b.branche === 'Geen branche ingevuld' ? null : `/dashboard/klanten?branche=${encodeURIComponent(b.branche)}`,
                  gedimd: b.branche === 'Geen branche ingevuld',
                }))}
              />
            )}
          </Blok>

          <Blok titel="Nieuwe en terugkerende klanten" uitleg="Nieuw = de eerste factuur ooit valt in deze periode.">
            {totaalNT === 0 ? (
              <LegeStaat titel="Geen facturen in deze periode" tekst="Hier zie je straks hoeveel omzet uit nieuwe klanten komt en hoeveel uit vaste klanten." />
            ) : (
              <div>
                <div className="flex h-3 overflow-hidden rounded-full bg-mist" aria-hidden>
                  <span className="bg-amber-500" style={{ width: `${(d.nieuwTerug.nieuw.omzet / totaalNT) * 100}%` }} />
                  <span className="bg-ink-700" style={{ width: `${(d.nieuwTerug.terug.omzet / totaalNT) * 100}%` }} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-[13px]">
                  <div>
                    <dt className="flex items-center gap-1.5 text-warm"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />Nieuw</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums text-ink-900">{euro(d.nieuwTerug.nieuw.omzet)}</dd>
                    <dd className="text-[12px] text-warm">{d.nieuwTerug.nieuw.klanten} {d.nieuwTerug.nieuw.klanten === 1 ? 'klant' : 'klanten'}</dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1.5 text-warm"><span className="h-2.5 w-2.5 rounded-sm bg-ink-700" />Terugkerend</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums text-ink-900">{euro(d.nieuwTerug.terug.omzet)}</dd>
                    <dd className="text-[12px] text-warm">{d.nieuwTerug.terug.klanten} {d.nieuwTerug.terug.klanten === 1 ? 'klant' : 'klanten'}</dd>
                  </div>
                </dl>
              </div>
            )}
          </Blok>
        </div>
      </div>
    </div>
  );
}
