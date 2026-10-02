'use client';
import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { MATEN, type DemoMaten } from '@/lib/prospect/demo/model';
import { useDemo } from './DemoProvider';
import { Balk, TijdChip, euro, kaart, knopAccent, veld } from './ui';

const ROL_LABEL = { beheerder: 'Beheerder', leidinggevende: 'Leidinggevende', medewerker: 'Medewerker' } as const;

/** Medewerkerslijst met afdeling, maten en budget, plus lokaal een nieuwe collega toevoegen. */
export default function MedewerkersDemo() {
  const { data, paden, medewerkers, budgetVan, voegMedewerkerToe, setVoorMedewerker } = useDemo();
  const router = useRouter();
  const [afdeling, setAfdeling] = useState<string>('alle');
  const [zoek, setZoek] = useState('');
  const [melding, setMelding] = useState<{ id: string; naam: string } | null>(null);

  const standaardAfd = data.afdelingen[0]?.id ?? '';
  const [form, setForm] = useState({
    voornaam: '',
    achternaam: '',
    functie: '',
    afdelingId: standaardAfd,
    boven: 'L',
    broek: '52',
    schoen: '43',
    budget: '',
  });

  const budgetVoorAfdeling = (afdId: string) => {
    const leden = medewerkers.filter((m) => m.afdelingId === afdId && m.rol === 'medewerker');
    if (leden.length > 0) return Math.round(leden.reduce((t, m) => t + m.budget, 0) / leden.length / 25) * 25;
    return 250;
  };

  const term = zoek.trim().toLowerCase();
  const zichtbaar = useMemo(
    () =>
      medewerkers.filter(
        (m) =>
          (afdeling === 'alle' || m.afdelingId === afdeling) &&
          (!term || m.naam.toLowerCase().includes(term) || m.functie.toLowerCase().includes(term)),
      ),
    [medewerkers, afdeling, term],
  );

  function bestelVoor(id: string) {
    setVoorMedewerker(id);
    router.push(`${paden.portaal}/webshop`);
  }

  function opslaan(e: FormEvent) {
    e.preventDefault();
    if (!form.voornaam.trim()) return;
    const maten: DemoMaten = { boven: form.boven, broek: form.broek, schoen: form.schoen, handschoen: '9' };
    const budget = Number(form.budget.replace(',', '.'));
    const nieuw = voegMedewerkerToe({
      voornaam: form.voornaam,
      achternaam: form.achternaam,
      functie: form.functie,
      afdelingId: form.afdelingId,
      maten,
      budget: Number.isFinite(budget) && budget > 0 ? budget : budgetVoorAfdeling(form.afdelingId),
    });
    setMelding({ id: nieuw.id, naam: nieuw.naam });
    setForm((f) => ({ ...f, voornaam: '', achternaam: '', functie: '', budget: '' }));
  }

  const functieSuggesties = useMemo(
    () => [...new Set([...data.functies, ...medewerkers.map((m) => m.functie)])],
    [data.functies, medewerkers],
  );

  return (
    <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="min-w-0 lg:col-span-2">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter op afdeling">
          {[{ id: 'alle', naam: 'Iedereen' }, ...data.afdelingen].map((a) => {
            const aan = afdeling === a.id;
            const n = a.id === 'alle' ? medewerkers.length : medewerkers.filter((m) => m.afdelingId === a.id).length;
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={aan}
                onClick={() => setAfdeling(a.id)}
                className={`inline-flex min-h-[40px] items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${aan ? 'border-ink-900 bg-ink-900 text-white' : 'border-line bg-white text-ink-700 hover:border-ink-300'}`}
              >
                {a.naam}
                <span className={`rounded-full px-1.5 text-[11px] ${aan ? 'bg-white/25' : 'bg-ink-100'}`}>{n}</span>
              </button>
            );
          })}
          <input
            type="search"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            placeholder="Zoek op naam of functie"
            aria-label="Zoek medewerkers"
            className="min-h-[40px] w-full rounded-full border border-line bg-white px-4 text-base sm:ml-auto sm:w-56 sm:text-sm"
          />
        </div>

        {melding && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-green-300 bg-green-50 p-4 text-sm text-green-800" role="status">
            <span>
              <strong>{melding.naam}</strong> staat erin, met maten en budget. Bestel meteen de eerste set.
            </span>
            <button type="button" onClick={() => bestelVoor(melding.id)} className="rounded-md bg-green-700 px-3 py-2 text-xs font-semibold text-white hover:bg-green-800">
              Bestel voor {melding.naam.split(' ')[0]}
            </button>
          </div>
        )}

        <ul className="mt-4 space-y-3">
          {zichtbaar.map((m) => {
            const b = budgetVan(m.id);
            const afd = data.afdelingen.find((a) => a.id === m.afdelingId);
            return (
              <li key={m.id} className="rounded-2xl border border-line bg-white p-4 shadow-soft sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-900">
                      {m.naam}
                      {m.nieuw && <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">Nieuw</span>}
                    </p>
                    <p className="text-xs text-warm">
                      {m.functie} · {afd?.naam}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {m.rol !== 'medewerker' && (
                      <span className="rounded-full bg-[var(--demo-accent-zacht)] px-2.5 py-0.5 text-[11px] font-semibold text-[color:var(--demo-accent-tekst)]">
                        {ROL_LABEL[m.rol]}
                      </span>
                    )}
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${m.heeftLogin ? 'border-green-300 bg-green-50 text-green-800' : 'border-line bg-mist text-warm'}`}
                    >
                      {m.heeftLogin ? 'Kan inloggen' : 'Geen login'}
                    </span>
                  </div>
                </div>

                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {(
                    [
                      ['Boven', m.maten.boven],
                      ['Broek', m.maten.broek],
                      ['Schoen', m.maten.schoen],
                    ] as const
                  ).map(([label, waarde]) => (
                    <div key={label} className="rounded-lg bg-mist px-2 py-1.5">
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-warm">{label}</dt>
                      <dd className="font-display text-base font-extrabold text-ink-900">{waarde}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-3">
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="font-semibold text-ink-700">Jaarbudget {euro(b.budget, true)}</span>
                    <span className="text-warm">nog {euro(Math.max(0, b.restant), true)} over</span>
                  </div>
                  <div className="mt-1">
                    <Balk deel={b.verbruikt + b.inAanvraag} totaal={b.budget} label={`Budget ${m.naam} verbruikt`} />
                  </div>
                </div>

                <div className="mt-3 flex justify-end">
                  <button type="button" onClick={() => bestelVoor(m.id)} className="min-h-[40px] text-sm font-semibold text-[color:var(--demo-accent-tekst)] hover:underline">
                    Bestel voor {m.voornaam} <span aria-hidden="true">&rarr;</span>
                  </button>
                </div>
              </li>
            );
          })}
          {zichtbaar.length === 0 && <li className="rounded-2xl border border-line bg-white p-6 text-sm text-warm">Niemand gevonden voor &lsquo;{zoek}&rsquo;.</li>}
        </ul>
      </div>

      <div id="nieuw" className="scroll-mt-6">
        <form onSubmit={opslaan} className={kaart}>
          <h2 className="font-display text-lg font-extrabold text-ink-900">Nieuwe medewerker</h2>
          <p className="mt-1 text-xs text-warm">Vul de maten in en de collega kan direct besteld worden. Jessi krijgt er meteen bericht van.</p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="nm-voornaam" className="block text-sm font-semibold text-ink-900">Voornaam</label>
              <input id="nm-voornaam" required maxLength={40} value={form.voornaam} onChange={(e) => setForm({ ...form, voornaam: e.target.value })} className={veld} autoComplete="off" />
            </div>
            <div>
              <label htmlFor="nm-achternaam" className="block text-sm font-semibold text-ink-900">Achternaam</label>
              <input id="nm-achternaam" maxLength={40} value={form.achternaam} onChange={(e) => setForm({ ...form, achternaam: e.target.value })} className={veld} autoComplete="off" />
            </div>
          </div>

          <label htmlFor="nm-afdeling" className="mt-3 block text-sm font-semibold text-ink-900">Afdeling</label>
          <select id="nm-afdeling" value={form.afdelingId} onChange={(e) => setForm({ ...form, afdelingId: e.target.value })} className={veld}>
            {data.afdelingen.map((a) => (
              <option key={a.id} value={a.id}>
                {a.naam}
              </option>
            ))}
          </select>

          <label htmlFor="nm-functie" className="mt-3 block text-sm font-semibold text-ink-900">Functie</label>
          <input id="nm-functie" list="nm-functies" maxLength={60} value={form.functie} onChange={(e) => setForm({ ...form, functie: e.target.value })} placeholder="bijv. monteur" className={veld} autoComplete="off" />
          <datalist id="nm-functies">
            {functieSuggesties.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>

          <fieldset className="mt-3">
            <legend className="text-sm font-semibold text-ink-900">Maten</legend>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {(
                [
                  ['boven', 'Boven', MATEN.boven],
                  ['broek', 'Broek', MATEN.broek],
                  ['schoen', 'Schoen', MATEN.schoen],
                ] as const
              ).map(([sleutel, label, opties]) => (
                <div key={sleutel}>
                  <label htmlFor={`nm-${sleutel}`} className="block text-xs text-warm">{label}</label>
                  <select id={`nm-${sleutel}`} value={form[sleutel]} onChange={(e) => setForm({ ...form, [sleutel]: e.target.value })} className={veld}>
                    {opties.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </fieldset>

          <label htmlFor="nm-budget" className="mt-3 block text-sm font-semibold text-ink-900">Jaarbudget</label>
          <input
            id="nm-budget"
            inputMode="decimal"
            maxLength={7}
            value={form.budget}
            onChange={(e) => setForm({ ...form, budget: e.target.value })}
            placeholder={`bijv. ${budgetVoorAfdeling(form.afdelingId)}`}
            className={veld}
          />

          <button type="submit" className={`${knopAccent} mt-5 w-full`}>
            Medewerker toevoegen
          </button>
          <p className="mt-2 text-xs text-warm">Voorbeeld: blijft alleen in deze browser en verdwijnt als je het tabblad sluit.</p>
        </form>
        <TijdChip className="mt-4">nieuwe collega in 1 minuut besteld. Naam, maten, budget en klaar.</TijdChip>
      </div>
    </div>
  );
}
