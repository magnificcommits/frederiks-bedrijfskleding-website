import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar, kmsAdmin } from '@/lib/kms/adminClient';
import VerzendKnop from '@/components/dashboard/VerzendKnop';
import {
  getKlachtInstellingen,
  getReparatieInstellingen,
  getRetourbeleid,
  listKlantKeuzesService,
  voorwaardenTekst,
  STANDAARD_KLACHTCATEGORIEEN,
  STANDAARD_REPARATIETEKST,
  STANDAARD_RETOURREDENEN,
} from '@/lib/kms/service';
import KlantZoeker from '../../klachten/KlantZoeker';
import { zetKlachtInstellingenActie, zetKlantTermijnActie, zetReparatieInstellingenActie, zetRetourbeleidActie, zetRetourredenenActie } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Instellingen: service', robots: { index: false, follow: false } };

const MELDINGEN: Record<string, { tekst: string; fout?: boolean }> = {
  beleid: { tekst: 'Retourbeleid opgeslagen. Het portaal toont meteen de nieuwe termijn en voorwaarden.' },
  redenen: { tekst: 'Retourredenen opgeslagen.' },
  klant: { tekst: 'Termijn voor de klant opgeslagen.' },
  klachten: { tekst: 'Klachtinstellingen opgeslagen.' },
  reparaties: { tekst: 'Reparatie-instellingen opgeslagen. Het portaal toont het meteen.' },
  'klant-nodig': { tekst: 'Kies eerst een klant.', fout: true },
  mislukt: { tekst: 'Opslaan is niet gelukt. Probeer het opnieuw.', fout: true },
};

