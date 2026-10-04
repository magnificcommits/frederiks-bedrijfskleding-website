import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import Drawer from '@/components/dashboard/Drawer';
import VerzendKnop from '@/components/dashboard/VerzendKnop';
import { aanbrengingenVan, laadSpaarBundel } from '@/lib/kms/sparenGrootboek';
import { listKlantKeuzes } from '@/lib/kms/sparenData';
import { REGEL_SOORTEN, REGEL_SOORT_INFO, type RegelSoort, type SpaarRegel } from '@/lib/kms/sparenTypes';
import { registreerAanbrengingActie, slaRegelOpActie, verwijderRegelActie, vervalAanbrengingActie, zetRegelActiefActie } from '../actions';
import { JaNee, Meldingen, MigratieBanner, datumKort, euro0, getal } from '../_ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sparen: regels', robots: { index: false, follow: false } };

const PAD = '/dashboard/sparen/regels';

/** Korte samenvatting van wat een regel doet, in gewone taal. */
function samenvatting(r: SpaarRegel, euroPerPunt: number): string {
  switch (r.soort) {
    case 'per_euro': {
      const pct = r.factor * euroPerPunt * 100;
      return `${r.factor.toLocaleString('nl-NL')} ${r.factor === 1 ? 'punt' : 'punten'} per euro, dat is ${pct.toLocaleString('nl-NL', { maximumFractionDigits: 2 })}% terug`;
    }
    case 'drempel_bonus':
      return `${getal(r.punten)} punten extra bij een order vanaf ${euro0(r.drempelEuro ?? 0)}`;
    case 'eerste_order':
      return `${getal(r.punten)} punten extra op de eerste order`;
    case 'aanbrengen':
      return `${getal(r.punten)} punten voor wie een nieuwe klant aanbrengt`;
    case 'review':
      return `${getal(r.punten)} punten per review, ken je toe bij de klant`;
    case 'jubileum':
      return `${getal(r.punten)} punten per jaar klant`;
    case 'nabestellen':
      return `${getal(r.punten)} punten bij een nieuwe order binnen ${r.maanden ?? '?'} maanden`;
    case 'periode_actie':
      return `${r.factor.toLocaleString('nl-NL')}x punten${r.punten > 0 ? ` plus ${getal(r.punten)} per order` : ''} van ${datumKort(r.startDatum)} tot en met ${datumKort(r.eindDatum)}`;
  }
}

