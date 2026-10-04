import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import Drawer from '@/components/dashboard/Drawer';
import VerzendKnop from '@/components/dashboard/VerzendKnop';
import StatusChips from '@/components/dashboard/StatusChips';
import EmptyState from '@/components/dashboard/EmptyState';
import { berekenStanden, inwisselingenVan, laadEnSynchroniseer } from '@/lib/kms/sparenGrootboek';
import { listBeloningen } from '@/lib/kms/sparenData';
import { INWISSEL_STATUSSEN } from '@/lib/kms/sparenTypes';
import { nieuweInwisselingActie, zetInwisselStatusActie } from '../actions';
import { Meldingen, MigratieBanner, StatusBadge, datumKort, euro2, getal } from '../_ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sparen: inwisselingen', robots: { index: false, follow: false } };

const PAD = '/dashboard/sparen/inwisselingen';

export default async function SparenInwisselingen({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; fout?: string; melding?: string }>;
}) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const { status = '', fout, melding } = await searchParams;
  const [b, { beloningen }] = await Promise.all([laadEnSynchroniseer(), listBeloningen()]);
  const alle = inwisselingenVan(b);
  const aantallen: Record<string, number> = {};
  alle.forEach((r) => (aantallen[r.status] = (aantallen[r.status] ?? 0) + 1));
  const rijen = status ? alle.filter((r) => r.status === status) : alle;
  // Aanvragen eerst, daarna de rest op datum.
  rijen.sort((a, c) => Number(c.status === 'aangevraagd') - Number(a.status === 'aangevraagd') || c.createdAt.localeCompare(a.createdAt));
  const standen = berekenStanden(b).filter((s) => s.saldo > 0).sort((a, c) => a.naam.localeCompare(c.naam, 'nl'));
  const actieveBeloningen = beloningen.filter((x) => x.actief);

  return (
    <div className="pt-5">
      <Meldingen fout={fout} melding={melding} />
      <MigratieBanner toon={!b.loyaliteit} />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div className="[&_.dash-filter]:static [&_.dash-filter]:mx-0 [&_.dash-filter]:min-h-0 [&_.dash-filter]:border-0 [&_.dash-filter]:px-0 [&_.dash-filter]:py-0">
          <StatusChips basePath={PAD} huidig={status} statussen={INWISSEL_STATUSSEN} aantallen={aantallen} />
        </div>
        <Drawer knop="Nieuwe inwisseling" titel="Punten inwisselen voor een klant" beschrijving="Wordt meteen goedgekeurd. Alleen klanten met punten staan in de lijst." breedte="sm:max-w-lg">
          <form action={nieuweInwisselingActie} className="space-y-4">
            <input type="hidden" name="terug" value={PAD} />
            <div>
              <label className="veld-label" htmlFor="org">Klant</label>
              <select id="org" name="organisatie_id" required className="veld" defaultValue="">
                <option value="" disabled>Kies een klant</option>
                {standen.map((s) => (
                  <option key={s.organisatieId} value={s.organisatieId}>{s.naam} ({getal(s.saldo)} punten)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="veld-label" htmlFor="bel">Beloning</label>
              <select id="bel" name="beloning_id" className="veld" defaultValue="">
                <option value="">Vrij aantal punten als korting</option>
                {actieveBeloningen.map((x) => (
                  <option key={x.id} value={x.id}>{x.naam}, {getal(x.puntenPrijs)} punten</option>
                ))}
              </select>
            </div>
            <div>
              <label className="veld-label" htmlFor="pnt">Punten (alleen bij vrij aantal)</label>
              <input id="pnt" name="punten" type="number" min="1" step="1" className="veld" />
              <p className="veld-hint">1 punt = {euro2(b.instellingen.euroPerPunt)}.</p>
            </div>
            <div>
              <label className="veld-label" htmlFor="not">Notitie</label>
              <input id="not" name="notitie" className="veld" />
            </div>
            <VerzendKnop className="knop-donker">Inwisselen</VerzendKnop>
          </form>
        </Drawer>
      </div>

      <p className="mt-2 text-[12px] text-warm">
        Aangevraagd, dan goedgekeurd, dan verwerkt. Bij goedkeuren zetten we korting op een open conceptfactuur van de klant; is die er niet, of gaat het om iets anders dan korting,
        dan komt er een taak. Afwijzen geeft de punten terug.
      </p>

      {rijen.length === 0 ? (
        <div className="mt-4">
          <EmptyState titel="Niets te doen" tekst={status ? 'Geen inwisselingen met deze status.' : 'Nog geen inwisselingen. Klanten kunnen een beloning aanvragen in het portaal, of jij wisselt in vanaf de klantpagina.'} />
        </div>
      ) : (
        <div className="panel mt-3 overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Klant</th>
                <th>Beloning</th>
                <th className="num">Punten</th>
                <th className="num">Waarde</th>
                <th>Via</th>
                <th>Status</th>
                <th className="text-right">Actie</th>
              </tr>
            </thead>
            <tbody>
              {rijen.map((r) => (
                <tr key={r.id} className={r.status === 'aangevraagd' ? 'bg-amber-50/40' : ''}>
                  <td className="stil whitespace-nowrap">{datumKort(r.createdAt)}</td>
                  <td>
                    <Link href={`/dashboard/sparen/klanten/${r.organisatieId}`} className="rij-link">{r.organisatieNaam || 'Onbekend'}</Link>
                  </td>
                  <td>
                    <span className="text-ink-900">{r.beloningNaam || r.omschrijving || 'Korting'}</span>
                    {r.notitie && <span className="block text-[11px] text-warm">{r.notitie}</span>}
                    {r.afgewezenReden && <span className="block text-[11px] text-red-700">Afgewezen: {r.afgewezenReden}</span>}
                    <span className="block text-[11px] text-warm">
                      {r.factuurId && <Link href={`/dashboard/facturen/${r.factuurId}`} className="mr-2 underline-offset-2 hover:underline">Op factuur</Link>}
                      {r.taakId && <Link href={`/dashboard/taken?taak=${r.taakId}`} className="underline-offset-2 hover:underline">Taak</Link>}
                    </span>
                  </td>
                  <td className="num">{getal(r.punten)}</td>
                  <td className="num stil">{euro2(r.kortingEuro)}</td>
                  <td className="stil">
                    {r.bron === 'portaal' ? 'Portaal' : 'Dashboard'}
                    {r.aangevraagdDoor && <span className="block max-w-[160px] truncate text-[11px]">{r.aangevraagdDoor}</span>}
                  </td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="text-right">
                    {b.loyaliteit && r.status === 'aangevraagd' && (
                      <div className="flex justify-end gap-1.5">
                        <Drawer knop="Goedkeuren" titel={`${r.beloningNaam || 'Inwisseling'} voor ${r.organisatieNaam}`} beschrijving={`${getal(r.punten)} punten, waarde ${euro2(r.kortingEuro)}.`} knopKlasse="knop-primair" breedte="sm:max-w-md">
                          <form action={zetInwisselStatusActie} className="space-y-4 text-left">
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="status" value="goedgekeurd" />
                            <input type="hidden" name="terug" value={PAD} />
                            <div>
                              <label className="veld-label" htmlFor={`opv-${r.id}`}>Opvolging</label>
                              <select id={`opv-${r.id}`} name="opvolging" className="veld" defaultValue="auto">
                                <option value="auto">Korting op conceptfactuur, anders een taak</option>
                                <option value="taak">Altijd een taak</option>
                                <option value="geen">Niets, ik regel het zelf</option>
                              </select>
                            </div>
                            <label className="flex items-center gap-2 text-[13px] text-ink-800">
                              <input type="checkbox" name="mail_klant" value="ja" defaultChecked={r.bron === 'portaal'} />
                              Klant mailen dat het is goedgekeurd
                            </label>
                            <VerzendKnop className="knop-donker">Goedkeuren</VerzendKnop>
                          </form>
                        </Drawer>
                        <Drawer knop="Afwijzen" titel="Aanvraag afwijzen" beschrijving="De punten gaan terug naar de klant." knopKlasse="knop-stil" breedte="sm:max-w-md">
                          <form action={zetInwisselStatusActie} className="space-y-4 text-left">
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="status" value="afgewezen" />
                            <input type="hidden" name="terug" value={PAD} />
                            <div>
                              <label className="veld-label" htmlFor={`reden-${r.id}`}>Reden</label>
                              <input id={`reden-${r.id}`} name="reden" required maxLength={500} className="veld" placeholder="Bijv. dit artikel is niet meer leverbaar" />
                            </div>
                            <label className="flex items-center gap-2 text-[13px] text-ink-800">
                              <input type="checkbox" name="mail_klant" value="ja" defaultChecked={r.bron === 'portaal'} />
                              Klant mailen met de reden
                            </label>
                            <VerzendKnop className="knop-donker">Afwijzen</VerzendKnop>
                          </form>
                        </Drawer>
                      </div>
                    )}
                    {b.loyaliteit && r.status === 'goedgekeurd' && (
                      <form action={zetInwisselStatusActie} className="inline">
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="status" value="verwerkt" />
                        <input type="hidden" name="terug" value={PAD} />
                        <VerzendKnop className="knop-stil">Verwerkt</VerzendKnop>
                      </form>
                    )}
                    {r.status === 'verwerkt' && <span className="text-[11px] text-warm">{datumKort(r.verwerktOp ?? r.createdAt)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
