import { Hero } from '@/components/Hero';
import { BewijsBalk } from '@/components/BewijsBalk';
import { HoeWerktHet } from '@/components/HoeWerktHet';
import { BrancheGrid } from '@/components/BrancheGrid';
import { Reviews } from '@/components/Reviews';
import { BrandStrip } from '@/components/BrandStrip';
import { PortaalUsp } from '@/components/PortaalUsp';
import { CtaBand } from '@/components/CtaBand';

// Merkenlijst en reviews komen uit de database; met ISR is dat een query per uur.
export const revalidate = 3600;

/**
 * Homepage volgens Jessi's werkdocument van 20 okt 2026: kort en zonder dubbele
 * informatie. Weggehaald: "Geen klantenservice. Gewoon Jessi", het
 * spaarprogramma, "We weten wat jouw werk met kleding doet", de
 * pakketsamensteller, het adviesformulier en de veelgestelde vragen.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <BewijsBalk />
      <HoeWerktHet />
      <BrancheGrid />
      <Reviews limit={6} />
      <BrandStrip />
      <PortaalUsp />
      <CtaBand />
    </>
  );
}