function RegelVelden({ soort, regel }: { soort: RegelSoort; regel?: SpaarRegel }) {
  const vandaag = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-4">
      <input type="hidden" name="soort" value={soort} />
      <input type="hidden" name="terug" value={PAD} />
      {regel && <input type="hidden" name="id" value={regel.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="veld-label">Naam</label>
          <input name="naam" required maxLength={120} defaultValue={regel?.naam ?? REGEL_SOORT_INFO[soort].label} className="veld" />
        </div>
        {soort === 'per_euro' && (
          <div>
            <label className="veld-label">Punten per euro</label>
            <input name="factor" type="number" step="0.01" min="0" required defaultValue={regel?.factor ?? 1} className="veld" />
            <p className="veld-hint">Bij 1 punt per euro en 1 cent per punt geef je 1% terug.</p>
          </div>
        )}
        {soort === 'periode_actie' && (
          <>
            <div>
              <label className="veld-label">Vermenigvuldiger</label>
              <input name="factor" type="number" step="0.1" min="1" required defaultValue={regel?.factor ?? 2} className="veld" />
              <p className="veld-hint">2 is dubbele punten, 3 is driedubbel.</p>
            </div>
            <div>
              <label className="veld-label">Plus vaste punten per order</label>
              <input name="punten" type="number" step="1" min="0" defaultValue={regel?.punten ?? 0} className="veld" />
            </div>
            <div>
              <label className="veld-label">Van</label>
              <input name="start_datum" type="date" required defaultValue={regel?.startDatum ?? vandaag} className="veld" />
            </div>
            <div>
              <label className="veld-label">Tot en met</label>
              <input name="eind_datum" type="date" required defaultValue={regel?.eindDatum ?? ''} className="veld" />
            </div>
          </>
        )}
        {!['per_euro', 'periode_actie'].includes(soort) && (
          <div>
            <label className="veld-label">Punten</label>
            <input name="punten" type="number" step="1" min="1" required defaultValue={regel?.punten ?? ''} className="veld" />
          </div>
        )}
        {soort === 'drempel_bonus' && (
          <div>
            <label className="veld-label">Vanaf orderbedrag (euro)</label>
            <input name="drempel_euro" type="number" step="1" min="1" required defaultValue={regel?.drempelEuro ?? 1000} className="veld" />
          </div>
        )}
        {soort === 'nabestellen' && (
          <div>
            <label className="veld-label">Binnen hoeveel maanden</label>
            <input name="maanden" type="number" step="1" min="1" max="36" required defaultValue={regel?.maanden ?? 6} className="veld" />
          </div>
        )}
        {REGEL_SOORT_INFO[soort].automatisch && soort !== 'periode_actie' && (
          <div>
            <label className="veld-label">Geldt vanaf</label>
            <input name="geldig_vanaf" type="date" defaultValue={regel ? regel.geldigVanaf ?? '' : soort === 'per_euro' ? '' : vandaag} className="veld" />
            <p className="veld-hint">Leeg is voor alle orders, ook oude. Een datum in het verleden kent punten met terugwerkende kracht toe.</p>
          </div>
        )}
        <JaNee naam="actief" label="Actief" waarde={regel?.actief ?? true} />
        <div className="sm:col-span-2">
          <label className="veld-label">Tekst voor de klant</label>
          <textarea name="omschrijving" rows={2} maxLength={300} defaultValue={regel?.omschrijving ?? ''} className="veld" placeholder="Zo zien klanten het in het portaal, onder Zo spaar je." />
        </div>
      </div>
      <VerzendKnop className="knop-donker">{regel ? 'Opslaan' : 'Regel toevoegen'}</VerzendKnop>
    </div>
  );
}

export default async function SparenRegels({ searchParams }: { searchParams: Promise<{ fout?: string; melding?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const { fout, melding } = await searchParams;
  const [b, klanten] = await Promise.all([laadSpaarBundel(), listKlantKeuzes()]);
  const regels = b.regels;
  const aanbrengingen = aanbrengingenVan(b);
  const aanbrengRegel = regels.find((r) => r.actief && r.soort === 'aanbrengen');
  const vandaag = new Date().toISOString().slice(0, 10);

  return (
    <div className="pt-5">
      <Meldingen fout={fout} melding={melding} />
      <MigratieBanner toon={!b.loyaliteit} />

      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-[13px] text-warm">
          Meerdere regels kunnen tegelijk actief zijn; ze tellen bij elkaar op. Een geboekte order blijft staan als je een regel later wijzigt. Alleen als het orderbedrag verandert, rekenen we opnieuw.
        </p>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {regels.map((r) => {
          const info = REGEL_SOORT_INFO[r.soort];
          const actieLoopt = r.soort === 'periode_actie' && r.startDatum && r.eindDatum && r.startDatum <= vandaag && r.eindDatum >= vandaag;
          return (
            <article key={r.id} className={`panel flex flex-col p-4 ${r.actief ? '' : 'bg-mist/50'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-warm">
                    {info.label}
                    {info.automatisch ? '' : ' · handmatig'}
                  </p>
                  <h3 className="mt-0.5 text-[15px] font-semibold text-ink-900">{r.naam}</h3>
                </div>
                <span className={r.actief ? (actieLoopt ? 'badge-actie' : 'badge-klaar') : 'badge-rust'}>
                  {r.actief ? (actieLoopt ? 'Loopt nu' : 'Actief') : 'Uit'}
                </span>
              </div>
              <p className="mt-2 text-[13px] text-ink-800">{samenvatting(r, b.instellingen.euroPerPunt)}</p>
              {r.geldigVanaf && r.soort !== 'periode_actie' && (
                <p className="mt-1 text-[12px] text-warm">Voor orders vanaf {datumKort(r.geldigVanaf)}</p>
              )}
              {r.omschrijving && <p className="mt-2 border-l-2 border-line pl-2 text-[12px] italic text-warm">{r.omschrijving}</p>}
              {b.loyaliteit && (
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                  <Drawer knop="Bewerken" titel={r.naam} beschrijving={info.uitleg} knopKlasse="knop-stil" breedte="sm:max-w-xl">
                    <form action={slaRegelOpActie}>
                      <RegelVelden soort={r.soort} regel={r} />
                    </form>
                  </Drawer>
                  <form action={zetRegelActiefActie}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="actief" value={r.actief ? 'nee' : 'ja'} />
                    <input type="hidden" name="terug" value={PAD} />
                    <VerzendKnop className={r.actief ? 'knop-tekst' : 'knop-primair'}>{r.actief ? 'Uitzetten' : 'Aanzetten'}</VerzendKnop>
                  </form>
                  {!r.systeem && (
                    <form action={verwijderRegelActie} className="ml-auto">
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="terug" value={PAD} />
                      <VerzendKnop className="knop-tekst text-red-700 hover:text-red-800">Verwijderen</VerzendKnop>
                    </form>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {b.loyaliteit && (
        <section className="mt-8">
          <h2 className="font-display text-base font-bold text-ink-900">Regel toevoegen</h2>
          <p className="mt-0.5 text-[12px] text-warm">Bijvoorbeeld een tweede actieperiode, of een hogere bonus voor heel grote orders.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {REGEL_SOORTEN.map((s) => (
              <div key={s} className="panel flex flex-col p-3">
                <p className="text-[13px] font-semibold text-ink-900">{REGEL_SOORT_INFO[s].label}</p>
                <p className="mt-0.5 flex-1 text-[12px] leading-snug text-warm">{REGEL_SOORT_INFO[s].uitleg}</p>
                <div className="mt-2">
                  <Drawer knop="Toevoegen" titel={`Nieuwe regel: ${REGEL_SOORT_INFO[s].label}`} beschrijving={REGEL_SOORT_INFO[s].uitleg} knopKlasse="knop-stil" breedte="sm:max-w-xl">
                    <form action={slaRegelOpActie}>
                      <RegelVelden soort={s} />
                    </form>
                  </Drawer>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8" aria-labelledby="aanbreng-kop">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="aanbreng-kop" className="font-display text-base font-bold text-ink-900">Aangebrachte klanten</h2>
            <p className="mt-0.5 text-[12px] text-warm">De punten gaan naar de klant die aanbracht, standaard zodra de nieuwe klant de eerste order plaatst.</p>
          </div>
          {b.loyaliteit && aanbrengRegel && (
            <Drawer knop="Aanbrenging vastleggen" titel="Een klant bracht een nieuwe klant aan" breedte="sm:max-w-lg">
              <form action={registreerAanbrengingActie} className="space-y-4">
                <input type="hidden" name="terug" value={PAD} />
                <div>
                  <label className="veld-label" htmlFor="aanbrenger">Aangebracht door</label>
                  <select id="aanbrenger" name="organisatie_id" required className="veld" defaultValue="">
                    <option value="" disabled>Kies de klant die aanbracht</option>
                    {klanten.map((k) => <option key={k.id} value={k.id}>{k.naam}</option>)}
                  </select>
                </div>
                <div>
                  <label className="veld-label" htmlFor="nieuw">Nieuwe klant</label>
                  <select id="nieuw" name="nieuwe_organisatie_id" className="veld" defaultValue="">
                    <option value="">Staat nog niet in het systeem</option>
                    {klanten.map((k) => <option key={k.id} value={k.id}>{k.naam}</option>)}
                  </select>
                </div>
                <div>
                  <label className="veld-label" htmlFor="nieuwe_naam">Of de naam</label>
                  <input id="nieuwe_naam" name="nieuwe_naam" className="veld" />
                </div>
                <div>
                  <label className="veld-label" htmlFor="moment">Wanneer punten geven</label>
                  <select id="moment" name="moment" className="veld" defaultValue="eerste_order">
                    <option value="eerste_order">Na de eerste order van de nieuwe klant</option>
                    <option value="direct">Direct</option>
                  </select>
                </div>
                <div>
                  <label className="veld-label" htmlFor="notitie">Notitie</label>
                  <input id="notitie" name="notitie" className="veld" />
                </div>
                <p className="text-[12px] text-warm">Levert {getal(aanbrengRegel.punten)} punten op.</p>
                <VerzendKnop className="knop-donker">Vastleggen</VerzendKnop>
              </form>
            </Drawer>
          )}
        </div>
        {aanbrengingen.length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed border-ink-200 bg-mist/60 px-4 py-4 text-[13px] text-warm">
            {aanbrengRegel ? 'Nog niets vastgelegd.' : 'Zet de regel "Klant aangebracht" aan om dit te gebruiken.'}
          </p>
        ) : (
          <div className="panel mt-3 overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Aangebracht door</th>
                  <th>Nieuwe klant</th>
                  <th className="num">Punten</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {aanbrengingen.map((a) => (
                  <tr key={a.id}>
                    <td className="stil whitespace-nowrap">{datumKort(a.created_at)}</td>
                    <td><Link href={`/dashboard/sparen/klanten/${a.organisatie_id}`} className="rij-link">{a.aanbrengerNaam}</Link></td>
                    <td>{a.nieuweNaamWeergave}</td>
                    <td className="num">{getal(a.punten)}</td>
                    <td>
                      <span className={a.status === 'beloond' ? 'badge-klaar' : a.status === 'wacht' ? 'badge-actie' : 'badge-rust'}>
                        {a.status === 'beloond' ? `Beloond ${datumKort(a.beloond_op)}` : a.status === 'wacht' ? 'Wacht op eerste order' : 'Vervallen'}
                      </span>
                    </td>
                    <td className="text-right">
                      {a.status === 'wacht' && (
                        <form action={vervalAanbrengingActie}>
                          <input type="hidden" name="id" value={a.id} />
                          <input type="hidden" name="terug" value={PAD} />
                          <VerzendKnop className="knop-tekst">Laten vervallen</VerzendKnop>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
