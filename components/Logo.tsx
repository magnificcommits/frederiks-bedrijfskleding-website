import Link from 'next/link';
import { site } from '@/content/site';
import { logoDataUri } from '@/content/logoData';

/**
 * Logo als ingebakken data-URI (rendert altijd). Header: direct op de witte balk.
 * Footer (light): op een wit chip-vlak, omdat het logo een witte achtergrond heeft.
 */
export function Logo({ light = false }: { light?: boolean }) {
  /* eslint-disable-next-line @next/next/no-img-element */
  const img = <img src={logoDataUri} alt={site.name} className={light ? 'h-8 w-auto' : 'h-11 w-auto sm:h-12'} />;
  if (light) {
    return (
      <Link href="/" className="inline-flex" aria-label={`${site.name} naar home`}>
        <span className="inline-flex items-center rounded-md bg-white px-3 py-2 shadow-sm">{img}</span>
      </Link>
    );
  }
  return (
    <Link href="/" className="inline-flex items-center" aria-label={`${site.name} naar home`}>
      {img}
    </Link>
  );
}
