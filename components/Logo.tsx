import Link from 'next/link';
import Image from 'next/image';
import { site } from '@/content/site';

/**
 * Het echte logo via next/image (zelfde route als de werkende herofoto).
 * Header: direct op de witte balk. Footer (light): op een wit chip-vlak,
 * omdat het JPEG een witte achtergrond heeft.
 */
export function Logo({ light = false }: { light?: boolean }) {
  const img = (
    <Image
      src="/Frederiks-bedrijfskleding-logo.jpg"
      alt={site.name}
      width={300}
      height={62}
      priority
      className={light ? 'h-8 w-auto' : 'h-11 w-auto sm:h-12'}
    />
  );
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
