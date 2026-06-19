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
import WebshopClient from './WebshopClient';
import { bestelPakketActie } from './actions';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Kleding bestellen', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const euro = (n: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n || 0);

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
  }>;
}) {
  if (!isPortalConfigured) {
    return (
      <main className="container-x py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Klantportaal nog niet actief</h1>
          <p className="mt-3 text-sm text-warm">Het portaal staat nog niet aan. Neem contact op met Frederiks Bedrijfskleding.</p>
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
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Je account is nog niet gekoppeld</h1>
          <p className="mt-3 text-sm text-warm">Je bent ingelogd als {user.email}, maar dit adres hangt nog niet aan een bedrijf. Neem contact op met Frederiks Bedrijfskleding.</p>
        </div>
      </main>
    );
  }

  const sp = await searchParams;
  const [assortiment, eigenMedewerker, toegang, pakketten, kleurAfbeeldingen] = await Promise.all([
    getAssortiment(),
    getMijnMedewerker(),
    getMijnToegang(),
    getPakketten(),
    getKleurAfbeeldingen(),
  ]);

  // Geen eigen medewerker-match (bijv. klantbeheerder): laat een medewerker kiezen.
  const kiesMedewerker = !eigenMedewerker;
  const medewerkers = kiesMedewerker ? await getWebshopMedewerkers() : [];

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

  const startpakketten = pakketten.filter((p) => p.soort === 'start');
  const regulierePakketten = pakketten.filter((p) => p.soort === 'regulier');

  const variantLabel = (maat: string | null, kleur: string | null) =>
    [maat, kleur].filter(Boolean).join(' · ') || 'Standaard';

  return (
    <main className="container-x py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">Klantportaal</p>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">Kleding bestellen</h1>
        </div>
      </div>
      <PortaalNav rol={toegang.rol} actief="/portaal/webshop" />

      <p className="mt-6 max-w-2xl text-sm text-warm">
        Kies je producten, stel je winkelwagen samen en plaats je bestelling. We zetten hem klaar in het systeem en handelen de levering met je af.
      </p>

      {kiesMedewerker && (
        <div className="mt-6 rounded-xl border border-line bg-white p-4 text-sm text-warm shadow-soft">
          Je e-mailadres is niet aan een medewerker gekoppeld. Je kunt in de winkelwagen kiezen voor wie je bestelt, of zonder medewerker bestellen.
        </div>
      )}

      {sp?.ok && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-ink-800">
          Je bestelling is geplaatst. {org.goedkeuren_bestellingen ? 'Hij wacht nu op goedkeuring.' : 'We pakken hem op.'}
        </div>
      )}
      {sp?.pakketok && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-ink-800">
          Je pakket is besteld. {org.goedkeuren_bestellingen ? 'Het wacht nu op goedkeuring.' : 'We pakken het op.'}
        </div>
      )}
      {sp?.leeg && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-ink-800">
          Je winkelwagen was leeg. Voeg eerst een product toe.
        </div>
      )}
      {sp?.budget && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-ink-800">
          Het totaal was hoger dan het resterende budget. Pas de winkelwagen aan en probeer het opnieuw.
        </div>
      )}
      {sp?.reden && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-ink-800">
          {sp.reden}
        </div>
      )}
      {sp?.fout && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-ink-800">
          Er ging iets mis bij het plaatsen. Probeer het zo nog eens of bel ons even.
        </div>
      )}

      {startpakketten.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-extrabold text-ink-900">Startpakket</h2>
          <p className="mt-2 max-w-2xl text-sm text-warm">
            Begin met je startpakket. Dit basispakket bestel je eerst, daarna kun je losse artikelen bijbestellen.
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
                  <p className="mt-1 text-xs font-semibold text-amber-700">Telt niet mee in je budget</p>
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
                        Bestellen voor medewerker
                      </label>
                      <select
                        id={`pmw-${p.id}`}
                        name="medewerker_id"
                        defaultValue=""
                        className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
                      >
                        <option value="">Geen specifieke medewerker</option>
                        {medewerkers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.naam ?? ([m.voornaam, m.achternaam].filter(Boolean).join(' ') || m.email)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <button type="submit" className="btn-primary w-full">
                    Startpakket bestellen
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}

      {regulierePakketten.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-extrabold text-ink-900">Pakketten</h2>
          <p className="mt-2 max-w-2xl text-sm text-warm">
            Bestel een compleet pakket in één keer voor een vaste prijs.
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
                  <p className="mt-1 text-xs font-semibold text-amber-700">Telt niet mee in je budget</p>
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
                        Bestellen voor medewerker
                      </label>
                      <select
                        id={`pmwr-${p.id}`}
                        name="medewerker_id"
                        defaultValue=""
                        className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
                      >
                        <option value="">Geen specifieke medewerker</option>
                        {medewerkers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.naam ?? ([m.voornaam, m.achternaam].filter(Boolean).join(' ') || m.email)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <button type="submit" className="btn-primary w-full">
                    Pakket bestellen
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
        verstrekkingen={verstrekkingPerProduct}
        kortingPct={org.korting_pct}
        kleurAfbeeldingen={kleurAfbeeldingen}
        favorieten={favorieten}
      />

      <section className="mt-12">
        <h2 className="font-display text-xl font-extrabold text-ink-900">Je bestellingen</h2>
        <p className="mt-2 max-w-2xl text-sm text-warm">
          Bekijk de status en details van al je bestellingen op één plek.
        </p>
        <Link href="/portaal/bestellingen" className="btn-primary mt-4 inline-flex">
          Bekijk mijn bestellingen
        </Link>
      </section>
    </main>
  );
}
