import { redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import Drawer from '@/components/dashboard/Drawer';
import VerzendKnop from '@/components/dashboard/VerzendKnop';
import { getSpaarInstellingenUitgebreid, listBeloningen, listNiveaus, loyaliteitActief } from '@/lib/kms/sparenData';
import { BELONING_SOORTEN, BELONING_SOORT_LABEL, type SpaarBeloning, type SpaarNiveau } from '@/lib/kms/sparenTypes';
import { slaBeloningOpActie, verwijderBeloningActie } from '../actions';
import { JaNee, Meldingen, MigratieBanner, NiveauBadge, euro2, getal } from '../_ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sparen: beloningen', robots: { index: false, follow: false } };

const PAD = '/dashboard/sparen/beloningen';

const SOORT_TEKEN: Record<string, string> = {
  korting_euro: '€',
  gratis_artikel: 'A',
  gratis_logo: 'L',
  cadeaubon: 'C',
  goed_doel: 'G',
  anders: '+',
};

function BeloningVelden({ x, niveaus }: { x?: SpaarBeloning; niveaus: SpaarNiveau[] }) {
  return (
    <div className="space-y-4">
      <input type="hidden" name="terug" value={PAD} />
      {x && <input type="hidden" name="id" value={x.id} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="veld-label">Naam</label>
          <input name="naam" required maxLength={120} defaultValue={x?.naam ?? ''} className="veld" placeholder="Bijv. Gratis softshell met logo" />
        </div>
        <div>
          <label className="veld-label">Soort</label>
          <select name="soort" defaultValue={x?.soort ?? 'korting_euro'} className="veld">
            {BELONING_SOORTEN.map((s) => (
              <option key={s} value={s}>{BELONING_SOORT_LABEL[s]}</option>
            ))}
          </select>
          <p className="veld-hint">Korting in euro komt na goedkeuring op een open conceptfactuur. Voor de rest maken we een taak.</p>
        </div>
        <div>
          <label className="veld-label">Kost (punten)</label>
          <input name="punten_prijs" type="number" min="1" step="1" required defaultValue={x?.puntenPrijs ?? ''} className="veld" />
        </div>
        <div>
          <label className="veld-label">Waarde voor jou (euro, excl. btw)</label>
          <input name="waarde_euro" type="number" min="0" step="0.01" defaultValue={x?.waardeEuro ?? ''} className="veld" />
          <p className="veld-hint">Telt mee in wat het programma kost en is het kortingsbedrag op de factuur.</p>
        </div>
        <div>
          <label className="veld-label">Vanaf niveau</label>
          <select name="min_niveau_id" defaultValue={x?.minNiveauId ?? ''} className="veld">
            <option value="">Iedereen</option>
            {niveaus.map((n) => (
              <option key={n.id} value={n.id}>{n.naam}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="veld-label">Voorraad</label>
          <input name="voorraad" type="number" min="0" step="1" defaultValue={x?.voorraad ?? ''} className="veld" placeholder="Leeg is onbeperkt" />
        </div>
        <JaNee naam="actief" label="Beschikbaar" waarde={x?.actief ?? true} />
        <JaNee naam="in_portaal" label="Zelf aan te vragen in portaal" waarde={x?.inPortaal ?? true} />
        <div className="sm:col-span-2">
          <label className="veld-label">Omschrijving voor de klant</label>
          <textarea name="omschrijving" rows={2} maxLength={300} defaultValue={x?.omschrijving ?? ''} className="veld" />
        </div>
      </div>
      <VerzendKnop className="knop-donker">{x ? 'Opslaan' : 'Beloning toevoegen'}</VerzendKnop>
    </div>
  );
}

export default async function SparenBeloningen({ searchParams }: { searchParams: Promise<{ fout?: string; melding?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const { fout, melding } = await searchParams;
  const [{ beloningen }, { niveaus }, inst, loyaliteit] = await Promise.all([
    listBeloningen(),
    listNiveaus(),
    getSpaarInstellingenUitgebreid(),
    loyaliteitActief(),
  ]);
  const niveauOp = new Map(niveaus.map((n) => [n.id, n]));

  return (
    <div className="pt-5">
      <Meldingen fout={fout} melding={melding} />
      <MigratieBanner toon={!loyaliteit} />

      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-[13px] text-warm">
          Standaard is 1 punt {euro2(inst.euroPerPunt)} waard. Geef je een beloning meer waarde per punt, dan wordt hij aantrekkelijker. Een gratis logo kost jou minder dan
          wat de klant ervoor zou betalen, dus dat is vaak een goede deal voor beide.
        </p>
        {loyaliteit && (
          <Drawer knop="Beloning toevoegen" titel="Nieuwe beloning" breedte="sm:max-w-xl">
            <form action={slaBeloningOpActie}>
              <BeloningVelden niveaus={niveaus} />
            </form>
          </Drawer>
        )}
      </div>

      {beloningen.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-ink-200 bg-mist/60 px-4 py-6 text-[13px] text-warm">
          {loyaliteit ? 'Nog geen beloningen. Begin met twee kortingen en een gratis logo.' : 'Beloningen zijn er na de migratie. Inwisselen voor korting kan wel al.'}
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {beloningen.map((x) => {
            const perPunt = x.puntenPrijs > 0 ? x.waardeEuro / x.puntenPrijs : 0;
            const verhouding = inst.euroPerPunt > 0 ? perPunt / inst.euroPerPunt : 1;
            const min = x.minNiveauId ? niveauOp.get(x.minNiveauId) ?? null : null;
            return (
              <li key={x.id} className={`panel flex flex-col p-4 ${x.actief ? '' : 'bg-mist/50 opacity-80'}`}>
                <div className="flex items-start gap-3">
                  <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ink-900 font-display text-sm font-bold text-amber-400">
                    {SOORT_TEKEN[x.soort]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-warm">{BELONING_SOORT_LABEL[x.soort]}</p>
                    <h3 className="text-[15px] font-semibold leading-tight text-ink-900">{x.naam}</h3>
                  </div>
                </div>
                {x.omschrijving && <p className="mt-2 text-[13px] text-ink-700">{x.omschrijving}</p>}
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-display text-xl font-bold tabular-nums text-ink-900">{getal(x.puntenPrijs)}</span>
                  <span className="text-[12px] text-warm">punten · waarde {euro2(x.waardeEuro)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {!x.actief && <span className="badge-rust">Niet beschikbaar</span>}
                  {x.actief && !x.inPortaal && <span className="badge-rust">Alleen via jou</span>}
                  {min && <NiveauBadge niveau={min} klein />}
                  {x.voorraad != null && <span className={x.voorraad > 0 ? 'badge-rust' : 'badge bg-red-50 text-red-700'}>{x.voorraad > 0 ? `nog ${x.voorraad}` : 'op'}</span>}
                  {x.waardeEuro > 0 && Math.abs(verhouding - 1) > 0.05 && (
                    <span className={verhouding > 1 ? 'badge-actie' : 'badge-rust'}>
                      {verhouding > 1 ? `${Math.round((verhouding - 1) * 100)}% gunstiger dan korting` : `${Math.round((1 - verhouding) * 100)}% minder waard dan korting`}
                    </span>
                  )}
                </div>
                {loyaliteit && (
                  <div className="mt-auto flex items-center gap-2 border-t border-line pt-3">
                    <Drawer knop="Bewerken" titel={x.naam} knopKlasse="knop-stil" breedte="sm:max-w-xl">
                      <form action={slaBeloningOpActie}>
                        <BeloningVelden x={x} niveaus={niveaus} />
                      </form>
                    </Drawer>
                    <form action={verwijderBeloningActie} className="ml-auto">
                      <input type="hidden" name="id" value={x.id} />
                      <input type="hidden" name="terug" value={PAD} />
                      <VerzendKnop className="knop-tekst text-red-700 hover:text-red-800">Verwijderen</VerzendKnop>
                    </form>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
