import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed, kmsAdmin } from '@/lib/kms/adminClient';
import { listArtikelenVoorDrukproef, listLogosVoorDrukproef } from '@/lib/kms/drukproeven';
import EmptyState from '@/components/dashboard/EmptyState';
import DrukproefEditor from '../DrukproefEditor';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Nieuwe drukproef', robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function NieuweDrukproefPage({ searchParams }: { searchParams: Promise<{ org?: string; order?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const { org, order } = await searchParams;
  const sb = kmsAdmin();
  if (!sb || !org || !UUID.test(org)) redirect('/dashboard/drukproeven');

  const { data } = await sb.from('organisaties').select('id, naam').eq('id', org).maybeSingle();
  const klant = data as { id: string; naam: string } | null;
  if (!klant) {
    return (
      <main className="container-app py-6">
        <EmptyState titel="Klant niet gevonden" tekst="Deze klant bestaat niet (meer)." actieHref="/dashboard/drukproeven" actieLabel="Terug naar drukproeven" />
      </main>
    );
  }

  const orderId = order && UUID.test(order) ? order : null;
  const [assortiment, logos] = await Promise.all([listArtikelenVoorDrukproef(klant.id), listLogosVoorDrukproef(klant.id)]);

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="dash-h1">Nieuwe drukproef voor {klant.naam}</h1>
          <p className="dash-sub">Volg de drie stappen hieronder. Niets wordt bewaard tot je op opslaan klikt.</p>
        </div>
        <Link href={`/dashboard/drukproeven?org=${klant.id}`} className="text-sm font-semibold text-warm hover:text-ink-800">Terug naar drukproeven</Link>
      </div>
      <div className="mt-6">
        <DrukproefEditor orgId={klant.id} klantNaam={klant.naam} orderId={orderId} assortiment={assortiment} logos={logos} />
      </div>
    </main>
  );
}
