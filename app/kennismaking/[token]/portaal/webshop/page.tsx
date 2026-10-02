import type { Metadata } from 'next';
import { vereisDemo } from '@/lib/prospect/demo/laad';
import WebshopDemo from '@/components/kennismaking/demo/WebshopDemo';
import { PaginaKop, TijdChip } from '@/components/kennismaking/demo/ui';

export const metadata: Metadata = { title: 'Kleding bestellen', robots: { index: false, follow: false } };

export default async function VoorbeeldWebshop({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const demo = await vereisDemo(token);

  return (
    <div>
      <PaginaKop
        titel="Kleding bestellen"
        intro={`Dit is de kledinglijn van ${demo.bedrijfsnaam}: alleen wat jullie met Jessi hebben afgesproken, met jullie logo erop.`}
      />
      <div className="mt-4">
        <TijdChip>altijd hetzelfde logo, dezelfde kleur en dezelfde plek. Wie er ook bestelt.</TijdChip>
      </div>
      <WebshopDemo />
    </div>
  );
}