export default async function ServiceInstellingenPage({ searchParams }: { searchParams: Promise<{ melding?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const { melding } = await searchParams;

  const sb = kmsAdmin();
  const [beleid, klacht, klanten, uitRes, reparatie] = await Promise.all([
    getRetourbeleid(),
    getKlachtInstellingen(),
    listKlantKeuzesService(),
    sb ? sb.from('organisaties').select('id, naam').eq('retouren_actief', false).order('naam') : Promise.resolve({ data: [] }),
    getReparatieInstellingen(),
  ]);
  const retourenUit = ((uitRes as { data: { id: string; naam: string }[] | null }).data ?? []);
  const naamVan = new Map(klanten.map((k) => [k.id, k.naam]));
  const perKlant = Object.entries(beleid.termijnPerKlant)
    .map(([id, dagen]) => ({ id, dagen, naam: naamVan.get(id) ?? 'Onbekende klant' }))
    .sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
  const m = melding ? MELDINGEN[melding] : null;
  const voorbeeld = voorwaardenTekst(beleid.voorwaarden);

  return (
    <main className="container-smal py-6">
      <div className="dash-kop flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/instellingen" className="knop-tekst" aria-label="Terug naar instellingen">‹ Instellingen</Link>
          <h1 className="dash-h1">Service: retouren, reparaties en klachten</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/retouren" className="knop-stil">Naar Retouren</Link>
          <Link href="/dashboard/klachten" className="knop-stil">Naar Klachten</Link>
        </div>
      </div>

      <p className="mt-3 max-w-3xl text-[13px] text-warm">
        Wat hier staat, gebruiken het klantportaal, de retourafhandeling in het dashboard en de mails aan klanten.
        Eén plek, zodat de termijn en de voorwaarden overal hetzelfde zijn.
      </p>

      {m && (
        <p className={`mt-4 rounded-md border px-4 py-2.5 text-[13px] font-semibold ${m.fout ? 'border-amber-300 bg-amber-50 text-ink-800' : 'border-green-200 bg-green-50 text-green-800'}`} role="status">
          {m.tekst}
        </p>
      )}

      {/* ---------------- Retourbeleid ---------------- */}
      <section id="retourbeleid" className="panel mt-6 scroll-mt-24 p-5">
        <h2 className="font-display text-lg font-bold text-ink-900">Retourbeleid</h2>
        <p className="mt-1 text-[13px] text-warm">Standaard voor alle klanten. Een afwijkende termijn per klant stel je verderop in.</p>
        <form action={zetRetourbeleidActie} className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label htmlFor="sv-dagen" className="veld-label">Retourtermijn</label>
              <div className="flex items-center gap-2">
                <input id="sv-dagen" name="dagen" type="number" min={1} max={730} defaultValue={beleid.termijnDagen} className="veld w-24" />
                <span className="text-[13px] text-warm">dagen na de besteldatum</span>
              </div>
            </div>
            <fieldset>
              <legend className="veld-label">Voorwaarden</legend>
              <div className="space-y-1.5 text-[13px] text-ink-800">
                <label className="flex items-start gap-2"><input type="checkbox" name="ongedragen" defaultChecked={beleid.voorwaarden.ongedragen} className="mt-0.5" /> Ongedragen en ongewassen</label>
                <label className="flex items-start gap-2"><input type="checkbox" name="metLabels" defaultChecked={beleid.voorwaarden.metLabels} className="mt-0.5" /> Met de originele labels er nog aan</label>
                <label className="flex items-start gap-2"><input type="checkbox" name="geenBedrukt" defaultChecked={beleid.voorwaarden.geenBedrukt} className="mt-0.5" /> Geen bedrukte of geborduurde artikelen, behalve bij een fout van Frederiks</label>
              </div>
              <label htmlFor="sv-extra" className="veld-label mt-3">Extra voorwaarden (één per regel)</label>
              <textarea id="sv-extra" name="extra" rows={2} defaultValue={beleid.voorwaarden.extra} className="veld" placeholder="Bijvoorbeeld: veiligheidsschoenen alleen ongedragen in de originele doos" />
            </fieldset>
          </div>
          <div className="space-y-4">
            <div>
              <label htmlFor="sv-adres" className="veld-label">Retouradres</label>
              <input id="sv-adres" name="retouradres" defaultValue={beleid.retouradres} className="veld" />
            </div>
            <div>
              <label htmlFor="sv-instr" className="veld-label">Standaardinstructie</label>
              <textarea id="sv-instr" name="instructie" rows={3} defaultValue={beleid.instructie} className="veld" />
              <p className="veld-hint">Staat al ingevuld bij elke beslissing over een retour; per retour pas je hem aan als dat nodig is.</p>
            </div>
            <div className="rounded-md bg-mist px-3 py-2 text-[12px] text-ink-700">
              <p className="font-semibold text-ink-900">Zo ziet de klant het in het portaal</p>
              <p className="mt-1">Je kunt tot {beleid.termijnDagen} dagen na de besteldatum retourneren.</p>
              {voorbeeld.map((v) => <p key={v}>- {v}</p>)}
            </div>
          </div>
          <div className="md:col-span-2">
            <VerzendKnop className="knop-donker" bezigTekst="Opslaan…">Retourbeleid opslaan</VerzendKnop>
          </div>
        </form>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ---------------- Redenen ---------------- */}
        <section id="redenen" className="panel scroll-mt-24 p-5">
          <h2 className="font-display text-lg font-bold text-ink-900">Retourredenen</h2>
          <p className="mt-1 text-[13px] text-warm">
            De vaste keuzelijst in het portaal. Met een vaste lijst kun je per artikel, merk en maat zien waarom er iets terugkomt.
            Houd &ldquo;Maat te klein&rdquo; en &ldquo;Maat te groot&rdquo; erin: daar komt het maatadvies uit.
          </p>
          <form action={zetRetourredenenActie} className="mt-4 space-y-3">
            <label htmlFor="sv-redenen" className="veld-label">Eén reden per regel</label>
            <textarea id="sv-redenen" name="redenen" rows={9} defaultValue={beleid.redenen.join('\n')} className="veld font-mono text-[12px]" />
            <p className="veld-hint">Standaard: {STANDAARD_RETOURREDENEN.join(', ')}.</p>
            <VerzendKnop className="knop-donker" bezigTekst="Opslaan…">Redenen opslaan</VerzendKnop>
          </form>
        </section>

        {/* ---------------- Per klant ---------------- */}
        <section id="per-klant" className="panel scroll-mt-24 p-5">
          <h2 className="font-display text-lg font-bold text-ink-900">Afwijkende termijn per klant</h2>
          <p className="mt-1 text-[13px] text-warm">Bijvoorbeeld een langere termijn voor een vaste klant met een raamcontract.</p>
          {perKlant.length > 0 ? (
            <table className="tbl mt-3">
              <thead><tr><th>Klant</th><th className="num">Dagen</th><th /></tr></thead>
              <tbody>
                {perKlant.map((k) => (
                  <tr key={k.id}>
                    <td><Link href={`/dashboard/klanten/${k.id}`} className="rij-link">{k.naam}</Link></td>
                    <td className="num">
                      <form action={zetKlantTermijnActie} className="inline-flex items-center justify-end gap-1">
                        <input type="hidden" name="organisatie_id" value={k.id} />
                        <input name="dagen" type="number" min={1} max={730} defaultValue={k.dagen} aria-label={`Termijn voor ${k.naam}`} className="veld w-20 py-1 text-right" />
                        <button type="submit" className="knop-tekst text-[12px]">Opslaan</button>
                      </form>
                    </td>
                    <td className="text-right">
                      <form action={zetKlantTermijnActie}>
                        <input type="hidden" name="organisatie_id" value={k.id} />
                        <input type="hidden" name="dagen" value="" />
                        <button type="submit" className="knop-tekst text-[12px]">Standaard</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-3 text-[13px] text-warm">Alle klanten hebben de standaardtermijn van {beleid.termijnDagen} dagen.</p>
          )}
          <form action={zetKlantTermijnActie} className="mt-4 grid grid-cols-1 gap-3 border-t border-line pt-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <KlantZoeker klanten={klanten} label="Klant toevoegen" />
            <div>
              <label htmlFor="sv-kdagen" className="veld-label">Dagen</label>
              <input id="sv-kdagen" name="dagen" type="number" min={1} max={730} required defaultValue={beleid.termijnDagen * 2} className="veld w-24" />
            </div>
            <VerzendKnop className="knop-stil" bezigTekst="Opslaan…">Toevoegen</VerzendKnop>
          </form>

          <div className="mt-5 border-t border-line pt-4">
            <h3 className="veld-label">Retouren via het portaal uitgezet</h3>
            {retourenUit.length ? (
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {retourenUit.map((k) => (
                  <li key={k.id}><Link href={`/dashboard/klanten/${k.id}`} className="chip">{k.naam}</Link></li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[13px] text-warm">Bij alle klanten staan retouren via het portaal aan.</p>
            )}
            <p className="veld-hint">Aan- en uitzetten doe je op de klantpagina.</p>
          </div>
        </section>
      </div>

      {/* ---------------- Reparaties ---------------- */}
      <section id="reparaties" className="panel mt-6 scroll-mt-24 p-5">
        <h2 className="font-display text-lg font-bold text-ink-900">Reparaties</h2>
        <p className="mt-1 text-[13px] text-warm">
          Klanten kunnen in het portaal naast terugsturen en ruilen ook een reparatie aanmelden: wat er kapot is, een toelichting en foto&apos;s.
          Er wordt niets terugbetaald; de reparatie loopt van aangemeld tot terug bij de klant.
        </p>
        <form action={zetReparatieInstellingenActie} className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <label className="flex items-start gap-2 text-[13px] text-ink-800">
              <input type="checkbox" name="aan" defaultChecked={reparatie.aan} className="mt-0.5" />
              <span>
                <span className="font-semibold text-ink-900">Reparaties aanbieden</span>
                <span className="block text-warm">Uit: klanten zien de keuze Repareren niet in het portaal. Zelf aanmelden in het dashboard kan altijd.</span>
              </span>
            </label>
            <div>
              <label htmlFor="sv-repkosten" className="veld-label">Standaard reparatiekosten</label>
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-warm">€</span>
                <input
                  id="sv-repkosten"
                  name="kosten"
                  inputMode="decimal"
                  defaultValue={reparatie.kosten != null ? String(reparatie.kosten).replace('.', ',') : ''}
                  placeholder="leeg = per keer bepalen"
                  className="veld w-40"
                />
                <span className="text-[13px] text-warm">excl. btw, per aanmelding</span>
              </div>
              <p className="veld-hint">Komt vooraf ingevuld op elke reparatie; per reparatie pas je het aan of zet je er een factuur van klaar.</p>
            </div>
          </div>
          <div>
            <label htmlFor="sv-reptekst" className="veld-label">Tekst voor klanten</label>
            <textarea id="sv-reptekst" name="tekst" rows={4} defaultValue={reparatie.tekst} className="veld" />
            <p className="veld-hint">Staat boven het reparatieformulier in het portaal. Leeg laten geeft de standaardtekst: &ldquo;{STANDAARD_REPARATIETEKST}&rdquo;</p>
          </div>
          <div className="md:col-span-2">
            <VerzendKnop className="knop-donker" bezigTekst="Opslaan…">Reparaties opslaan</VerzendKnop>
          </div>
        </form>
      </section>

      {/* ---------------- Klachten ---------------- */}
      <section id="klachten" className="panel mt-6 scroll-mt-24 p-5">
        <h2 className="font-display text-lg font-bold text-ink-900">Klachten en vragen</h2>
        <p className="mt-1 text-[13px] text-warm">Categorieën om tickets in te delen (ook kiesbaar in het portaal) en de streeftijd voor de eerste reactie per prioriteit.</p>
        <form action={zetKlachtInstellingenActie} className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label htmlFor="sv-cat" className="veld-label">Categorieën (één per regel)</label>
            <textarea id="sv-cat" name="categorieen" rows={7} defaultValue={klacht.categorieen.join('\n')} className="veld font-mono text-[12px]" />
            <p className="veld-hint">Standaard: {STANDAARD_KLACHTCATEGORIEEN.join(', ')}. Hernoem je een categorie, dan houden oude tickets de oude naam.</p>
          </div>
          <div>
            <span className="veld-label">Streefreactietijd (uren)</span>
            <div className="grid grid-cols-3 gap-3">
              {(['hoog', 'normaal', 'laag'] as const).map((p) => (
                <div key={p}>
                  <label htmlFor={`sv-sla-${p}`} className="text-[12px] font-semibold capitalize text-ink-800">{p}</label>
                  <input id={`sv-sla-${p}`} name={`sla_${p}`} type="number" min={1} max={720} step="0.5" defaultValue={klacht.sla[p]} className="veld mt-1" />
                </div>
              ))}
            </div>
            <p className="veld-hint">
              Kalenderuren vanaf binnenkomst, dus avond en weekend tellen mee. Komt er voor die tijd geen eerste antwoord aan de klant,
              dan krijgt het ticket de markering &ldquo;Te laat&rdquo;. Een nieuwe tijd geldt voor nieuwe tickets en bij een andere prioriteit.
            </p>
          </div>
          <div className="md:col-span-2">
            <VerzendKnop className="knop-donker" bezigTekst="Opslaan…">Klachtinstellingen opslaan</VerzendKnop>
          </div>
        </form>
      </section>
    </main>
  );
}
