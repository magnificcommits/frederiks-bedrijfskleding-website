import Link from 'next/link';
import AutoSubmitSelect from '@/components/dashboard/AutoSubmitSelect';
import { WERKBON_LABEL, WERKBON_STATUSSEN, type WerkbonKaart as Kaart, type WerkbonStatus } from '@/lib/kms/logos';
import { zetWerkbonStatusActie } from './actions';

const korteDatum = (s: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' }).format(new Date(s));

/** Hoeveel dagen tot de deadline (negatief = verstreken). */
export function dagenTot(deadline: string | null): number | null {
  if (!deadline) return null;
  const d = new Date(`${deadline.slice(0, 10)}T00:00:00`);
  const vandaag = new Date();
  vandaag.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - vandaag.getTime()) / 86400000);
}

export function DeadlineLabel({ k }: { k: Pick<Kaart, 'deadline' | 'status'> }) {
  const dagen = dagenTot(k.deadline);
  if (dagen == null || !k.deadline) return <span className="text-warm">Geen deadline</span>;
  if (k.status === 'klaar') return <span className="text-warm">Deadline {korteDatum(k.deadline)}</span>;
  const kleur = dagen < 0 ? 'bg-red-50 text-red-700' : dagen <= 2 ? 'bg-amber-50 text-amber-800' : 'text-ink-700';
  const tekst = dagen < 0 ? `${-dagen} dag${dagen === -1 ? '' : 'en'} te laat` : dagen === 0 ? 'Vandaag' : dagen === 1 ? 'Morgen' : `Over ${dagen} dagen`;
  return (
    <span className={`rounded px-1.5 py-0.5 font-semibold ${kleur}`}>
      {tekst} <span className="font-normal">({korteDatum(k.deadline)})</span>
    </span>
  );
}

const VOLGENDE: Partial<Record<WerkbonStatus, { status: WerkbonStatus; label: string }>> = {
  goedgekeurd: { status: 'in_productie', label: 'Start productie' },
  in_productie: { status: 'klaar', label: 'Klaar melden' },
};

export function ProefRegel({ k }: { k: Kaart }) {
  const p = k.proeven;
  if (p.totaal === 0) {
    return (
      <Link href={`/dashboard/drukproeven/nieuw?org=${k.organisatie_id}&order=${k.order_id}`} className="font-semibold text-amber-700 hover:text-amber-800">
        Nog geen drukproef, maak er een
      </Link>
    );
  }
  const delen = [`${p.goedgekeurd} van ${p.totaal} goedgekeurd`, p.open ? `${p.open} open` : null, p.afgekeurd ? `${p.afgekeurd} afgekeurd` : null].filter(Boolean);
  return (
    <Link href={`/dashboard/orders/${k.order_id}`} className={p.goedgekeurd > 0 ? 'text-green-800 hover:underline' : 'text-ink-700 hover:underline'}>
      Proef: {delen.join(', ')}
    </Link>
  );
}

/** Eén werkbon als kaart in de planning. */
export default function WerkbonKaart({ k, terug }: { k: Kaart; terug: string }) {
  const volgende = VOLGENDE[k.status];
  const artikelen = k.artikelen.slice(0, 3);
  const meer = k.artikelen.length - artikelen.length;
  const teLaat = (dagenTot(k.deadline) ?? 1) < 0 && k.status !== 'klaar';

  return (
    <li className={`panel flex flex-col gap-2 p-3 text-[13px] ${teLaat ? 'border-red-300' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-mist">
          {k.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={k.thumb} alt="" loading="lazy" className="max-h-full max-w-full object-contain p-1" />
          ) : (
            <span className="text-[10px] text-ink-400">geen logo</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <Link href={`/dashboard/klanten/${k.organisatie_id}?tab=logos`} className="block truncate font-semibold text-ink-900 hover:text-amber-800">{k.klant_naam}</Link>
          <Link href={`/dashboard/orders/${k.order_id}`} className="text-[12px] text-warm hover:text-ink-800">
            Order {k.ordernummer != null ? `#${k.ordernummer}` : ''} · {k.order_status.replace(/_/g, ' ')}
          </Link>
        </div>
      </div>

      {artikelen.length > 0 && (
        <ul className="text-ink-800">
          {artikelen.map((a) => (
            <li key={a.naam} className="flex justify-between gap-2">
              <span className="truncate">{a.naam}</span>
              <span className="shrink-0 tabular-nums text-warm">{a.aantal}x</span>
            </li>
          ))}
          {meer > 0 && <li className="text-[12px] text-warm">en nog {meer} artikel{meer === 1 ? '' : 'en'}</li>}
        </ul>
      )}

      <p className="flex flex-wrap gap-x-2 gap-y-1 text-[12px] text-ink-700">
        {k.technieken.map((t) => (
          <span key={t} className="rounded bg-mist px-1.5 py-0.5 font-semibold capitalize">{t}</span>
        ))}
        {k.posities.length > 0 && <span>{k.posities.join(', ')}</span>}
        <span className="text-warm">{k.aantal} stuks</span>
      </p>

      <p className="text-[12px]"><DeadlineLabel k={k} /></p>
      <p className="text-[12px]"><ProefRegel k={k} /></p>

      {k.waarschuwingen.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-[12px] font-semibold text-amber-800">
          {k.waarschuwingen.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}
      {k.notitie && <p className="rounded bg-mist px-2 py-1 text-[12px] text-ink-700">{k.notitie}</p>}

      <div className="mt-1 flex flex-wrap items-center gap-1.5 border-t border-line pt-2">
        <Link href={`/dashboard/orders/${k.order_id}/werkbon`} className="knop-stil !px-2.5 !py-1 !text-xs">Openen</Link>
        <Link href={`/dashboard/orders/${k.order_id}/werkbon?afdrukken=1`} className="knop-stil !px-2.5 !py-1 !text-xs">Afdrukken</Link>
        {volgende && (
          <form action={zetWerkbonStatusActie}>
            <input type="hidden" name="orderId" value={k.order_id} />
            <input type="hidden" name="status" value={volgende.status} />
            <input type="hidden" name="terug" value={terug} />
            <button type="submit" className="knop-donker !px-2.5 !py-1 !text-xs">{volgende.label}</button>
          </form>
        )}
        <form action={zetWerkbonStatusActie} className="ml-auto">
          <input type="hidden" name="orderId" value={k.order_id} />
          <input type="hidden" name="terug" value={terug} />
          <AutoSubmitSelect
            name="status"
            defaultValue={k.status}
            aria-label={`Status werkbon order ${k.ordernummer ?? ''}`}
            className="rounded-md border border-line bg-white px-1.5 py-1 text-xs"
            options={WERKBON_STATUSSEN.map((s) => ({ value: s, label: WERKBON_LABEL[s] }))}
          />
        </form>
      </div>
    </li>
  );
}
