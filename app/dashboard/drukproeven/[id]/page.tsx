import Link from 'next/link';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { artikelVoorDrukproef, getDrukproef, listArtikelenVoorDrukproef, listLogosVoorDrukproef } from '@/lib/kms/drukproeven';
import EmptyState from '@/components/dashboard/EmptyState';
import DrukproefEditor from '../DrukproefEditor';
import { normaliseerOntwerp } from '../ontwerp';
import { veiligTerugPad } from '../terug';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Drukproef bewerken', robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS: Record<string, string> = { concept: 'Concept', verstuurd: 'Ter goedkeuring', goedgekeurd: 'Goedgekeurd', afgekeurd: 'Afgekeurd' };

export default async function DrukproefBewerkenPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ terug?: string }> }) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const { id } = await params;
  const terug = veiligTerugPad((await searchParams).terug);
  const dp = UUID.test(id) ? await getDrukproef(id) : null;
  if (!dp) {
    return (
      <main className="container-app py-6">
        <EmptyState titel="Drukproef niet gevonden" tekst="Deze drukproef bestaat niet (meer)." actieHref="/dashboard/drukproeven" actieLabel="Terug naar drukproeven" />
      </main>
    );
  }

  const ontwerp = normaliseerOntwerp(dp.ontwerp);
  const [assortiment, logos, artikel] = await Promise.all([
    listArtikelenVoorDrukproef(dp.organisatie_id),
    listLogosVoorDrukproef(dp.organisatie_id),
    dp.product_id ? artikelVoorDrukproef(dp.product_id, dp.product_kleur ?? null) : Promise.resolve(null),
  ]);
  const klantNaam = dp.organisatie_naam ?? 'de klant';

  return (
    <main className="container-app py-6">
      <div className="dash-kop flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="dash-h1">{dp.naam}</h1>
          <p className="dash-sub">
            Drukproef voor {klantNaam} · {STATUS[dp.status] ?? dp.status}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/dashboard/drukproeven/afdrukken?org=${dp.organisatie_id}&id=${dp.id}`} className="knop-stil">Afdrukken</Link>
          {dp.order_id && <Link href={`/dashboard/orders/${dp.order_id}`} className="knop-stil">Naar de order</Link>}
          <Link href={terug ?? `/dashboard/drukproeven?org=${dp.organisatie_id}`} className="text-sm font-semibold text-warm hover:text-ink-800">{terug ? 'Terug' : 'Terug naar drukproeven'}</Link>
        </div>
      </div>
      {dp.opmerking && (dp.status === 'goedgekeurd' || dp.status === 'afgekeurd') && (
        <p className="mt-4 rounded-lg border border-line bg-mist px-4 py-3 text-sm text-ink-800">
          <span className="font-semibold">Reactie van de klant:</span> {dp.opmerking}
        </p>
      )}
      <div className="mt-6">
        <DrukproefEditor
          orgId={dp.organisatie_id}
          klantNaam={klantNaam}
          orderId={dp.order_id}
          assortiment={assortiment}
          logos={logos}
          terug={terug}
          bestaand={{
            id: dp.id,
            naam: dp.naam,
            status: dp.status,
            artikel,
            voor_url: dp.afbeelding_url,
            achter_url: dp.achter_afbeelding_url ?? null,
            ontwerp: ontwerp ?? { voor: [], achter: [] },
            techniek: dp.techniek,
            // Bij oude proeven was 'kleur' de kleur van het getekende shirt, geen aantal drukkleuren.
            drukkleuren: ontwerp ? dp.kleur : 0,
            omschrijving: dp.omschrijving ?? '',
            oudeMaker: !ontwerp,
          }}
        />
      </div>
    </main>
  );
}
