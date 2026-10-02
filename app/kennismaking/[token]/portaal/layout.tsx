import type { CSSProperties, ReactNode } from 'react';
import type { Metadata } from 'next';
import { laadDemo, vereisDemo, demoPaden } from '@/lib/prospect/demo/laad';
import DemoProvider from '@/components/kennismaking/demo/DemoProvider';
import DemoKop from '@/components/kennismaking/demo/DemoKop';
import DemoNav from '@/components/kennismaking/demo/DemoNav';
import Rondleiding from '@/components/kennismaking/demo/Rondleiding';

/**
 * Voorbeeldportaal voor een prospect (QR uit de brief). Publiek, geen login, niet indexeren.
 * Alle data komt uit haalKennismaking(token) plus deterministische nepdata; interacties
 * blijven lokaal in de browser.
 */

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { token } = await params;
  const demo = await laadDemo(token);
  return {
    title: demo
      ? { default: `Voorbeeldportaal ${demo.bedrijfsnaam}`, template: `%s | Voorbeeldportaal ${demo.bedrijfsnaam}` }
      : 'Voorbeeldportaal',
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
    referrer: 'no-referrer',
  };
}

export default async function VoorbeeldportaalLayout({ children, params }: Params & { children: ReactNode }) {
  const { token } = await params;
  const demo = await vereisDemo(token);
  const paden = demoPaden(demo.token);
  const stijl = {
    '--demo-accent': demo.accent.accent,
    '--demo-op-accent': demo.accent.opAccent,
    '--demo-accent-tekst': demo.accent.accentTekst,
    '--demo-accent-zacht': demo.accent.accentZacht,
  } as CSSProperties;

  return (
    <div style={stijl} className="min-h-screen bg-mist">
      <DemoKop bedrijfsnaam={demo.bedrijfsnaam} logoUrl={demo.logoUrl} kennismakingHref={paden.kennismaking} pasdagHref={paden.pasdag} />
      <DemoProvider data={demo} paden={paden}>
        <div className="border-b border-line bg-white">
          <div className="container-x">
            <DemoNav />
          </div>
        </div>
        <div className="container-x pb-16 pt-8 sm:pt-10">{children}</div>
        <Rondleiding />
      </DemoProvider>
    </div>
  );
}
