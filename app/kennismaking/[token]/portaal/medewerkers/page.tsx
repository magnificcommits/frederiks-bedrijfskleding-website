import type { Metadata } from 'next';
import MedewerkersDemo from '@/components/kennismaking/demo/MedewerkersDemo';
import { PaginaKop, TijdChip } from '@/components/kennismaking/demo/ui';

export const metadata: Metadata = { title: 'Medewerkers', robots: { index: false, follow: false } };

export default function VoorbeeldMedewerkers() {
  return (
    <div>
      <PaginaKop
        titel="Medewerkers"
        intro="Iedereen op één plek: afdeling, maten, budget en wie kan inloggen. Bij een bestelling kies je een naam en de maten staan al ingevuld."
      />
      <div className="mt-4">
        <TijdChip>maten staan vast. Na een pasdag zet Jessi ze erin, daarna hoef je er nooit meer naar te vragen.</TijdChip>
      </div>
      <MedewerkersDemo />
    </div>
  );
}
