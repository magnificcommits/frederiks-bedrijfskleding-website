import type { Metadata } from 'next';
import GoedkeuringenDemo from '@/components/kennismaking/demo/GoedkeuringenDemo';
import { PaginaKop } from '@/components/kennismaking/demo/ui';

export const metadata: Metadata = { title: 'Goedkeuringen', robots: { index: false, follow: false } };

export default function VoorbeeldGoedkeuringen() {
  return (
    <div>
      <PaginaKop
        titel="Goedkeuringen"
        intro="Aanvragen die boven het budget gaan of buiten het vaste pakket vallen, komen eerst hier langs. Keur goed en de bestelling gaat door."
      />
      <GoedkeuringenDemo />
    </div>
  );
}
