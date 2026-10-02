import type { Metadata } from 'next';
import BestellingenDemo from '@/components/kennismaking/demo/BestellingenDemo';
import { PaginaKop } from '@/components/kennismaking/demo/ui';

export const metadata: Metadata = { title: 'Bestellingen', robots: { index: false, follow: false } };

export default function VoorbeeldBestellingen() {
  return (
    <div>
      <PaginaKop
        titel="Bestellingen"
        intro="Alle bestellingen van jullie bedrijf, met de status van vandaag. Van aanvraag tot bezorging."
      />
      <BestellingenDemo />
    </div>
  );
}
