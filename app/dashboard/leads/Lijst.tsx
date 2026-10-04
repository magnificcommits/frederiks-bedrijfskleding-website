import Link from 'next/link';
import SortableTh from '@/components/dashboard/SortableTh';
import { bulkConverteerLeads } from './actions';
import { OpvolgLabel, ScoreBadge, StatusLabel, WachtLabel } from './onderdelen';
import { datumKort, euro, isOpen } from '@/lib/kms/leadsModel';
import type { LeadKaart } from '@/lib/kms/leads';

/** Compacte, sorteerbare lijst. Klik op de naam voor alle details en acties. */
export default function Lijst({ leads, terug, personen }: { leads: LeadKaart[]; terug: string; personen: Map<string, string> }) {
  return (
    <>
      <div className="panel overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th className="w-8"><span className="sr-only">Selecteren</span></th>
              <SortableTh label="Lead" col="naam" />
              <SortableTh label="Score" col="score" />
              <SortableTh label="Status" col="status" />
              <SortableTh label="Opvolging" col="opvolg" />
              <SortableTh label="Waarde" col="waarde" className="text-right" />
              <th>Herkomst</th>
              <th>Eigenaar</th>
              <SortableTh label="Binnen" col="binnen" />
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => {
              const eigenaar = (l.eigenaar_id && personen.get(l.eigenaar_id)) || l.eigenaar || null;
              return (
                <tr key={l.id} className={l.opvolg === 'verlopen' ? 'bg-red-50/40' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      name="lead_ids"
                      value={l.id}
                      form="bulkleads"
                      className="h-4 w-4 rounded border-line accent-amber-600"
                      aria-label={`Selecteer ${l.company || l.name}`}
                    />
                  </td>
                  <td className="max-w-[18rem]">
                    <Link href={`/dashboard/leads/${l.id}`} className="rij-link block truncate">{l.company || l.name}</Link>
                    <span className="block truncate text-[12px] text-warm">
                      {l.company ? l.name : ''}
                      {l.company && l.branche ? ' · ' : ''}
                      {l.branche ?? ''}
                      {l.dubbelVan.length > 0 && <span className="ml-1.5 rounded bg-ink-100 px-1 text-[11px] font-semibold text-ink-600">dubbel?</span>}
                    </span>
                  </td>
                  <td><ScoreBadge score={l.scoreWaarde} /></td>
                  <td>
                    <StatusLabel status={l.status} />
                    {l.status === 'afgewezen' && l.verloren_reden && (
                      <span className="mt-0.5 block max-w-[12rem] truncate text-[11px] text-warm">{l.verloren_reden}</span>
                    )}
                  </td>
                  <td className="max-w-[14rem]">
                    {l.wachtUren != null ? (
                      <WachtLabel uren={l.wachtUren} />
                    ) : (
                      <OpvolgLabel stand={l.opvolg} datum={l.opvolgdatum} stap={l.volgende_stap} toonGeen={isOpen(l.status)} />
                    )}
                  </td>
                  <td className="num">
                    {l.waarde > 0 ? (
                      <span className={l.waardeGeschat ? 'text-warm' : 'font-semibold text-ink-900'} title={l.waardeGeschat ? 'Geschat op teamgrootte' : undefined}>
                        {l.waardeGeschat ? '≈ ' : ''}{euro(l.waarde)}
                      </span>
                    ) : (
                      <span className="text-ink-300">-</span>
                    )}
                  </td>
                  <td className="max-w-[10rem] truncate text-warm" title={l.bron ?? undefined}>{l.kanaal}</td>
                  <td className="text-warm">{eigenaar ?? <span className="text-ink-300">-</span>}</td>
                  <td className="whitespace-nowrap text-warm">{datumKort(l.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <form id="bulkleads" action={bulkConverteerLeads} className="mt-3 flex justify-end">
        <input type="hidden" name="terug" value={terug} />
        <button type="submit" className="knop-stil">Aangevinkte leads omzetten naar klant</button>
      </form>
    </>
  );
}
