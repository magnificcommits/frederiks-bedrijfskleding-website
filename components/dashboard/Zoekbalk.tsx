/**
 * Zoekveld voor een lijstscherm. Verstuurt met GET, zodat de zoekterm in de URL
 * staat en de weergave deelbaar en bookmarkbaar blijft.
 *
 * `bewaar` reist mee als verborgen velden: zoeken gooit je statusfilter of
 * sortering dus niet weg. De paginering laten we bewust vallen — na een nieuwe
 * zoekterm is pagina 4 zelden nog waar je wilt zijn.
 */
export default function Zoekbalk({
  waarde,
  placeholder,
  bewaar,
  breedte = 'w-72',
}: {
  waarde?: string;
  placeholder: string;
  bewaar?: Record<string, string | undefined>;
  breedte?: string;
}) {
  return (
    <form method="get" className="flex items-center gap-2">
      {Object.entries(bewaar ?? {}).map(([k, v]) =>
        v ? <input key={k} type="hidden" name={k} value={v} /> : null,
      )}
      <input
        name="zoek"
        defaultValue={waarde ?? ''}
        placeholder={placeholder}
        aria-label={placeholder}
        className={`veld ${breedte}`}
      />
      <button type="submit" className="knop-stil">Zoeken</button>
    </form>
  );
}
