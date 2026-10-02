import Link from 'next/link';
import Drawer from '@/components/dashboard/Drawer';
import ConfirmSubmit from '@/components/ConfirmSubmit';
import type { Afdeling, Vestiging } from '@/lib/kms/structuur';
import type { Werknemer } from '@/lib/kms/werknemers';
import type { AssortimentRij } from '@/lib/kms/assortiment';
import { nieuweAfdelingActie, werkAfdelingActie, verwijderAfdelingKlantActie } from './actions';

/**
 * Tabblad Afdelingen op de klantpagina. Een afdeling groepeert werknemers
 * (bijv. Lassers, Logistiek) en kan een eigen assortiment krijgen: laskleding
 * alleen voor de lassers. Vestigingen, adressen en de rechten van
 * leidinggevenden staan op de pagina Inrichting.
 */
export default function AfdelingenTab({
  orgId,
  afdelingen,
  vestigingen,
  werknemers,
  assortiment,
}: {
  orgId: string;
  afdelingen: Afdeling[];
  vestigingen: Vestiging[];
  werknemers: Werknemer[];
  assortiment: AssortimentRij[];
}) {
  const werknemersPer = new Map<string, number>();
  for (const w of werknemers) {
    if (w.actief && w.afdeling_id) werknemersPer.set(w.afdeling_id, (werknemersPer.get(w.afdeling_id) ?? 0) + 1);
  }
  const artikelenPer = new Map<string, number>();
  for (const r of assortiment) {
    if (r.afdeling_id) artikelenPer.set(r.afdeling_id, (artikelenPer.get(r.afdeling_id) ?? 0) + 1);
  }

  function formulier(a: Afdeling | null) {
    const sleutel = a?.id ?? 'nieuw';
    return (
      <form action={a ? werkAfdelingActie : nieuweAfdelingActie} className="flex flex-col gap-4">
        <input type="hidden" name="orgId" value={orgId} />
        {a && <input type="hidden" name="afdelingId" value={a.id} />}
        <div>
          <label className="veld-label" htmlFor={`afd-naam-${sleutel}`}>Naam</label>
          <input
            id={`afd-naam-${sleutel}`}
            name="naam"
            required
            defaultValue={a?.naam ?? ''}
            placeholder="Bijv. Lassers, Logistiek, Kantoor"
            className="veld"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="veld-label" htmlFor={`afd-lg-${sleutel}`}>Leidinggevende (optioneel)</label>
            <input id={`afd-lg-${sleutel}`} name="leidinggevende" defaultValue={a?.leidinggevende ?? ''} placeholder="Naam" className="veld" />
          </div>
          <div>
            <label className="veld-label" htmlFor={`afd-kp-${sleutel}`}>Kostenplaats (optioneel)</label>
            <input id={`afd-kp-${sleutel}`} name="kostenplaats" defaultValue={a?.kostenplaats ?? ''} placeholder="Bijv. KP-100" className="veld" />
          </div>
        </div>
        {vestigingen.length > 0 && (
          <div>
            <label className="veld-label" htmlFor={`afd-vest-${sleutel}`}>Vestiging</label>
            <select id={`afd-vest-${sleutel}`} name="vestiging_id" defaultValue={a?.vestiging_id ?? ''} className="veld">
              <option value="">Geen / hele organisatie</option>
              {vestigingen.map((v) => (
                <option key={v.id} value={v.id}>{v.naam}</option>
              ))}
            </select>
          </div>
        )}
        <button type="submit" className="knop-donker self-start px-4 py-2.5 text-[15px]">
          {a ? 'Wijzigingen opslaan' : 'Afdeling aanmaken'}
        </button>
      </form>
    );
  }

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h2 className="font-display text-xl font-bold text-ink-900">Afdelingen</h2>
          <p className="mt-1 text-[14px] text-warm">
            Deel de werknemers in per afdeling. Een afdeling kan een eigen assortiment krijgen: kies bij het
            toevoegen van een artikel op het tabblad Assortiment voor welke afdelingen het is. Adressen, vestigingen en
            de rechten van leidinggevenden in het portaal regel je bij{' '}
            <Link href={`/dashboard/klanten/${orgId}/structuur`} className="font-semibold text-amber-700 hover:text-amber-800">
              Inrichting
            </Link>
            .
          </p>
        </div>
        <Drawer knop="Afdeling toevoegen" titel="Afdeling toevoegen">
          {formulier(null)}
        </Drawer>
      </div>

      {afdelingen.length === 0 ? (
        <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-4 text-[14px] text-warm">
          Nog geen afdelingen. Heeft deze klant groepen met andere kleding, zoals lassers en logistiek, maak dan per
          groep een afdeling aan.
        </p>
      ) : (
        <div className="panel mt-4 overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Naam</th>
                <th>Leidinggevende</th>
                <th>Vestiging</th>
                <th className="num">Werknemers</th>
                <th className="num">Eigen artikelen</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {afdelingen.map((a) => (
                <tr key={a.id}>
                  <td className="font-semibold text-ink-900">
                    {a.naam}
                    {a.kostenplaats && <span className="ml-2 text-[12px] font-normal text-warm">kostenplaats {a.kostenplaats}</span>}
                  </td>
                  <td className="stil">{a.leidinggevende || '—'}</td>
                  <td className="stil">{a.vestiging_naam || '—'}</td>
                  <td className="num stil">{werknemersPer.get(a.id) ?? 0}</td>
                  <td className="num stil">{artikelenPer.get(a.id) ?? 0}</td>
                  <td>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Drawer knop="Bewerken" titel={`Afdeling bewerken: ${a.naam}`} knopKlasse="knop-stil">
                        {formulier(a)}
                      </Drawer>
                      <form action={verwijderAfdelingKlantActie}>
                        <input type="hidden" name="orgId" value={orgId} />
                        <input type="hidden" name="afdelingId" value={a.id} />
                        <ConfirmSubmit
                          message={`Afdeling ${a.naam} verwijderen? De werknemers blijven bestaan maar hebben daarna geen afdeling meer, en artikelen die alleen voor deze afdeling in het assortiment stonden gaan eruit.`}
                          className="knop-stil"
                        >
                          Verwijderen
                        </ConfirmSubmit>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
