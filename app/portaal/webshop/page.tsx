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
  getWebshopOrders,
} from '@/lib/portaal/webshop';
import WebshopClient from './WebshopClient';

export const metadata: Metadata = { title: 'Webshop', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const euro = (n: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n || 0);

const statusLabel: Record<string, string> = {
  concept: 'Concept',
  nog_bestellen: 'Nog bestellen',
  besteld: 'Besteld',
  binnen: 'Binnen',
  geleverd: 'Geleverd',
  geannuleerd: 'Geannuleerd',
};

const goedkeuringLabel: Record<string, string> = {
  wacht: 'Wacht op goedkeuring',
  goedgekeurd: 'Goedgekeurd',
  afgewezen: 'Afgewezen',
  afgekeurd: 'Afgekeurd',
  niet_nodig: '',
};

export default async function Webshop({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; leeg?: string; fout?: string; budget?: string }>;
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
  const [assortiment, eigenMedewerker, orders, toegang] = await Promise.all([
    getAssortiment(),
    getMijnMedewerker(),
    getWebshopOrders(),
    getMijnToegang(),
  ]);

  // Geen eigen medewerker-match (bijv. klantbeheerder): laat een medewerker kiezen.
  const kiesMedewerker = !eigenMedewerker;
  const medewerkers = kiesMedewerker ? await getWebshopMedewerkers() : [];

  // Resterend budget alleen tonen bij een eigen medewerker met budget en budget_actief.
  let resterendBudget: number | null = null;
  if (org.budget_actief && eigenMedewerker && eigenMedewerker.budget != null) {
    const verbruikt = await getBudgetVerbruik(eigenMedewerker.id);
    resterendBudget = Number(eigenMedewerker.budget) - verbruikt;
  }

  const eigenNaam =
    eigenMedewerker?.naam ??
    ([eigenMedewerker?.voornaam, eigenMedewerker?.achternaam].filter(Boolean).join(' ') || null);

  return (
    <main className="container-x py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">Klantportaal</p>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">Webshop</h1>
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
      {sp?.fout && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-ink-800">
          Er ging iets mis bij het plaatsen. Probeer het zo nog eens of bel ons even.
        </div>
      )}

      <WebshopClient
        producten={assortiment}
        budgetActief={org.budget_actief}
        resterendBudget={resterendBudget}
        eigenMedewerkerNaam={eigenNaam}
        kiesMedewerker={kiesMedewerker}
        medewerkers={medewerkers}
      />

      <section className="mt-12">
        <h2 className="font-display text-xl font-extrabold text-ink-900">Bestelhistorie</h2>
        {orders.length === 0 ? (
          <p className="mt-3 text-sm text-warm">Er zijn nog geen bestellingen.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
            {orders.map((o, idx) => {
              const goed = o.goedkeuring_status ? goedkeuringLabel[o.goedkeuring_status] ?? o.goedkeuring_status : '';
              return (
                <div key={o.id} className={`flex flex-wrap items-center justify-between gap-3 p-5 ${idx > 0 ? 'border-t border-line' : ''}`}>
                  <div>
                    <p className="text-sm font-semibold text-ink-900">
                      {new Date(o.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    <p className="mt-1 text-xs text-warm">
                      {statusLabel[o.status ?? ''] ?? o.status ?? 'Onbekend'}
                      {goed ? ` · ${goed}` : ''}
                    </p>
                  </div>
                  <span className="font-semibold text-ink-900">{euro(Number(o.bedrag) || 0)}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
