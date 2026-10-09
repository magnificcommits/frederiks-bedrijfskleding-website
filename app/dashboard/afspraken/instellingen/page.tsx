import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { listTaakPersonen } from '@/lib/kms/taakPersonen';
import { afspraakPersoon, getBeschikbaarheid } from '@/lib/afspraken/beschikbaarheid';
import { AFSPRAAK_SOORTEN, SOORT_INFO } from '@/lib/afspraken/soorten';
import { DAGEN_LANG } from '@/app/dashboard/taken/tijd';
import { zetBeschikbaarheidActie } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Afspraken: beschikbaarheid', robots: { index: false, follow: false } };

/** Maandag eerst, zondag achteraan. */
const WEEK = [1, 2, 3, 4, 5, 6, 0];

/** Opeenvolgende geblokkeerde dagen samenvatten als "van t/m tot", zodat de lijst kort blijft. */
function blokkenTekst(datums: string[]): string {
  const regels: string[] = [];
  let begin: string | null = null;
  let vorige: string | null = null;
  const volgende = (d: string) => {
    const dt = new Date(`${d}T12:00:00Z`);
    dt.setUTCDate(dt.getUTCDate() + 1);
    return dt.toISOString().slice(0, 10);
  };
  for (const d of [...datums].sort()) {
    if (begin && vorige && volgende(vorige) === d) {
      vorige = d;
      continue;
    }
    if (begin && vorige) regels.push(begin === vorige ? begin : `${begin} t/m ${vorige}`);
    begin = d;
    vorige = d;
  }
  if (begin && vorige) regels.push(begin === vorige ? begin : `${begin} t/m ${vorige}`);
  return regels.join('\n');
}

