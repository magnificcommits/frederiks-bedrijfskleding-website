import Link from 'next/link';
import Drawer from '@/components/dashboard/Drawer';
import { gebruikTelling, logoStaat, type Logo } from '@/lib/kms/logos';
import LogoKaart from '@/app/dashboard/logos/LogoKaart';
import NieuwLogoFormulier from '@/app/dashboard/logos/NieuwLogoFormulier';

/**
 * Tabblad Logo's op de klantkaart: dezelfde tegels als de logobibliotheek,
 * met wat er nog ontbreekt voor de productie. Klik op een logo voor bestanden,
 * kleuren, posities en waar het gebruikt wordt.
 */
export default async function LogosTab({ orgId, orgNaam, logos }: { orgId: string; orgNaam: string; logos: Logo[] }) {
  const terug = `/dashboard/klanten/${orgId}?tab=logos`;
  const gebruik = await gebruikTelling(logos);
  const zonderVector = logos.filter((l) => !logoStaat(l).heeftVector).length;

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-ink-900">Logo&apos;s</h2>
          <p className="mt-1 text-[13px] text-warm">
            {logos.length === 0
              ? `Nog geen logo's voor ${orgNaam}.`
              : `${logos.length} logo${logos.length === 1 ? '' : "'s"}${zonderVector ? `, waarvan ${zonderVector} zonder vectorbestand` : ', allemaal met vectorbestand'}.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/dashboard/drukproeven/nieuw?org=${orgId}&terug=${encodeURIComponent(`/dashboard/klanten/${orgId}?tab=drukproeven`)}`} className="knop-stil">
            Drukproef maken
          </Link>
          <Drawer knop="Logo toevoegen" titel={`Logo toevoegen voor ${orgNaam}`} beschrijving="Upload de bestanden, of plak een link als alternatief.">
            <NieuwLogoFormulier orgId={orgId} terug={terug} />
          </Drawer>
        </div>
      </div>

      {logos.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line bg-mist px-5 py-6 text-center text-sm text-warm">
          Voeg het eerste logo toe. Met een vectorbestand en een plaatje erbij kun je meteen een drukproef maken.
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {logos.map((l) => (
            <LogoKaart key={l.id} logo={l} gebruik={gebruik[l.id]} terug={terug} />
          ))}
        </ul>
      )}
      <p className="mt-3 text-[13px] text-warm">
        Alle logo&apos;s van alle klanten staan ook in de{' '}
        <Link href="/dashboard/logos?tab=bibliotheek" className="font-semibold text-amber-700 hover:text-amber-800">logobibliotheek</Link>.
      </p>
    </section>
  );
}
