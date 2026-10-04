import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { isPortalConfigured } from '@/lib/env';
import { getPortaalUser } from '@/lib/portaal/queries';
import { getMijnToegang } from '@/lib/portaal/team';
import PortaalNav from '../PortaalNav';
import {
  getMijnWebshopOrganisatie,
  getAssortiment,
  getMijnMedewerker,
  getBudgetVerbruik,
  getWebshopMedewerkers,
  getVoorkeursmaten,
  getPakketten,
  getVerstrekkingen,
  getVerstrektInPeriode,
  getKleurAfbeeldingen,
  type VerstrekkingType,
} from '@/lib/portaal/webshop';
import { getFavorieten } from '@/lib/portaal/favorieten';
import { getServerSupabase } from '@/lib/portaal/supabaseServer';
import WebshopClient from './WebshopClient';
import { bestelPakketActie } from './actions';
import Link from 'next/link';
import { getVertaler } from '@/lib/i18n/portaal/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getVertaler();
  return { title: t('nav.kledingBestellen'), robots: { index: false, follow: false } };
}
export const dynamic = 'force-dynamic';

export default async function Webshop({
  searchParams,
}: {
  searchParams: Promise<{
    ok?: string;
    leeg?: string;
    fout?: string;
    budget?: string;
    pakketok?: string;
    reden?: string;
    herhaal?: string;
    voor?: string;
  }>;
}) {
  const { t, euro } = await getVertaler();
  if (!isPortalConfigured) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">{t('algemeen.nietActiefTitel')}</h1>
          <p className="mt-3 text-sm text-warm">{t('algemeen.nietActiefTekst')}</p>
        </div>
      </main>
    );
  }

  const user = await getPortaalUser();
  if (!user) redirect('/portaal/login');

  const org = await getMijnWebshopOrganisatie();
  if (!org) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">{t('algemeen.nietGekoppeldTitel')}</h1>
          <p className="mt-3 text-sm text-warm">{t('algemeen.nietGekoppeldTekst', { email: user.email ?? '' })}</p>
        </div>
      </main>
    );
  }

  const sp = await searchParams;
  const [eigenMedewerker, toegang, pakketten, kleurAfbeeldingen] = await Promise.all([
    getMijnMedewerker(),
    getMijnToegang(),
    getPakketten(),
    getKleurAfbeeldingen(),
  ]);

  // Geen eigen medewerker-match (bijv. klantbeheerder): laat een medewerker kiezen.
  // Is er via ?voor= een medewerker gekozen, dan zie je precies zijn assortiment
  // (afdeling + vaste kleuren); zonder keuze alles, maar wel in de vaste kleuren.
  const kiesMedewerker = !eigenMedewerker;
  const medewerkers = kiesMedewerker ? await getWebshopMedewerkers() : [];
  const gekozen = kiesMedewerker ? medewerkers.find((m) => m.id === (sp?.voor ?? '').trim()) ?? null : null;
  const assortiment = await getAssortiment(eigenMedewerker ?? gekozen ?? null);
  const mwNaam = (m: { naam: string | null; voornaam?: string | null; achternaam?: string | null; email?: string | null }) =>
    m.naam ?? ([m.voornaam, m.achternaam].filter(Boolean).join(' ') || m.email || t('webshop.medewerker'));

  // Voorkeursmaten alleen bij een eigen medewerker (per product de voorkeursvariant + plus/minus).
  const voorkeursmaten = eigenMedewerker ? await getVoorkeursmaten(eigenMedewerker.id) : {};

  // Resterend budget alleen tonen bij een eigen medewerker met budget en budget_actief.
  let resterendBudget: number | null = null;
  if (org.budget_actief && eigenMedewerker && eigenMedewerker.budget != null) {
    const verbruikt = await getBudgetVerbruik(eigenMedewerker.id);
    resterendBudget = Number(eigenMedewerker.budget) - verbruikt;
  }

  // Verstrekking per artikel voor de webshop: bepaalt welke artikelen (deels) gratis zijn.
  // Per product de resterende vrije ruimte deze periode, zodat het budgetslot in de winkelwagen klopt.
  const verstrekkingen = await getVerstrekkingen();
  const verstrekkingPerProduct: Record<
    string,
    { type: VerstrekkingType; gratisPerPeriode: number | null; periode: string; resterendGratis: number | null }
  > = {};
  for (const [productId, v] of Object.entries(verstrekkingen)) {
    let resterendGratis: number | null = null;
    if (v.verstrekking_type === 'periodiek_gratis') {
      const limiet = v.gratis_per_periode != null && v.gratis_per_periode >= 0 ? v.gratis_per_periode : 0;
      let alGehad = 0;
      if (eigenMedewerker) alGehad = await getVerstrektInPeriode(eigenMedewerker.id, productId, v.periode);
      resterendGratis = Math.max(0, limiet - alGehad);
    }
    verstrekkingPerProduct[productId] = {
      type: v.verstrekking_type,
      gratisPerPeriode: v.gratis_per_periode,
      periode: v.periode,
      resterendGratis,
    };
  }

  const budgetType = eigenMedewerker?.budget_type ?? 'euro';
  const productbudget = eigenMedewerker?.productbudget ?? null;
  const buitenBudgetToegestaan = eigenMedewerker?.buiten_budget_toegestaan ?? false;

  const eigenNaam =
    eigenMedewerker?.naam ??
    ([eigenMedewerker?.voornaam, eigenMedewerker?.achternaam].filter(Boolean).join(' ') || null);

  const favorieten = await getFavorieten(org.id);

  // "Bestel opnieuw" vanaf de bestellingenpagina: de regels van die order voorvullen in de
  // winkelwagen, zodat de gebruiker nog kan controleren of aanpassen voor hij bestelt.
  // RLS borgt dat alleen eigen orders (of die van de eigen organisatie) zichtbaar zijn.
  let herhaalRegels: { variant_id: string | null; item_naam: string; maat: string | null; aantal: number }[] = [];
  const herhaalId = (sp?.herhaal ?? '').trim();
  if (herhaalId) {
    const sb = await getServerSupabase();
    if (sb) {
      const { data: regelData } = await sb
        .from('orderregels')
        .select('variant_id, item_naam, maat, aantal')
        .eq('order_id', herhaalId);
      herhaalRegels = ((regelData as {
        variant_id: string | null;
        item_naam: string;
        maat: string | null;
        aantal: number | null;
      }[]) ?? [])
        .map((r) => ({
          variant_id: r.variant_id,
          item_naam: r.item_naam,
          maat: r.maat,
          aantal: Math.floor(Number(r.aantal) || 0),
        }))
        .filter((r) => r.aantal > 0);
    }
  }

  const startpakketten = pakketten.filter((p) => p.soort === 'start');
  const regulierePakketten = pakketten.filter((p) => p.soort === 'regulier');

  const variantLabel = (maat: string | null, kleur: string | null) =>
    [maat, kleur].filter(Boolean).join(' · ') || t('algemeen.standaard');

  return (
    <main className="container-x py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">{t('algemeen.klantportaal')}</p>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">{t('nav.kledingBestellen')}</h1>
        </div>
      </div>
      <PortaalNav rol={toegang.rol} actief="/portaal/webshop" />

      <p className="mt-6 max-w-2xl text-sm text-warm">
        {t('webshop.intro')}
      </p>

      {kiesMedewerker && (
        <form method="get" className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-white p-4 text-sm text-warm shadow-soft">
          <div className="min-w-[16rem] flex-1">
            <label htmlFor="voor" className="block text-xs font-semibold text-warm">
              {t('webshop.bestellenVoor')}
            </label>
            <select
              id="voor"
              name="voor"
              defaultValue={gekozen?.id ?? ''}
              className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
            >
              <option value="">{t('webshop.geenMedewerkerAlles')}</option>
              {medewerkers.map((m) => (
                <option key={m.id} value={m.id}>
                  {mwNaam(m)}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary">
            {t('webshop.toonAssortiment')}
          </button>
          <p className="w-full text-xs">
            {gekozen
              ? t('webshop.jeZietNu', { naam: mwNaam(gekozen) })
              : t('webshop.kiesMedewerkerUitleg')}
          </p>
        </form>
      )}

      {sp?.ok && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-ink-800">
          {t('webshop.geplaatst')} {org.goedkeuren_bestellingen ? t('webshop.geplaatstWacht') : t('webshop.geplaatstOppakken')}
        </div>
      )}
      {sp?.pakketok && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-ink-800">
          {t('webshop.pakketBesteld')} {org.goedkeuren_bestellingen ? t('webshop.pakketWacht') : t('webshop.pakketOppakken')}
        </div>
      )}
      {sp?.leeg && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-ink-800">
          {t('webshop.wasLeeg')}
        </div>
      )}
      {sp?.budget && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-ink-800">
          {t('webshop.budgetOverschreden')}
        </div>
      )}
      {sp?.reden && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-ink-800">
          {sp.reden}
        </div>
      )}
      {sp?.fout && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-ink-800">
          {t('webshop.foutPlaatsen')}
        </div>
      )}

      {startpakketten.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-extrabold text-ink-900">{t('webshop.startpakket')}</h2>
          <p className="mt-2 max-w-2xl text-sm text-warm">
            {t('webshop.startpakketUitleg')}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {startpakketten.map((p) => (
              <div key={p.id} className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-6 shadow-soft">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-display text-lg font-extrabold text-ink-900">{p.naam}</p>
                  {p.pakketprijs != null && (
                    <span className="font-semibold text-ink-900">{euro(Number(p.pakketprijs))}</span>
                  )}
                </div>
                {p.buiten_budget && (
                  <p className="mt-1 text-xs font-semibold text-amber-700">{t('webshop.teltNietMee')}</p>
                )}
                {p.producten.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm text-warm">
                    {p.producten.map((pp, i) => (
                      <li key={i}>
                        {pp.aantal}x {pp.product_naam}
                        {pp.variant_maat || pp.variant_kleur ? ` (${variantLabel(pp.variant_maat, pp.variant_kleur)})` : ''}
                      </li>
                    ))}
                  </ul>
                )}
                <form action={bestelPakketActie} className="mt-4">
                  <input type="hidden" name="pakket_id" value={p.id} />
                  {kiesMedewerker && (
                    <div className="mb-3">
                      <label htmlFor={`pmw-${p.id}`} className="block text-xs font-semibold text-warm">
                        {t('webshop.bestellenVoorMedewerker')}
                      </label>
                      <select
                        id={`pmw-${p.id}`}
                        name="medewerker_id"
                        defaultValue={gekozen?.id ?? ''}
                        className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
                      >
                        <option value="">{t('webshop.geenMedewerker')}</option>
                        {medewerkers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.naam ?? ([m.voornaam, m.achternaam].filter(Boolean).join(' ') || m.email)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <button type="submit" className="btn-primary w-full">
                    {t('webshop.startpakketBestellen')}
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}

      {regulierePakketten.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-extrabold text-ink-900">{t('webshop.pakketten')}</h2>
          <p className="mt-2 max-w-2xl text-sm text-warm">
            {t('webshop.pakkettenUitleg')}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {regulierePakketten.map((p) => (
              <div key={p.id} className="rounded-2xl border border-line bg-white p-6 shadow-soft">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-ink-900">{p.naam}</p>
                  {p.pakketprijs != null && (
                    <span className="font-semibold text-ink-900">{euro(Number(p.pakketprijs))}</span>
                  )}
                </div>
                {p.buiten_budget && (
                  <p className="mt-1 text-xs font-semibold text-amber-700">{t('webshop.teltNietMee')}</p>
                )}
                {p.producten.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm text-warm">
                    {p.producten.map((pp, i) => (
                      <li key={i}>
                        {pp.aantal}x {pp.product_naam}
                        {pp.variant_maat || pp.variant_kleur ? ` (${variantLabel(pp.variant_maat, pp.variant_kleur)})` : ''}
                      </li>
                    ))}
                  </ul>
                )}
                <form action={bestelPakketActie} className="mt-4">
                  <input type="hidden" name="pakket_id" value={p.id} />
                  {kiesMedewerker && (
                    <div className="mb-3">
                      <label htmlFor={`pmwr-${p.id}`} className="block text-xs font-semibold text-warm">
                        {t('webshop.bestellenVoorMedewerker')}
                      </label>
                      <select
                        id={`pmwr-${p.id}`}
                        name="medewerker_id"
                        defaultValue={gekozen?.id ?? ''}
                        className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
                      >
                        <option value="">{t('webshop.geenMedewerker')}</option>
                        {medewerkers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.naam ?? ([m.voornaam, m.achternaam].filter(Boolean).join(' ') || m.email)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <button type="submit" className="btn-primary w-full">
                    {t('webshop.pakketBestellen')}
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}

      <WebshopClient
        producten={assortiment}
        budgetActief={org.budget_actief}
        resterendBudget={resterendBudget}
        budgetType={budgetType}
        productbudget={productbudget}
        buitenBudgetToegestaan={buitenBudgetToegestaan}
        voorkeursmaten={voorkeursmaten}
        toonVoorraad={org.toon_voorraad}
        gebruikReferentienr={org.gebruik_referentienr}
        opmerkingBijBestelling={org.opmerking_bij_bestelling}
        minBestelbedrag={org.min_bestelbedrag}
        maxBestelbedrag={org.max_bestelbedrag}
        eigenMedewerkerNaam={eigenNaam}
        kiesMedewerker={kiesMedewerker}
        medewerkers={medewerkers}
        gekozenMedewerkerId={gekozen?.id ?? null}
        verstrekkingen={verstrekkingPerProduct}
        kortingPct={org.korting_pct}
        kleurAfbeeldingen={kleurAfbeeldingen}
        favorieten={favorieten}
        herhaalRegels={herhaalRegels}
      />

      <section className="mt-12">
        <h2 className="font-display text-xl font-extrabold text-ink-900">{t('webshop.jeBestellingen')}</h2>
        <p className="mt-2 max-w-2xl text-sm text-warm">
          {t('webshop.jeBestellingenUitleg')}
        </p>
        <Link href="/portaal/bestellingen" className="btn-primary mt-4 inline-flex">
          {t('webshop.bekijkBestellingen')}
        </Link>
      </section>
    </main>
  );
}
