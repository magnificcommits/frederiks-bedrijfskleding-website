import type { Metadata } from 'next';
import WinkelmandDemo from '@/components/kennismaking/demo/WinkelmandDemo';
import { PaginaKop } from '@/components/kennismaking/demo/ui';

export const metadata: Metadata = { title: 'Winkelmand', robots: { index: false, follow: false } };

export default function VoorbeeldWinkelmand() {
  return (
    <div>
      <PaginaKop
        titel="Winkelmand"
        intro="Per collega zie je meteen of de bestelling binnen het budget past. Controleer de maten en plaats de bestelling."
      />
      <WinkelmandDemo />
    </div>
  );
}
