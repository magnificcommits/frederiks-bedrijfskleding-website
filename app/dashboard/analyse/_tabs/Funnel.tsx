import Link from 'next/link';
import KpiTegel from '@/components/dashboard/overzicht/KpiTegel';
import LegeStaat from '@/components/dashboard/overzicht/LegeStaat';
import { analyseFunnel } from '@/lib/kms/analyse';
import type { Duur } from '@/lib/kms/analyseData';
import { periodeParams, urlMet, type Periode } from '@/lib/kms/analysePeriode';
import Blok from '../_delen/Blok';
import LeadHerkomst from './LeadHerkomst';
import { aantal, dagen, euro, pct } from '../_delen/opmaak';

function DuurTegel({ titel, duur, uitleg, leeg }: { titel: string; duur: Duur | null; uitleg: string; leeg: string }) {
  return (
    <div className="rounded-md border border-line p-3">
      <p className="text-[12px] font-medium text-warm">{titel}</p>
      {duur ? (
        <>
          <p className="mt-1 font-display text-[22px] font-bold leading-none tabular-nums text-ink-900">{dagen(duur.mediaan)}</p>
          <p className="mt-1.5 text-[11px] text-warm">
            mediaan van {duur.n} {duur.n === 1 ? 'geval' : 'gevallen'}, gemiddeld {dagen(duur.gemiddeld)}
          </p>
        </>
      ) : (
        <p className="mt-1.5 text-[12px] leading-snug text-ink-400">{leeg}</p>
      )}
      <p className="mt-2 border-t border-line pt-1.5 text-[11px] leading-snug text-warm">{uitleg}</p>
    </div>
  );
}

