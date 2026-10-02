import type { Metadata } from 'next';
import DrukproefDemo from '@/components/kennismaking/demo/DrukproefDemo';
import { PaginaKop } from '@/components/kennismaking/demo/ui';

export const metadata: Metadata = { title: 'Drukproeven', robots: { index: false, follow: false } };

export default function VoorbeeldDrukproeven() {
  return (
    <div>
      <PaginaKop
        titel="Drukproeven"
        intro="Hier zie je hoe het logo op de kleding komt: de plek, de maat en de techniek. Keur goed of vraag een wijziging."
      />
      <DrukproefDemo />
    </div>
  );
}
