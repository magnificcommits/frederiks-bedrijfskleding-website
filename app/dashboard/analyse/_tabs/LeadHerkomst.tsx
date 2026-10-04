import LegeStaat from '@/components/dashboard/overzicht/LegeStaat';
import { analyseLeadHerkomst, type HerkomstGroep } from '@/lib/kms/leadHerkomstAnalyse';
import type { Periode } from '@/lib/kms/analysePeriode';
import Blok from '../_delen/Blok';
import { aantal, euro, pct } from '../_delen/opmaak';

const MAX_RIJEN = 8;

function Tabel({ titel, rijen }: { titel: string; rijen: HerkomstGroep[] }) {
  const zichtbaar = rijen.slice(0, MAX_RIJEN);
  const rest = rijen.slice(MAX_RIJEN);
  const overig = rest.length
    ? rest.reduce<HerkomstGroep>(
        (t, r) => ({ ...t, leads: t.leads + r.leads, offerte: t.offerte + r.offerte, order: t.order + r.order, waarde: t.waarde + r.waarde }),
        { naam: `Overig (${rest.length})`, leads: 0, offerte: 0, order: 0, waarde: 0 },
      )
    : null;
  return (
    <div className="min-w-0">
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-warm">{titel}</h3>
      <div className="mt-1 overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>{titel}</th>
              <th className="text-right">Leads</th>
              <th className="text-right" title="Lead kreeg een verstuurde offerte">Offerte</th>
              <th className="text-right" title="Lead werd een order of gewonnen">Order</th>
            </tr>
          </thead>
          <tbody>
            {[...zichtbaar, ...(overig ? [overig] : [])].map((r) => (
              <tr key={r.naam}>
                <td className="max-w-[14rem] truncate" title={r.naam}>{r.naam}</td>
                <td className="num">{aantal(r.leads)}</td>
                <td className="num">
                  {r.offerte ? (
                    <>
                      {aantal(r.offerte)} <span className="text-[11px] text-ink-400">{pct(r.offerte / r.leads)}</span>
                    </>
                  ) : (
                    <span className="text-ink-300">–</span>
                  )}
                </td>
                <td className="num">
                  {r.order ? (
                    <span title={r.waarde ? `${euro(r.waarde)} gewonnen` : undefined}>
                      {aantal(r.order)} <span className="text-[11px] text-ink-400">{pct(r.order / r.leads)}</span>
                    </span>
                  ) : (
                    <span className="text-ink-300">–</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Blok "Leads per kanaal, campagne en landingspagina" met conversie naar offerte en order. */
export default async function LeadHerkomst({ periode }: { periode: Periode }) {
  const d = await analyseLeadHerkomst(periode);
  return (
    <Blok
      titel="Leads per kanaal, campagne en landingspagina"
      uitleg="Waar aanvragen vandaan komen en hoeveel er een offerte (verstuurd) of order werden. Percentages zijn ten opzichte van het aantal leads in die rij."
      link={{ href: '/dashboard/leads', label: 'Naar leads' }}
    >
      {d.totaal === 0 ? (
        <LegeStaat titel="Geen leads in deze periode" tekst="Kies een langere periode of wacht op de eerste aanvragen met herkomst." />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Tabel titel="Kanaal" rijen={d.kanaal} />
            <Tabel titel="Campagne" rijen={d.campagne} />
            <Tabel titel="Landingspagina" rijen={d.landing} />
            <Tabel titel="Ingang" rijen={d.ingang} />
          </div>
          <p className="mt-3 text-[11px] leading-snug text-warm">
            {d.metHerkomst} van de {d.totaal} leads hebben gestructureerde herkomst (utm-tags, verwijzer, landingspagina). Oudere aanvragen
            vallen terug op de bron-tekst. Een concept-offerte die de site automatisch klaarzet telt niet als offerte.
          </p>
        </>
      )}
    </Blok>
  );
}
