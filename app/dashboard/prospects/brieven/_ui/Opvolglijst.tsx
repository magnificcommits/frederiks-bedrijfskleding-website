import Link from 'next/link';
import VerzendKnop from '@/components/dashboard/VerzendKnop';
import { maakOpvolgTaakActie, zetOntvangerStatusActie } from '../actions';

export type OpvolgRij = {
  prospectId: string;
  ontvangerId: string | null;
  batchId: string | null;
  batchNaam: string | null;
  bedrijfsnaam: string;
  plaats: string | null;
  telefoon: string | null;
  qrScans: number;
  laatsteScan: string | null;
  portaal: boolean;
  aanvraag: boolean;
  taak: { open: boolean; vervaldatum: string | null } | null;
};

function wanneer(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  const uren = (Date.now() - d.getTime()) / 3600_000;
  if (uren < 1) return 'net';
  if (uren < 24) return `${Math.round(uren)} uur geleden`;
  const dagen = Math.round(uren / 24);
  if (dagen < 14) return `${dagen} ${dagen === 1 ? 'dag' : 'dagen'} geleden`;
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

/**
 * "Gescand, nog niet gebeld": wie de QR-code scande maar nog geen reactie,
 * afspraak of afwijzing heeft. Nieuwste scan bovenaan; hoe verser, hoe beter het
 * gesprek. Per rij een beltaak maken en na het bellen met één klik de uitkomst.
 */
export default function Opvolglijst({ rijen, terug, toonBatch = false }: { rijen: OpvolgRij[]; terug: string; toonBatch?: boolean }) {
  if (rijen.length === 0) {
    return <p className="rounded-md border border-dashed border-line bg-mist px-3 py-5 text-center text-[13px] text-warm">Niemand om te bellen. Zodra iemand scant en nog geen reactie heeft, staat hij hier.</p>;
  }
  return (
    <ul className="divide-y divide-line">
      {rijen.map((r) => (
        <li key={`${r.prospectId}-${r.ontvangerId ?? 'los'}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
          <div className="min-w-[12rem] grow basis-60">
            <Link href={`/dashboard/prospects/${r.prospectId}`} className="text-[14px] font-semibold text-ink-900 hover:text-amber-700">{r.bedrijfsnaam}</Link>
            <p className="text-[12px] text-warm">
              {[r.plaats, `${r.qrScans}x gescand, laatst ${wanneer(r.laatsteScan)}`].filter(Boolean).join(' · ')}
              {r.portaal && ' · bekeek het demo-portaal'}
              {r.aanvraag && ' · vroeg een pasdag aan'}
              {toonBatch && r.batchNaam && r.batchId && (
                <>
                  {' · '}
                  <Link href={`/dashboard/prospects/brieven/${r.batchId}?stap=volgen`} className="underline-offset-2 hover:underline">{r.batchNaam}</Link>
                </>
              )}
            </p>
          </div>
          <div className="w-36 text-[13px]">
            {r.telefoon ? (
              <a href={`tel:${r.telefoon.replace(/[^0-9+]/g, '')}`} className="font-semibold tabular-nums text-ink-900 hover:text-amber-700">{r.telefoon}</a>
            ) : (
              <span className="text-warm">geen nummer</span>
            )}
          </div>
          <div className="flex w-44 items-center">
            {r.taak?.open ? (
              <Link href="/dashboard/taken" className="text-[12px] text-ink-800 hover:text-ink-900">
                Beltaak staat open{r.taak.vervaldatum ? ` (${new Date(`${r.taak.vervaldatum}T12:00:00`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })})` : ''}
              </Link>
            ) : (
              <form action={maakOpvolgTaakActie}>
                <input type="hidden" name="prospect" value={r.prospectId} />
                <input type="hidden" name="terug" value={terug} />
                <VerzendKnop className="knop-stil py-1 text-[12px]" bezigTekst="Bezig…">{r.taak ? 'Taak weer openzetten' : 'Taak maken'}</VerzendKnop>
              </form>
            )}
          </div>
          {r.ontvangerId ? (
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-[12px] text-warm">Gebeld:</span>
              {([
                ['afspraak', 'afspraak'],
                ['gereageerd', 'gesproken, volgt nog'],
                ['geen_interesse', 'geen interesse'],
              ] as const).map(([s, l]) => (
                <form key={s} action={zetOntvangerStatusActie}>
                  <input type="hidden" name="id" value={r.ontvangerId ?? ''} />
                  <input type="hidden" name="status" value={s} />
                  <input type="hidden" name="batch" value={r.batchId ?? ''} />
                  <input type="hidden" name="terug" value={terug} />
                  <button className={`rounded border px-2 py-1 text-[12px] font-semibold ${s === 'afspraak' ? 'border-green-200 bg-green-50 text-green-800 hover:bg-green-100' : 'border-line bg-white text-ink-700 hover:bg-mist'}`}>{l}</button>
                </form>
              ))}
            </div>
          ) : (
            <Link href={`/dashboard/prospects/${r.prospectId}`} className="text-[12px] text-warm hover:text-ink-900">Status op de prospectpagina</Link>
          )}
        </li>
      ))}
    </ul>
  );
}
