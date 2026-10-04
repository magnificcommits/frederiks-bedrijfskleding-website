import { redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { telOpenAanvragen } from '@/lib/kms/sparenData';
import SparenTabs from './SparenTabs';

export const dynamic = 'force-dynamic';

export default async function SparenLayout({ children }: { children: React.ReactNode }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const open = await telOpenAanvragen();

  return (
    <main className="container-app pb-12">
      <div className="dash-kop flex-col items-stretch gap-0 pb-0">
        <div className="flex items-center justify-between gap-4 pt-1">
          <h1 className="dash-h1">Sparen</h1>
          <p className="hidden text-[12px] text-warm sm:block">Klantenbinding: punten, niveaus en beloningen</p>
        </div>
        <SparenTabs openAanvragen={open} />
      </div>
      {children}
    </main>
  );
}
