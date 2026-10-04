'use client';

import { useState } from 'react';
import {
  DOEL_LABEL,
  DOEL_SOORTEN,
  DOELGROEP_LABEL,
  DOELGROEPEN,
  TRIGGER_INFO,
  TRIGGER_SOORTEN,
  standaardTrigger,
  type Doel,
  type DoelSoort,
  type Doelgroep,
  type Trigger,
  type TriggerSoort,
} from '@/lib/campagnes/flow';
import { bewaarInstellingenActie } from './actions';

/** Welke triggers kijken alleen naar nieuwe gebeurtenissen, en welke naar de huidige stand? */
const ALLEEN_NIEUW: TriggerSoort[] = ['lead_nieuw', 'qr_scan', 'klant_nieuw', 'order_geleverd'];

export default function TriggerFormulier({
  campagneId,
  begin,
  prospectStatussen,
  leadBronnen,
  kanOpslaan,
  geactiveerdOp,
}: {
  campagneId: string;
  begin: { naam: string; omschrijving: string; van_naam: string; van_email: string; doelgroep: Doelgroep; trigger: Trigger; doel: Doel };
  prospectStatussen: string[];
  leadBronnen: string[];
  kanOpslaan: boolean;
  geactiveerdOp: string | null;
}) {
  const [trigger, setTrigger] = useState<Trigger>(begin.trigger);
  const [doel, setDoel] = useState<Doel>(begin.doel);
  const [doelgroep, setDoelgroep] = useState<Doelgroep>(begin.doelgroep);
  const zet = (patch: Partial<Trigger>) => setTrigger((t) => ({ ...t, ...patch }));
  const vast = TRIGGER_INFO[trigger.soort].doelgroep;
  const effectieveDoelgroep = vast ?? doelgroep;

  function kiesSoort(s: TriggerSoort) {
    const basis = standaardTrigger(s);
    setTrigger((t) => ({ ...basis, bron: t.bron, status: t.status, branche: t.branche }));
  }

  function wisselDoel(s: DoelSoort) {
    setDoel((d) => ({ soorten: d.soorten.includes(s) ? d.soorten.filter((x) => x !== s) : [...d.soorten, s] }));
  }

  return (
    <form action={bewaarInstellingenActie} className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <input type="hidden" name="campagneId" value={campagneId} />
      <input type="hidden" name="trigger" value={JSON.stringify(trigger)} />
      <input type="hidden" name="doel" value={JSON.stringify(doel)} />
      <input type="hidden" name="doelgroep" value={effectieveDoelgroep} />

      <section className="panel p-4">
        <h2 className="text-[14px] font-bold text-ink-900">Wanneer komt iemand erin?</h2>
        <div className="mt-3 grid gap-1.5">
          {TRIGGER_SOORTEN.map((s) => (
            <label key={s} className={`flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 ${trigger.soort === s ? 'border-amber-500 bg-amber-50' : 'border-line hover:border-ink-300'}`}>
              <input type="radio" name="_soort" checked={trigger.soort === s} onChange={() => kiesSoort(s)} className="mt-0.5 h-4 w-4 border-line text-amber-500 focus:ring-amber-300" />
              <span>
                <span className="block text-[13px] font-semibold text-ink-900">{TRIGGER_INFO[s].label}</span>
                <span className="block text-[12px] text-warm">{TRIGGER_INFO[s].uitleg}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="mt-4 grid gap-3">
          {trigger.soort === 'handmatig' && (
            <div>
              <label className="veld-label">Doelgroep</label>
              <select value={doelgroep} onChange={(e) => setDoelgroep(e.target.value as Doelgroep)} className="veld w-48">
                {DOELGROEPEN.map((d) => (
                  <option key={d} value={d}>
                    {DOELGROEP_LABEL[d]}
                  </option>
                ))}
              </select>
              <p className="veld-hint">Bepaalt wat je standaard ziet bij Ontvangers. Je kunt daar ook andere groepen inschrijven.</p>
            </div>
          )}
          {trigger.soort === 'lead_nieuw' && (
            <div>
              <label className="veld-label">Alleen leads via (optioneel)</label>
              <input value={trigger.bron} onChange={(e) => zet({ bron: e.target.value })} list="lead-bronnen" className="veld" placeholder="Leeg = elke nieuwe lead" />
              <datalist id="lead-bronnen">
                {leadBronnen.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
              <p className="veld-hint">Werkt op een deel van de naam: &ldquo;Branchepagina&rdquo; pakt alle branchepagina&rsquo;s.</p>
            </div>
          )}
          {trigger.soort === 'prospect_status' && (
            <div>
              <label className="veld-label">Status</label>
              <select value={trigger.status} onChange={(e) => zet({ status: e.target.value })} className="veld w-56">
                <option value="">Kies…</option>
                {prospectStatussen.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}
          {trigger.soort === 'klant_slapend' && (
            <div>
              <label className="veld-label">Geen order sinds</label>
              <div className="flex items-center gap-2">
                <input type="number" min={1} max={36} value={trigger.maanden} onChange={(e) => zet({ maanden: Number(e.target.value) || 6 })} className="veld w-24" />
                <span className="text-[13px] text-warm">maanden</span>
              </div>
            </div>
          )}
          {trigger.soort === 'spaar_bijna' && (
            <>
              <div>
                <label className="veld-label">Waarop</label>
                <select value={trigger.spaarModus} onChange={(e) => zet({ spaarModus: e.target.value as 'niveau' | 'punten' })} className="veld w-72 max-w-full">
                  <option value="niveau">Dicht bij het volgende spaarniveau</option>
                  <option value="punten">Saldo net onder een puntengrens</option>
                </select>
              </div>
              {trigger.spaarModus === 'niveau' ? (
                <div>
                  <label className="veld-label">Vanaf</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min={50} max={99} value={trigger.niveauPct} onChange={(e) => zet({ niveauPct: Number(e.target.value) || 80 })} className="veld w-24" />
                    <span className="text-[13px] text-warm">% op weg naar het volgende niveau</span>
                  </div>
                  <p className="veld-hint">Zijn er (nog) geen spaarniveaus ingesteld, dan geldt de puntengrens hieronder.</p>
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="veld-label">Puntengrens</label>
                  <input type="number" min={1} value={trigger.drempel} onChange={(e) => zet({ drempel: Number(e.target.value) || 1000 })} className="veld" />
                </div>
                <div>
                  <label className="veld-label">Maximaal eronder</label>
                  <input type="number" min={1} value={trigger.marge} onChange={(e) => zet({ marge: Number(e.target.value) || 150 })} className="veld" />
                </div>
              </div>
            </>
          )}
          {trigger.soort !== 'handmatig' && (
            <>
              <div>
                <label className="veld-label">Alleen branche (optioneel)</label>
                <input value={trigger.branche} onChange={(e) => zet({ branche: e.target.value })} className="veld" placeholder="bijv. bouw, installatie" />
              </div>
              <label className="flex items-start gap-2 text-[13px] text-ink-700">
                <input type="checkbox" checked={trigger.herhalen} onChange={(e) => zet({ herhalen: e.target.checked })} className="mt-0.5 h-4 w-4 rounded border-line text-amber-500 focus:ring-amber-300" />
                <span>
                  Mag er later nog een keer in, als de vorige keer
                  <input type="number" min={1} max={3650} value={trigger.herhaalNaDagen} onChange={(e) => zet({ herhaalNaDagen: Number(e.target.value) || 60 })} className="veld mx-1.5 inline-block w-20 py-0.5" />
                  dagen geleden is
                </span>
              </label>
              <p className="rounded-md bg-mist px-3 py-2 text-[12px] text-ink-700">
                {ALLEEN_NIEUW.includes(trigger.soort)
                  ? `Kijkt alleen naar wat er gebeurt vanaf het moment dat je de campagne voor het eerst start${geactiveerdOp ? ` (${new Date(geactiveerdOp).toLocaleDateString('nl-NL')})` : ''}. Wie al eerder scande of aanvroeg, schrijf je zelf in bij Ontvangers.`
                  : 'Neemt iedereen mee die er nu aan voldoet, maximaal 200 per dag. Wil je eerst kijken wie dat zijn? Laat de campagne op concept en gebruik Ontvangers.'}{' '}
                Nieuwe mensen komen erin bij de dagelijkse run.
              </p>
            </>
          )}
        </div>
      </section>

      <div className="flex flex-col gap-6">
        <section className="panel p-4">
          <h2 className="text-[14px] font-bold text-ink-900">Doel: wanneer stopt iemand vanzelf?</h2>
          <p className="mt-1 text-[12px] text-warm">Zodra één van deze dingen gebeurt, stopt de campagne voor die persoon en telt het als conversie.</p>
          <div className="mt-3 grid gap-1.5">
            {DOEL_SOORTEN.map((s) => (
              <label key={s} className="flex items-center gap-2 text-[13px] text-ink-800">
                <input type="checkbox" checked={doel.soorten.includes(s)} onChange={() => wisselDoel(s)} className="h-4 w-4 rounded border-line text-amber-500 focus:ring-amber-300" />
                {DOEL_LABEL[s]}
              </label>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-warm">Afgemeld, adres werkt niet of geen e-mailadres meer: dan stopt het altijd.</p>
        </section>

        <section className="panel p-4">
          <h2 className="text-[14px] font-bold text-ink-900">Naam en afzender</h2>
          <div className="mt-3 grid gap-3">
            <div>
              <label className="veld-label" htmlFor="t-naam">Naam</label>
              <input id="t-naam" name="naam" defaultValue={begin.naam} required className="veld" />
            </div>
            <div>
              <label className="veld-label" htmlFor="t-oms">Notitie voor jezelf</label>
              <textarea id="t-oms" name="omschrijving" defaultValue={begin.omschrijving} rows={2} className="veld" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="veld-label" htmlFor="t-vn">Afzendernaam</label>
                <input id="t-vn" name="van_naam" defaultValue={begin.van_naam} placeholder="Jessi Frederiks" className="veld" />
              </div>
              <div>
                <label className="veld-label" htmlFor="t-ve">Afzenderadres</label>
                <input id="t-ve" name="van_email" type="email" defaultValue={begin.van_email} placeholder="Standaard: het campagne-adres" className="veld" />
              </div>
            </div>
            <p className="veld-hint">Antwoorden komen binnen op het afzenderadres, of anders op info@frederiksbedrijfskleding.nl. Gebruik alleen een adres van een domein dat in Resend is geverifieerd.</p>
          </div>
        </section>

        <div className="flex items-center gap-3">
          <button type="submit" className="knop-primair">
            Opslaan
          </button>
          {!kanOpslaan && <span className="text-[12px] text-warm">Trigger en doel opslaan kan na de migratie; naam en afzender wel.</span>}
        </div>
      </div>
    </form>
  );
}
