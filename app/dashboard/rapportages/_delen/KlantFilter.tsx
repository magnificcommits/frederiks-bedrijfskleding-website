import AutoSubmitSelect from '@/components/dashboard/AutoSubmitSelect';

/**
 * Klantfilter als gewoon GET-formulier: kiezen is meteen tonen. De overige
 * parameters (periode) gaan als verborgen velden mee.
 */
export default function KlantFilter({
  pad,
  klanten,
  huidig,
  bewaar,
  label = 'Klant',
  legeOptie = 'Alle klanten',
}: {
  pad: string;
  klanten: { id: string; naam: string }[];
  huidig: string | null;
  bewaar: Record<string, string | undefined>;
  label?: string;
  legeOptie?: string | null;
}) {
  return (
    <form method="get" action={pad} className="flex flex-wrap items-end gap-2 print:hidden">
      {Object.entries(bewaar).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <label className="block min-w-[240px]">
        <span className="veld-label">{label}</span>
        <AutoSubmitSelect
          name="klant"
          defaultValue={huidig ?? ''}
          aria-label={label}
          className="veld"
          options={[...(legeOptie !== null ? [{ value: '', label: legeOptie }] : []), ...klanten.map((k) => ({ value: k.id, label: k.naam }))]}
        />
      </label>
      <noscript>
        <button type="submit" className="knop-stil">Toon</button>
      </noscript>
    </form>
  );
}
