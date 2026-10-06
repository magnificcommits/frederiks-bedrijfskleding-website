'use client';
import Link from 'next/link';
import { useState } from 'react';
import { BRON_WERKKLEDING, LOGO_MIN_CM2, WKR, euro, kledingImpact } from '@/lib/fiscaal';

/**
 * Rekent voor een werkgever uit wat kleding zonder 70 cm²-logo kost aan vrije ruimte
 * en eindheffing. Geen prijzen van Frederiks: de bezoeker vult zijn eigen budget in.
 */
export function OnbelastCalculator({ compact = false }: { compact?: boolean }) {
  const [medewerkers, setMedewerkers] = useState('15');
  const [budget, setBudget] = useState('350');
  const [loon, setLoon] = useState('42000');

  const getal = (v: string) => Math.max(0, Number(v.replace(/[^\d]/g, '')) || 0);
  const r = kledingImpact({ medewerkers: getal(medewerkers), budgetPp: getal(budget), jaarloon: getal(loon) });
  const pct = Math.round(r.aandeel * 100);

  return (
    <div className={`grid overflow-hidden rounded-2xl border border-line shadow-card ${compact ? '' : 'lg:grid-cols-[1fr_1.1fr]'}`} data-plek="onbelast-calculator">
      <div className="bg-white p-6 sm:p-8">
        <h2 className="kop-3">Reken het uit voor je eigen team</h2>
        <p className="mt-2 text-sm text-warm">Drie getallen, geen gegevens nodig. We rekenen met de werkkostenregeling {WKR.jaar}.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          <label className="block">
            <span className="invoer-label">Aantal medewerkers</span>
            <input inputMode="numeric" className="invoer" value={medewerkers} onChange={(e) => setMedewerkers(e.target.value)} />
          </label>
          <label className="block">
            <span className="invoer-label">Kleding per medewerker per jaar (€)</span>
            <input inputMode="numeric" className="invoer" value={budget} onChange={(e) => setBudget(e.target.value)} />
          </label>
          <label className="block">
            <span className="invoer-label">Gemiddeld bruto jaarloon (€)</span>
            <input inputMode="numeric" className="invoer" value={loon} onChange={(e) => setLoon(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="paneel-donker flex flex-col rounded-none p-6 sm:p-8">
        <dl className="grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-white/70">Je vrije ruimte</dt>
            <dd className="font-display text-3xl font-extrabold text-white">{euro(r.vrijeRuimte)}</dd>
          </div>
          <div>
            <dt className="text-sm text-white/70">Kleding per jaar</dt>
            <dd className="font-display text-3xl font-extrabold text-white">{euro(r.kleding)}</dd>
          </div>
        </dl>

        <div className="mt-6 space-y-3 text-[15px] leading-relaxed">
          <p className="rounded-lg bg-white/10 px-4 py-3 text-white">
            <span className="font-bold text-amber-300">Zonder logo van {LOGO_MIN_CM2} cm²</span> gaat {pct}% van je vrije ruimte op aan kleding.
            {r.heffingNu > 0
              ? ` Je zit er nu al overheen: dat kost ${euro(r.heffingNu)} eindheffing.`
              : ` Gebruik je die ruimte al voor iets anders, zoals een kerstpakket of personeelsfeest, dan betaal je tot ${euro(r.heffingAlsVol)} eindheffing.`}
          </p>
          <p className="rounded-lg bg-white/10 px-4 py-3 text-white">
            <span className="font-bold text-emerald-300">Met een logo van {LOGO_MIN_CM2} cm² of meer</span> geef je de kleding onbelast en blijft je vrije ruimte over.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/pakket-samenstellen" className="btn-primary" data-cta="onbelast-pakket">Stel je pakket samen</Link>
          <Link href="/kledingadvies" className="btn border-2 border-white/70 text-white hover:border-white hover:bg-white hover:text-ink-900" data-cta="onbelast-advies">Vraag advies</Link>
        </div>

        <p className="mt-auto pt-6 text-xs text-white/60">
          Indicatie, geen fiscaal advies. Vrije ruimte {WKR.jaar}: 2% van de loonsom tot € 400.000 en 1,18% daarboven, 80% eindheffing erboven.
          Meerdere logo&apos;s op één kledingstuk tellen bij elkaar op. Laat je situatie checken door je boekhouder.{' '}
          <a href={BRON_WERKKLEDING} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white">Bron: Belastingdienst</a>
        </p>
      </div>
    </div>
  );
}
