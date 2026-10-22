import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { dashAuthed, magEigenaar } from '@/lib/kms/adminClient';
import { leesCentralePrijslijst } from '@/lib/kms/prijslijstBeheer';
import { formatEuro } from '@/lib/format';
import StaffelForm from '@/components/dashboard/StaffelForm';
import ConfirmSubmit from '@/components/ConfirmSubmit';
import {
  verwijderFormaatActie,
  verwijderKostenActie,
  voegFormaatActie,
  voegKostenActie,
  werkFormaatActie,
  werkKostenActie,
  zetStaffelActie,
} from './actions';

export const metadata: Metadata = { title: 'Prijslijst personalisatie', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const MELDING: Record<string, string> = {
  staffel: 'Staffel opgeslagen.',
  formaat: 'Formaat opgeslagen.',
  nieuw: 'Toegevoegd.',
  weg: 'Verwijderd.',
  kosten: 'Kosten opgeslagen.',
};

/**
 * De centrale prijslijst voor bedrukken, borduren en andere technieken (mail Jessi
 * 21 okt 2026). Afwijkende prijzen per klant staan bij de klant onder Inrichting.
 */
export default async function PersonalisatiePrijzen({ searchParams }: { searchParams: Promise<{ ok?: string; fout?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  if (!(await magEigenaar())) redirect('/dashboard/instellingen');
  const sp = await searchParams;
  const { tarieven, formaten, kosten } = await leesCentralePrijslijst();
  const technieken = [...new Set([...formaten.map((f) => f.techniek), ...tarieven.map((t) => t.techniek)])].sort();
  const inp = 'rounded border border-line px-2 py-1 text-sm';

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="dash-h1">Prijslijst personalisatie</h1>
          <p className="dash-sub">Bedrukken, borduren en andere technieken. Hieruit rekent het systeem de kosten op offertes, orders en facturen.</p>
        </div>
        <Link href="/dashboard/instellingen" className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar instellingen</Link>
      </div>

      {sp.ok && MELDING[sp.ok] && <p className="mt-4 rounded-md bg-green-50 px-4 py-3 text-sm font-medium text-green-800" role="status">{MELDING[sp.ok]}</p>}
      {sp.fout && <p className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm font-medium text-ink-800" role="alert">Opslaan is niet gelukt. Controleer de invoer.</p>}

      <section className="panel mt-6 p-4 text-sm text-ink-800">
        <p className="font-semibold text-ink-900">Zo rekent het systeem</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-warm">
          <li>Per logoplek op de goedgekeurde drukproef: de prijs per stuk van de techniek en het formaat. Borst en rug zijn twee plekken, dus twee prijzen.</li>
          <li>De staffel telt over de hele order: alle kledingstukken met hetzelfde logo op dezelfde plek in hetzelfde formaat tellen samen, of het nu een trui of een overhemd is.</li>
          <li>Het formaat kies je bij de drukproef per logo (Prijscategorie). Laat je het leeg, dan bepaalt het systeem het uit de plek en de breedte.</li>
          <li>Heeft een klant eigen prijzen (klant, Inrichting), dan gelden die voor die klant.</li>
          <li>Kosten per order (zoals instelkosten) komen er één keer per gebruikte techniek bij.</li>
        </ul>
      </section>

      {technieken.map((tech) => {
        const fmt = formaten.filter((f) => f.techniek === tech);
        return (
          <section key={tech} id={tech} className="mt-8 scroll-mt-20">
            <h2 className="font-display text-xl font-bold capitalize text-ink-900">{tech}</h2>
            <div className="panel mt-3 divide-y divide-line">
              {fmt.map((f) => {
                const staffel = tarieven.filter((t) => t.techniek === tech && t.formaat === f.formaat).sort((a, b) => a.vanaf_aantal - b.vanaf_aantal);
                return (
                  <div key={f.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-start">
                    <div className="w-full shrink-0 lg:w-72">
                      <p className="font-semibold text-ink-900">Formaat {f.formaat}</p>
                      <form action={werkFormaatActie} className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <input type="hidden" name="id" value={f.id} />
                        <input name="omschrijving" defaultValue={f.omschrijving ?? ''} placeholder="Omschrijving" aria-label="Omschrijving" className={`${inp} w-40`} />
                        <input name="max" defaultValue={f.max_oppervlakte_cm2 ?? ''} placeholder="max cm²" aria-label="Maximaal cm²" inputMode="numeric" className={`${inp} w-20`} />
                        <button type="submit" className="text-xs font-semibold text-amber-700 hover:text-amber-800">Opslaan</button>
                      </form>
                      <form action={verwijderFormaatActie} className="mt-1">
                        <input type="hidden" name="id" value={f.id} />
                        <ConfirmSubmit message={`Formaat ${f.formaat} met zijn staffel verwijderen?`} className="text-xs text-red-700 hover:underline">Formaat verwijderen</ConfirmSubmit>
                      </form>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="mb-1.5 text-xs text-warm">
                        Staffel per stuk{staffel.length ? `: ${staffel.map((s) => `${s.vanaf_aantal}+ ${formatEuro(s.stukprijs)}`).join(' · ')}` : ': nog geen prijs'}
                      </p>
                      <StaffelForm action={zetStaffelActie} verborgen={{ techniek: tech, formaat: f.formaat }} staffel={staffel} knop="Staffel opslaan" />
                    </div>
                  </div>
                );
              })}
              {fmt.length === 0 && <p className="p-4 text-sm text-warm">Nog geen formaten.</p>}
            </div>
          </section>
        );
      })}

      <section className="mt-8">
        <h2 className="font-display text-lg font-bold text-ink-900">Formaat of techniek toevoegen</h2>
        <form action={voegFormaatActie} className="panel mt-3 flex flex-wrap items-end gap-2 p-4">
          <label className="text-xs text-warm">Techniek
            <input name="techniek" list="technieken" required placeholder="bijv. borduren of transfer" className={`${inp} mt-1 block w-44`} />
          </label>
          <datalist id="technieken">{technieken.map((t) => <option key={t} value={t} />)}</datalist>
          <label className="text-xs text-warm">Formaat
            <input name="formaat" required placeholder="bijv. XXL" className={`${inp} mt-1 block w-24`} />
          </label>
          <label className="text-xs text-warm">Omschrijving
            <input name="omschrijving" placeholder="bijv. tot 1200 cm²" className={`${inp} mt-1 block w-44`} />
          </label>
          <label className="text-xs text-warm">Max cm² (optioneel)
            <input name="max" inputMode="numeric" className={`${inp} mt-1 block w-24`} />
          </label>
          <label className="text-xs text-warm">Prijs per stuk vanaf 1
            <input name="prijs" inputMode="decimal" className={`${inp} mt-1 block w-24`} />
          </label>
          <button type="submit" className="knop-donker">Toevoegen</button>
        </form>
        <p className="mt-1 text-xs text-warm">Max cm² gebruikt het systeem om het formaat zelf te kiezen als het bij de drukproef leeg is. Zonder cm² kiest het bij een rugplek het grootste formaat en anders het kleinste.</p>
      </section>

      <section id="kosten" className="mt-8 scroll-mt-20">
        <h2 className="font-display text-lg font-bold text-ink-900">Vaste kosten</h2>
        <p className="mt-1 text-sm text-warm">Kosten per order gaan automatisch mee (één keer per gebruikte techniek). Kosten per logo of per doos staan hier als naslag; die zet je zelf op de order.</p>
        <div className="panel mt-3 divide-y divide-line">
          {kosten.map((k) => (
            <div key={k.id} className="flex flex-wrap items-center gap-2 p-3">
              <span className="w-24 text-sm font-semibold capitalize text-ink-900">{k.techniek}</span>
              <form action={werkKostenActie} className="flex flex-1 flex-wrap items-center gap-1.5">
                <input type="hidden" name="id" value={k.id} />
                <input name="omschrijving" defaultValue={k.omschrijving ?? k.soort} aria-label="Omschrijving" className={`${inp} min-w-[14rem] flex-1`} />
                <span className="text-xs text-warm">€</span>
                <input name="bedrag" defaultValue={String(k.bedrag).replace('.', ',')} inputMode="decimal" aria-label="Bedrag" className={`${inp} w-20 text-right`} />
                <select name="eenheid" defaultValue={k.eenheid ?? 'order'} aria-label="Per" className={inp}>
                  <option value="order">per order</option>
                  <option value="logo">per logo</option>
                  <option value="doos">per doos</option>
                </select>
                <button type="submit" className="text-xs font-semibold text-amber-700 hover:text-amber-800">Opslaan</button>
              </form>
              <form action={verwijderKostenActie}>
                <input type="hidden" name="id" value={k.id} />
                <ConfirmSubmit message="Deze kostenregel verwijderen?" className="text-xs text-red-700 hover:underline">Verwijderen</ConfirmSubmit>
              </form>
            </div>
          ))}
          <form action={voegKostenActie} className="flex flex-wrap items-center gap-1.5 p-3">
            <input name="techniek" list="technieken" required placeholder="techniek" aria-label="Techniek" className={`${inp} w-28`} />
            <input name="omschrijving" required placeholder="bijv. Instelkosten per order" aria-label="Omschrijving" className={`${inp} min-w-[14rem] flex-1`} />
            <input name="bedrag" required inputMode="decimal" placeholder="€" aria-label="Bedrag" className={`${inp} w-20 text-right`} />
            <select name="eenheid" defaultValue="order" aria-label="Per" className={inp}>
              <option value="order">per order</option>
              <option value="logo">per logo</option>
              <option value="doos">per doos</option>
            </select>
            <button type="submit" className="knop-stil">Kosten toevoegen</button>
          </form>
        </div>
      </section>
    </main>
  );
}