export default async function AfsprakenInstellingenPage({ searchParams }: { searchParams: Promise<{ melding?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const { melding } = await searchParams;
  const [b, personen] = await Promise.all([getBeschikbaarheid(), listTaakPersonen()]);
  const huidige = await afspraakPersoon(b);

  return (
    <main className="container-smal py-6">
      <div className="dash-kop flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/afspraken" className="knop-tekst" aria-label="Terug naar afspraken">‹ Afspraken</Link>
          <h1 className="dash-h1">Vaste werktijden voor online afspraken</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/afspraken/beschikbaarheid" className="knop-primair">Week open of dicht zetten</Link>
          <a href="/afspraak" target="_blank" rel="noreferrer" className="knop-stil">Boekpagina bekijken</a>
        </div>
      </div>

      {melding === 'opgeslagen' && (
        <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-800">
          Opgeslagen. De boekpagina rekent meteen met de nieuwe tijden.
        </p>
      )}
      {melding === 'mislukt' && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800">Opslaan lukte niet. Probeer het opnieuw.</p>
      )}

      <p className="mt-4 text-[13px] text-warm">
        Klanten zien alleen tijden die vrij zijn: binnen je werkdagen en tijdvakken, niet op geblokkeerde dagen, en niet als er al een afspraak in
        de agenda staat van {huidige?.naam ?? 'de gekozen persoon'} (inclusief de buffer ervoor en erna). Taken zonder tijd houden je niet bezet.
      </p>

      <form action={zetBeschikbaarheidActie} className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="panel p-4">
          <h2 className="font-display text-base font-bold text-ink-900">Wanneer kan er geboekt worden</h2>
          <fieldset className="mt-3">
            <legend className="veld-label">Werkdagen</legend>
            <div className="flex flex-wrap gap-3 text-sm">
              {WEEK.map((d) => (
                <label key={d} className="flex items-center gap-1.5">
                  <input type="checkbox" name="werkdagen" value={d} defaultChecked={b.werkdagen.includes(d)} />
                  {DAGEN_LANG[d]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-4">
            <label className="veld-label" htmlFor="tijdvakken">Tijdvakken</label>
            <input id="tijdvakken" name="tijdvakken" className="veld" defaultValue={b.tijdvakken.map((t) => `${t.van}-${t.tot}`).join(', ')} />
            <p className="veld-hint">Bijvoorbeeld 09:00-12:00, 13:00-17:00. Een afspraak moet helemaal binnen een tijdvak passen.</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="veld-label" htmlFor="bufferMin">Buffer (minuten)</label>
              <input id="bufferMin" name="bufferMin" type="number" min={0} max={240} className="veld" defaultValue={b.bufferMin} />
              <p className="veld-hint">Vrij voor en na elke afspraak.</p>
            </div>
            <div>
              <label className="veld-label" htmlFor="maxPerDag">Maximaal per dag</label>
              <input id="maxPerDag" name="maxPerDag" type="number" min={1} max={20} className="veld" defaultValue={b.maxPerDag} />
              <p className="veld-hint">Online geboekte afspraken.</p>
            </div>
            <div>
              <label className="veld-label" htmlFor="minUrenVooraf">Minimaal vooraf (uren)</label>
              <input id="minUrenVooraf" name="minUrenVooraf" type="number" min={0} max={336} className="veld" defaultValue={b.minUrenVooraf} />
            </div>
            <div>
              <label className="veld-label" htmlFor="dagenVooruit">Dagen vooruit</label>
              <input id="dagenVooruit" name="dagenVooruit" type="number" min={1} max={120} className="veld" defaultValue={b.dagenVooruit} />
            </div>
            <div>
              <label className="veld-label" htmlFor="stapMin">Starttijden om de (min)</label>
              <input id="stapMin" name="stapMin" type="number" min={5} max={120} className="veld" defaultValue={b.stapMin} />
            </div>
            <div>
              <label className="veld-label" htmlFor="persoonId">In de agenda van</label>
              <select id="persoonId" name="persoonId" className="veld" defaultValue={b.persoonId ?? ''}>
                <option value="">Automatisch ({huidige?.naam ?? 'niemand'})</option>
                {personen.filter((p) => p.actief).map((p) => (
                  <option key={p.id} value={p.id}>{p.naam}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="panel p-4">
          <h2 className="font-display text-base font-bold text-ink-900">Soorten afspraken</h2>
          <div className="mt-3 space-y-3">
            {AFSPRAAK_SOORTEN.map((s) => (
              <div key={s} className="flex flex-wrap items-end gap-3 border-b border-line pb-3 last:border-b-0">
                <label className="flex min-w-[14rem] flex-1 items-center gap-2 text-sm font-semibold text-ink-900">
                  <input type="checkbox" name={`${s}_actief`} defaultChecked={b.soorten[s].actief} />
                  {SOORT_INFO[s].label}
                </label>
                <div>
                  <label className="veld-label" htmlFor={`${s}_duur`}>Duur (min)</label>
                  <input id={`${s}_duur`} name={`${s}_duur`} type="number" min={10} max={480} className="veld w-24" defaultValue={b.soorten[s].duurMin} />
                </div>
              </div>
            ))}
          </div>
          <p className="veld-hint mt-2">Een pasdag is een voorkeursmoment: Jessi stemt de precieze tijd daarna met de klant af. De duur blokkeert de agenda zolang.</p>

          <div className="mt-5">
            <label className="veld-label" htmlFor="geblokkeerd">Geblokkeerde dagen</label>
            <textarea id="geblokkeerd" name="geblokkeerd" rows={6} className="veld font-mono text-[12px]" defaultValue={blokkenTekst(b.geblokkeerd)} />
            <p className="veld-hint">Eén per regel: 2026-12-25, of een periode: 2026-12-24 t/m 2027-01-02 (vakantie, beurs, feestdagen).</p>
          </div>
        </section>

        <div className="lg:col-span-2">
          <button type="submit" className="knop-donker">Opslaan</button>
        </div>
      </form>
    </main>
  );
}
