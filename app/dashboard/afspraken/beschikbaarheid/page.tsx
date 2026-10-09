import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { laadPlanner } from '@/lib/afspraken/planner';
import { maandagVan, plusDagen, vandaagNl, isDatum } from '@/app/dashboard/taken/tijd';
import PaginaKop from '@/components/dashboard/ui/PaginaKop';
import { BeschikbaarheidPlanner } from './BeschikbaarheidPlanner';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Beschikbaarheid', robots: { index: false, follow: false } };

/**
 * Snel je agenda voor online afspraken openen en dichtzetten. Eén week per
 * scherm; op de telefoon één dag tegelijk. Een tik op een tijd zet hem dicht of
 * open; de boekpagina rekent er meteen mee.
 */
export default async function BeschikbaarheidPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const { week } = await searchParams;
  const vandaag = vandaagNl();
  // In het weekend is deze week voorbij: dan begin je bij de komende week.
  const dag = new Date(`${vandaag}T12:00:00Z`).getUTCDay();
  const deze = dag === 0 || dag === 6 ? maandagVan(plusDagen(vandaag, 2)) : maandagVan(vandaag);
  const maandag = week && isDatum(week) ? maandagVan(week) : deze;
  const planner = await laadPlanner(maandag, 7);

  return (
    <main className="container-app py-6">
      <PaginaKop
        titel="Beschikbaarheid"
        sub="Tik op een tijd om hem dicht of open te zetten. Klanten kunnen alleen de groene tijden boeken."
        acties={
          <>
            <Link href="/dashboard/afspraken" className="knop-stil">Afspraken</Link>
            <Link href="/dashboard/afspraken/instellingen" className="knop-stil">Vaste werktijden</Link>
          </>
        }
      />
      <BeschikbaarheidPlanner
        planner={planner}
        vandaag={vandaag}
        maandag={maandag}
        vorige={maandag > deze ? plusDagen(maandag, -7) : null}
        volgende={plusDagen(maandag, 7)}
        dezeWeek={deze}
      />
    </main>
  );
}
