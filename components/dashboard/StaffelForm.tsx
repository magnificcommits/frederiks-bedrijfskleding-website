import type { ReactNode } from 'react';

/**
 * Eén staffel (vanaf aantal, prijs per stuk) als formulier. Bestaande regels plus
 * twee lege regels om toe te voegen; een regel leegmaken haalt hem weg.
 * Gebruikt door de centrale prijslijst en de afwijkende prijzen per klant.
 */
export default function StaffelForm({
  action,
  verborgen,
  staffel,
  knop = 'Opslaan',
  extra,
  placeholder,
}: {
  action: (fd: FormData) => Promise<void>;
  verborgen: Record<string, string>;
  staffel: { vanaf_aantal: number; stukprijs: number }[];
  knop?: string;
  extra?: ReactNode;
  /** Grijze voorbeeldprijzen in lege velden (bv. de centrale prijs bij een klant). */
  placeholder?: { vanaf_aantal: number; stukprijs: number }[];
}) {
  const leeg = Math.max(2, staffel.length ? 0 : placeholder?.length ?? 0);
  const rijen = [
    ...staffel.map((s) => ({ vanaf: String(s.vanaf_aantal), prijs: String(s.stukprijs).replace('.', ',') })),
    ...Array.from({ length: leeg }, () => ({ vanaf: '', prijs: '' })),
  ];
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      {Object.entries(verborgen).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {rijen.map((r, i) => {
        const voorbeeld = !staffel.length ? placeholder?.[i] : undefined;
        return (
          <div key={i} className="flex items-center gap-1 rounded-md border border-line bg-white px-1.5 py-1">
            {/* Vult Jessi alleen een prijs in, dan geldt het grijze "vanaf"-getal. */}
            <input type="hidden" name={`vanafdef__${i}`} value={voorbeeld ? String(voorbeeld.vanaf_aantal) : i === 0 ? '1' : ''} />
            <span className="text-[11px] text-warm">vanaf</span>
            <input name={`vanaf__${i}`} defaultValue={r.vanaf} placeholder={voorbeeld ? String(voorbeeld.vanaf_aantal) : i === 0 ? '1' : ''} inputMode="numeric" aria-label="Vanaf aantal" className="w-12 rounded border border-line px-1 py-0.5 text-right text-sm" />
            <span className="text-[11px] text-warm">€</span>
            <input name={`prijs__${i}`} defaultValue={r.prijs} placeholder={voorbeeld ? String(voorbeeld.stukprijs).replace('.', ',') : ''} inputMode="decimal" aria-label="Prijs per stuk" className="w-16 rounded border border-line px-1 py-0.5 text-right text-sm" />
          </div>
        );
      })}
      {extra}
      <button type="submit" className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink-800 hover:bg-mist">{knop}</button>
    </form>
  );
}
