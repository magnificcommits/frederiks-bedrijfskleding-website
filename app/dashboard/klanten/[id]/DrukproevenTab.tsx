import Link from 'next/link';
import { Suspense } from 'react';
import { DRUKPROEF_STATUSSEN, DRUKPROEF_STATUS_LABEL, drukproefContext, listDrukproevenVoorKlant, staatLangOpen } from '@/lib/kms/drukproeven';
import DrukproefKaart from '@/app/dashboard/drukproeven/DrukproefKaart';
import ProefMelding from '@/app/dashboard/drukproeven/ProefMelding';

/**
 * Tabblad Drukproeven op de klantkaart: alle proeven van deze klant met status,
 * plaatje, artikel en order. Nieuwe proef, versturen en goedkeuren kan hier
 * direct; na elke actie kom je terug op dit tabblad.
 */
export default async function DrukproevenTab({ orgId, orgNaam }: { orgId: string; orgNaam: string }) {
  const terug = `/dashboard/klanten/${orgId}?tab=drukproeven`;
  const proeven = await listDrukproevenVoorKlant(orgId);
  const ctx = await drukproefContext(proeven);
  const adressen = ctx.adressen.get(orgId) ?? [];
  const perStatus: Record<string, number> = {};
  for (const p of proeven) perStatus[p.status] = (perStatus[p.status] ?? 0) + 1;
  const langOpen = proeven.filter(staatLangOpen).length;
  const nieuwHref = `/dashboard/drukproeven/nieuw?org=${orgId}&terug=${encodeURIComponent(terug)}`;

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-ink-900">Drukproeven</h2>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-warm">
            {proeven.length === 0 ? (
              <span>Nog geen drukproeven voor {orgNaam}.</span>
            ) : (
              DRUKPROEF_STATUSSEN.filter((s) => perStatus[s]).map((s) => (
                <span key={s}>
                  {DRUKPROEF_STATUS_LABEL[s]}: <span className="font-semibold text-ink-800">{perStatus[s]}</span>
                </span>
              ))
            )}
            {langOpen > 0 && <span className="font-semibold text-amber-800">{langOpen} ligt langer dan 3 dagen bij de klant</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {proeven.length > 0 && (
            <Link href={`/dashboard/drukproeven?org=${orgId}`} className="knop-stil">Afdrukvel maken</Link>
          )}
          <Link href={nieuwHref} className="knop-primair">Nieuwe drukproef</Link>
        </div>
      </div>

      <Suspense fallback={null}>
        <ProefMelding />
      </Suspense>

      {proeven.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-line bg-mist px-5 py-8 text-center">
          <p className="text-sm text-warm">Kies een kledingstuk uit het assortiment, zet het logo erop en stuur de proef ter goedkeuring.</p>
          <Link href={nieuwHref} className="mt-3 inline-block knop-donker">Eerste drukproef maken</Link>
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {proeven.map((d) => (
            <DrukproefKaart
              key={d.id}
              d={d}
              artikelNaam={d.product_id ? ctx.artikel.get(d.product_id) ?? null : null}
              ordernummer={d.order_id ? ctx.ordernummer.get(d.order_id) ?? null : null}
              adressen={adressen}
              terug={terug}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
