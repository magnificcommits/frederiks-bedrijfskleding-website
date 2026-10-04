import Link from 'next/link';
import KpiTegel from '@/components/dashboard/overzicht/KpiTegel';
import LegeStaat from '@/components/dashboard/overzicht/LegeStaat';
import { analyseKlanten } from '@/lib/kms/analyse';
import { datumKort, periodeParams, urlMet, type Periode } from '@/lib/kms/analysePeriode';
import Blok from '../_delen/Blok';
import { aantal, euro, pct } from '../_delen/opmaak';

export default async function Klanten({ periode, slaap }: { periode: Periode; slaap: number }) {
  const d = await analyseKlanten(periode, slaap);
  const vgl = periode.vgl?.label ?? null;
  const pp = periodeParams(periode);
  const klant = (id: string, tab = 'verkoop') => `/dashboard/klanten/${id}?tab=${tab}`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTegel
          label="Klanten met omzet"
          waarde={aantal(d.klanten12)}
          href={urlMet('/dashboard/rapportages/omzet-klant', { periode: '12m' })}
          sub={<span className="text-warm">laatste 12 maanden tot {datumKort(periode.tot)}</span>}
        />
        <KpiTegel
          label="Gemiddelde klantwaarde"
          waarde={d.klanten12 ? euro(d.gemKlantwaarde) : '–'}
          href={urlMet('/dashboard/rapportages/omzet-klant', { periode: '12m' })}
          sub={<span className="text-warm">gefactureerd per klant, 12 maanden</span>}
        />
        <KpiTegel
          label="Slapende klanten"
          waarde={aantal(d.slapend.length)}
          href="/dashboard/klanten"
          sub={<span className="text-warm">niets afgenomen sinds {slaap} maanden</span>}
        />
        <KpiTegel
          label="Bestellingen via portaal"
          waarde={aantal(d.portaal.bestellingen.nu)}
          href="/dashboard/klanten"
          delta={vgl && d.portaal.bestellingen.vorige !== null ? { nu: d.portaal.bestellingen.nu, vorige: d.portaal.bestellingen.vorige, richting: 'hoger-beter', vergelijk: vgl } : undefined}
          sub={<span className="text-warm">{d.portaal.klantenMetPortaal} {d.portaal.klantenMetPortaal === 1 ? 'klant heeft' : 'klanten hebben'} een portaal</span>}
        />
      </div>

      <Blok
        titel="Klantwaarde over 12 maanden"
        uitleg={`Gefactureerd excl. btw van ${datumKort(d.venster.van)} tot en met ${datumKort(d.venster.tot)}, met orders en de laatste activiteit.`}
        link={{ href: urlMet('/dashboard/rapportages/omzet-klant', { periode: '12m' }), label: 'Rapport' }}
      >
        {d.waarde.length === 0 ? (
          <LegeStaat titel="Nog geen klanten met omzet" tekst="Na de eerste facturen zie je hier welke klanten het meest waard zijn en wanneer ze voor het laatst iets afnamen." />
        ) : (
          <div className="-mx-4 -mb-4 overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Klant</th>
                  <th className="hidden md:table-cell">Branche</th>
                  <th className="text-right">Omzet 12 mnd</th>
                  <th className="text-right">Orders</th>
                  <th className="hidden text-right sm:table-cell">Gem. order</th>
                  <th className="hidden text-right sm:table-cell">Medewerkers</th>
                  <th className="text-right">Laatst actief</th>
                </tr>
              </thead>
              <tbody>
                {d.waarde.map((k) => (
                  <tr key={k.id}>
                    <td><Link href={klant(k.id)} className="rij-link">{k.naam}</Link></td>
                    <td className="stil hidden md:table-cell">{k.branche ?? '–'}</td>
                    <td className="num">{euro(k.omzet12)}</td>
                    <td className="num">{k.orders12}</td>
                    <td className="num stil hidden sm:table-cell">{k.gemOrder ? euro(k.gemOrder) : '–'}</td>
                    <td className="num stil hidden sm:table-cell">{k.medewerkers || '–'}</td>
                    <td className="num stil">{datumKort(k.laatste)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Blok>

      <div className="grid gap-4 lg:grid-cols-2">
        <Blok
          titel="Slapende klanten"
          uitleg="Wel eerder besteld of gefactureerd, sindsdien niets. Een belletje waard."
        >
          <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[12px]">
            <span className="text-warm">Niets sinds</span>
            {[3, 6, 12].map((m) => (
              <Link
                key={m}
                href={urlMet('/dashboard/analyse', { tab: 'klanten' }, pp, m === 6 ? {} : { slaap: String(m) })}
                className={`chip ${slaap === m ? 'chip-aan' : ''}`}
              >
                {m} maanden
              </Link>
            ))}
          </div>
          {d.slapend.length === 0 ? (
            <LegeStaat titel="Geen slapende klanten" tekst={`Iedere klant die ooit iets afnam, heeft in de laatste ${slaap} maanden nog besteld. Of er is nog te weinig historie.`} />
          ) : (
            <div className="-mx-4 -mb-4 overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Klant</th>
                    <th className="text-right">Laatst actief</th>
                    <th className="text-right">Omzet ooit</th>
                  </tr>
                </thead>
                <tbody>
                  {d.slapend.map((k) => (
                    <tr key={k.id}>
                      <td><Link href={klant(k.id, 'contact')} className="rij-link">{k.naam}</Link></td>
                      <td className="num stil">{datumKort(k.laatste)} <span className="text-ink-400">({Math.round(k.dagen / 30)} mnd)</span></td>
                      <td className="num">{k.omzetOoit ? euro(k.omzetOoit) : `${k.orders} ${k.orders === 1 ? 'order' : 'orders'}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Blok>

        <Blok
          titel="Meeste groeipotentieel"
          uitleg="Klanten met veel medewerkers in het systeem, maar weinig omzet per medewerker in 12 maanden."
        >
          {d.potentieel.length === 0 ? (
            <LegeStaat
              titel="Nog te weinig medewerkers geregistreerd"
              tekst="Dit overzicht vult zich zodra klanten hun medewerkers in het systeem hebben (minstens twee per klant)."
              actieHref="/dashboard/klanten"
              actieLabel="Naar klanten"
            />
          ) : (
            <div className="-mx-4 -mb-4 overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Klant</th>
                    <th className="text-right">Medewerkers</th>
                    <th className="text-right">Omzet 12 mnd</th>
                    <th className="text-right">Per medewerker</th>
                  </tr>
                </thead>
                <tbody>
                  {d.potentieel.map((k) => (
                    <tr key={k.id}>
                      <td>
                        <Link href={klant(k.id, 'werknemers')} className="rij-link">{k.naam}</Link>
                        {!k.portaal && <span className="badge-rust ml-2">geen portaal</span>}
                      </td>
                      <td className="num">{k.medewerkers}</td>
                      <td className="num">{euro(k.omzet12)}</td>
                      <td className="num stil">{euro(k.perMedewerker)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Blok>
      </div>

      <Blok
        titel="Portaalgebruik"
        uitleg={
          d.portaal.aandeelOrders !== null
            ? `${pct(d.portaal.aandeelOrders)} van de bestellingen in deze periode kwam via het klantportaal (${euro(d.portaal.waarde)}).`
            : 'Klanten met portaaltoegang en wat ze er bestellen.'
        }
      >
        {d.portaal.perKlant.length === 0 ? (
          <LegeStaat
            titel="Nog geen klant gebruikt het portaal"
            tekst="Geef een klant toegang via het tabblad Werknemers bij de klant. Daarna zie je hier wie er bestelt en hoe vaak."
            actieHref="/dashboard/klanten"
            actieLabel="Naar klanten"
          />
        ) : (
          <div className="-mx-4 -mb-4 overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Klant</th>
                  <th className="text-right">Gebruikers</th>
                  <th className="text-right">Bestellingen</th>
                  <th className="text-right">Waarde</th>
                  <th className="text-right">Laatste bestelling</th>
                </tr>
              </thead>
              <tbody>
                {d.portaal.perKlant.map((k) => (
                  <tr key={k.id}>
                    <td><Link href={klant(k.id, 'werknemers')} className="rij-link">{k.naam}</Link></td>
                    <td className="num">{k.gebruikers}</td>
                    <td className="num">{k.bestellingen || <span className="text-ink-300">–</span>}</td>
                    <td className="num">{k.waarde ? euro(k.waarde) : <span className="text-ink-300">–</span>}</td>
                    <td className="num stil">{k.laatste ? datumKort(k.laatste) : 'nog nooit'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Blok>
    </div>
  );
}
