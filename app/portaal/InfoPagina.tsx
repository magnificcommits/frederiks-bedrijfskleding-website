import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getPortaalUser } from '@/lib/portaal/queries';
import { getMijnToegang } from '@/lib/portaal/team';
import { getVertaler } from '@/lib/i18n/portaal/server';
import PortaalNav from './PortaalNav';

/** Kader voor de vaste infopagina's van het portaal (Zo werkt het, Wasvoorschriften). */
export default async function InfoPagina({ titel, pad, children }: { titel: string; pad: string; children: ReactNode }) {
  const user = await getPortaalUser();
  if (!user) redirect('/portaal/login');
  const [toegang, { t }] = await Promise.all([getMijnToegang(), getVertaler()]);
  return (
    <main className="container-x py-12">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">{t('algemeen.klantportaal')}</p>
      <h1 className="font-display text-3xl font-extrabold text-ink-900">{titel}</h1>
      <PortaalNav rol={toegang.rol} actief={pad} />
      <div className="mt-8 max-w-3xl">{children}</div>
    </main>
  );
}
