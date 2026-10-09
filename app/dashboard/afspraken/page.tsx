import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { afspraakTellingen, listAfspraken, type AfspraakFilter } from '@/lib/afspraken/afspraken';
import { AFSPRAAK_STATUSSEN, SOORT_INFO, STATUS_LABEL } from '@/lib/afspraken/soorten';
import { datumKort, nlDelen } from '@/app/dashboard/taken/tijd';
import PaginaKop from '@/components/dashboard/ui/PaginaKop';
import { zetAfspraakStatusActie } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Afspraken', robots: { index: false, follow: false } };

const TABS: { id: AfspraakFilter; label: string }[] = [
  { id: 'komend', label: 'Komend' },
  { id: 'verleden', label: 'Geweest' },
  { id: 'geannuleerd', label: 'Geannuleerd' },
  { id: 'alles', label: 'Alles' },
];

const STATUS_BADGE: Record<string, string> = {
  gepland: 'badge-actie',
  geweest: 'badge-klaar',
  no_show: 'badge bg-red-100 text-red-800',
  geannuleerd: 'badge-rust',
};

export default async function AfsprakenPage({ searchParams }: { searchParams: Promise<{ tab?: string; melding?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const { tab: tabIn, melding } = await searchParams;
  const tab = (TABS.find((t) => t.id === tabIn)?.id ?? 'komend') as AfspraakFilter;
  const [afspraken, tellingen] = await Promise.all([listAfspraken(tab), afspraakTellingen()]);
  const nu = Date.now();

  return (
    <main className="container-app py-6">
      <PaginaKop
        titel="Afspraken"
        sub="Online geboekt via de website. Ze staan ook in de agenda onder Taken."
        acties={
          <>
            <Link href="/dashboard/taken?weergave=agenda" className="knop-stil">Naar de agenda</Link>
            <Link href="/dashboard/afspraken/beschikbaarheid" className="knop-primair">Beschikbaarheid aanpassen</Link>
            <a href="/afspraak" target="_blank" rel="noreferrer" className="knop-stil">Boekpagina bekijken</a>
          </>
        }
      />

      {melding && (
        <p
          className={`mt-4 rounded-lg border px-4 py-2 text-sm font-semibold ${
            melding === 'status' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {melding === 'status' ? 'Status opgeslagen.' : melding === 'mislukt' ? 'Dat lukte niet. Probeer het opnieuw.' : melding}
        </p>
      )}

      {tellingen.teVerwerken > 0 && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-ink-800">
          {tellingen.teVerwerken === 1 ? 'Eén afspraak is' : `${tellingen.teVerwerken} afspraken zijn`} al voorbij maar staat nog op gepland.
          Zet ze op geweest of niet komen opdagen, dan klopt de opvolging.
        </p>
      )}

      <nav className="mt-4 flex flex-wrap gap-2" aria-label="Filter">
        {TABS.map((t) => (
          <Link key={t.id} href={`/dashboard/afspraken?tab=${t.id}`} className={`chip ${t.id === tab ? 'chip-aan' : ''}`}>
            {t.label}
            {t.id === 'komend' && tellingen.komend > 0 && <span className="chip-tel">{tellingen.komend}</span>}
          </Link>
        ))}
      </nav>

      <div className="panel mt-4 overflow-x-auto">
        {afspraken.length === 0 ? (
          <p className="p-6 text-sm text-warm">
            {tab === 'komend' ? 'Er staan geen online afspraken gepland.' : 'Niets gevonden in deze weergave.'}
          </p>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Wanneer</th>
                <th>Soort</th>
                <th>Wie</th>
                <th>Contact</th>
                <th>Waar</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {afspraken.map((a) => {
                const start = nlDelen(new Date(a.start_op));
                const eind = nlDelen(new Date(a.eind_op));
                const voorbij = new Date(a.eind_op).getTime() < nu;
                return (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap">
                      <span className="font-semibold text-ink-900">{datumKort(start.datum)}</span>
                      <span className="stil"> {start.tijd} tot {eind.tijd}</span>
                    </td>
                    <td className="whitespace-nowrap">{SOORT_INFO[a.soort].label}</td>
                    <td>
                      {a.lead_id ? (
                        <Link href={`/dashboard/leads/${a.lead_id}`} className="rij-link">{a.bedrijf || a.naam}</Link>
                      ) : (
                        <span className="font-semibold text-ink-900">{a.bedrijf || a.naam}</span>
                      )}
                      {a.bedrijf && <span className="stil block text-[12px]">{a.naam}</span>}
                      {(a.aantal_medewerkers || a.branche) && (
                        <span className="stil block text-[12px]">{[a.branche, a.aantal_medewerkers && `${a.aantal_medewerkers} mw`].filter(Boolean).join(' · ')}</span>
                      )}
                      {a.opmerking && <span className="block max-w-[28rem] text-[12px] text-ink-700">{a.opmerking}</span>}
                    </td>
                    <td className="text-[12px]">
                      <a href={`mailto:${a.email}`} className="block hover:text-amber-700">{a.email}</a>
                      {a.telefoon && <a href={`tel:${a.telefoon.replace(/\s+/g, '')}`} className="block hover:text-amber-700">{a.telefoon}</a>}
                    </td>
                    <td className="max-w-[16rem] text-[12px]">{a.locatie ?? '-'}</td>
                    <td>
                      <span className={STATUS_BADGE[a.status] ?? 'badge-rust'}>{STATUS_LABEL[a.status]}</span>
                      {voorbij && a.status === 'gepland' && <span className="badge-actie ml-1">bijwerken</span>}
                      {a.status === 'gepland' && new Date(a.start_op).getTime() > nu && (
                        <a
                          href={`/afspraak/beheer/${encodeURIComponent(a.token)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-2 text-[12px] font-semibold text-amber-700 underline underline-offset-2"
                        >
                          Verzetten
                        </a>
                      )}
                      <form action={zetAfspraakStatusActie} className="mt-1 flex flex-wrap items-center gap-1.5">
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="tab" value={tab} />
                        <label className="sr-only" htmlFor={`status-${a.id}`}>Status</label>
                        <select id={`status-${a.id}`} name="status" defaultValue={a.status} className="veld w-auto py-1 text-[12px]">
                          {AFSPRAAK_STATUSSEN.map((s) => (
                            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                          ))}
                        </select>
                        <button type="submit" className="knop-stil py-1 text-[12px]">Opslaan</button>
                        {a.status !== 'geannuleerd' && (
                          <label className="flex items-center gap-1 text-[11px] text-warm" title="Alleen bij annuleren">
                            <input type="checkbox" name="mail_klant" defaultChecked /> klant mailen bij annuleren
                          </label>
                        )}
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