export default async function Funnel({ periode }: { periode: Periode }) {
  const d = await analyseFunnel(periode);
  const vgl = periode.vgl?.label ?? null;
  const pp = periodeParams(periode);
  const delta = (nu: number, vorige: number | null) => (vgl && vorige !== null ? { nu, vorige, richting: 'hoger-beter' as const, vergelijk: vgl } : undefined);
  const max = Math.max(1, ...d.stappen.map((s) => s.aantal));
  const niets = d.stappen.every((s) => s.aantal === 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTegel label="Nieuwe leads" waarde={aantal(d.leads.nu)} href="/dashboard/leads" delta={delta(d.leads.nu, d.leads.vorige)} />
        <KpiTegel
          label="Leadconversie"
          waarde={pct(d.leadConversie)}
          href="/dashboard/leads?status=geaccordeerd"
          sub={
            <span className="text-warm">
              {d.leadConversie === null
                ? 'Nog geen leads afgerond in deze periode.'
                : `${d.leadStatus.gewonnen} gewonnen, ${d.leadStatus.verloren} verloren (${euro(d.gewonnenWaarde)})`}
            </span>
          }
        />
        <KpiTegel label="Offertes gemaakt" waarde={aantal(d.offertes.aangemaakt.nu)} href="/dashboard/offertes" delta={delta(d.offertes.aangemaakt.nu, d.offertes.aangemaakt.vorige)} />
        <KpiTegel
          label="Offerteconversie"
          waarde={pct(d.offertes.conversie)}
          href={urlMet('/dashboard/rapportages/offertes', pp)}
          sub={
            <span className="text-warm">
              {d.offertes.conversie === null
                ? `${d.offertes.open} nog open, ${euro(d.offertes.waardeOpen)}`
                : `${d.offertes.geaccepteerd} akkoord, ${d.offertes.afgewezen} afgewezen`}
            </span>
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Blok titel="Van aanvraag tot order" uitleg="Alles wat in deze periode is binnengekomen of aangemaakt. Klik op een stap voor de lijst.">
          {niets ? (
            <LegeStaat titel="Nog geen leads, offertes of orders in deze periode" tekst="Kies een langere periode. Leads komen binnen via het adviesformulier op de site of voer je zelf in." actieHref="/dashboard/leads" actieLabel="Naar leads" />
          ) : (
            <ol className="space-y-2">
              {d.stappen.map((s, i) => {
                const vorige = i > 0 ? d.stappen[i - 1].aantal : null;
                return (
                  <li key={s.label}>
                    <Link href={s.href} className="group -mx-2 grid grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-1.5 hover:bg-mist">
                      <span className="text-[13px] font-medium text-ink-900 group-hover:underline">{s.label}</span>
                      <span className="block h-6 overflow-hidden rounded bg-mist">
                        <span className={`block h-full rounded ${i === d.stappen.length - 1 ? 'bg-amber-500' : 'bg-ink-700'}`} style={{ width: `${Math.max(1.5, (s.aantal / max) * 100)}%` }} />
                      </span>
                      <span className="w-28 text-right text-[13px] tabular-nums text-ink-900">
                        {aantal(s.aantal)}
                        {vorige !== null && vorige > 0 && <span className="ml-1.5 text-[11px] text-ink-400">{pct(s.aantal / vorige)}</span>}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="mt-3 text-[11px] leading-snug text-warm">
            Het percentage is ten opzichte van de stap erboven. Niet elke order komt uit een offerte (vaste klanten bestellen ook direct of via het portaal), dus de laatste stap kan hoger uitkomen.
          </p>
        </Blok>

        <Blok
          titel="Doorlooptijden"
          uitleg="Hoe lang het duurt tussen de stappen. Mediaan, zodat één uitschieter het beeld niet bepaalt."
        >
          <div className="grid gap-2">
            <DuurTegel
              titel="Lead tot offerte"
              duur={d.doorloop.leadNaarOfferte}
              uitleg="Van binnenkomst van de lead tot de offerte die eraan hangt."
              leeg="Nog geen offertes die aan een lead gekoppeld zijn in deze periode."
            />
            <DuurTegel
              titel="Offerte verstuurd tot akkoord"
              duur={d.doorloop.offerteNaarAkkoord}
              uitleg="Van de status verstuurd tot geaccepteerd."
              leeg={d.doorloop.historie ? 'Nog geen offertes geaccepteerd in deze periode.' : 'Wordt bijgehouden zodra de statushistorie aanstaat (migratie).'}
            />
            <DuurTegel
              titel="Order tot geleverd"
              duur={d.doorloop.orderNaarGeleverd}
              uitleg="Van besteldatum tot verzonden, factureren of afgerond."
              leeg={d.doorloop.historie ? 'Nog geen orders geleverd in deze periode.' : 'Wordt bijgehouden zodra de statushistorie aanstaat (migratie).'}
            />
          </div>
        </Blok>
      </div>

      <Blok
        titel="Leads per bron"
        uitleg="Waar komen aanvragen vandaan en welke bron levert opdrachten op. Klik voor de leads uit die bron."
      >
        {d.perBron.length === 0 ? (
          <LegeStaat titel="Geen leads in deze periode" tekst="Zodra er aanvragen binnenkomen, zie je hier welke pagina's, campagnes en verwijzers het meeste opleveren." />
        ) : (
          <div className="-mx-4 -mb-4 overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Bron</th>
                  <th className="text-right">Leads</th>
                  <th className="text-right">Offerte</th>
                  <th className="text-right">Gewonnen</th>
                  <th className="text-right">Verloren</th>
                  <th className="text-right">Conversie</th>
                  <th className="text-right">Gewonnen waarde</th>
                </tr>
              </thead>
              <tbody>
                {d.perBron.map((b) => {
                  const afgerond = b.gewonnen + b.verloren;
                  return (
                    <tr key={b.bron}>
                      <td>
                        {b.bron === 'Onbekend' ? (
                          <span className="text-warm">Onbekend</span>
                        ) : (
                          <Link href={`/dashboard/leads?bron=${encodeURIComponent(b.bron)}`} className="rij-link">{b.bron}</Link>
                        )}
                      </td>
                      <td className="num">{b.leads}</td>
                      <td className="num">{b.offerte || <span className="text-ink-300">–</span>}</td>
                      <td className="num">{b.gewonnen || <span className="text-ink-300">–</span>}</td>
                      <td className="num stil">{b.verloren || <span className="text-ink-300">–</span>}</td>
                      <td className="num">{afgerond ? pct(b.gewonnen / afgerond) : <span className="text-ink-300">–</span>}</td>
                      <td className="num">{b.waarde ? euro(b.waarde) : <span className="text-ink-300">–</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Blok>

      <LeadHerkomst periode={periode} />
    </div>
  );
}
