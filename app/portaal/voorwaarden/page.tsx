import type { Metadata } from 'next';
import VoorwaardenTekst from '@/components/VoorwaardenTekst';
import InfoPagina from '../InfoPagina';

export const metadata: Metadata = { title: 'Algemene voorwaarden', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function PortaalVoorwaarden() {
  return (
    <InfoPagina titel="Algemene voorwaarden" pad="/portaal/voorwaarden">
      <VoorwaardenTekst />
    </InfoPagina>
  );
}
