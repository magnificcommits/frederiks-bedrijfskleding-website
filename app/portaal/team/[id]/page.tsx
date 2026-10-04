import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { isPortalConfigured } from '@/lib/env';
import { getPortaalUser, getMijnOrganisatie } from '@/lib/portaal/queries';
import {
  getMijnToegang,
  getMedewerkerDetail,
  listVestigingen,
  listProductenVoorMaten,
  getVoorkeursmaten,
} from '@/lib/portaal/team';
import PortaalNav from '../../PortaalNav';
import { zetBudgetInstellingenAction, zetVoorkeursmaatAction, verwijderVoorkeursmaatAction } from './actions';
import { getVertaler } from '@/lib/i18n/portaal/server';
import type { Sleutel } from '@/lib/i18n/portaal/nl';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getVertaler();
  return { title: t('nav.medewerkerInstellingen'), robots: { index: false, follow: false } };
}
export const dynamic = 'force-dynamic';

const veld =
  'mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200';
const label = 'block text-sm font-semibold text-ink-900';

const meldingen: Record<string, { soort: 'ok' | 'fout'; tekst: Sleutel }> = {
  budget: { soort: 'ok', tekst: 'medewerker.okBudget' },
  maat: { soort: 'ok', tekst: 'medewerker.okMaat' },
  maat_weg: { soort: 'ok', tekst: 'medewerker.okMaatWeg' },
  opslaan: { soort: 'fout', tekst: 'algemeen.foutOpslaan' },
};

export default async function MedewerkerInstellingen({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; fout?: string }>;
}) {
  const { t } = await getVertaler();
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
  const org = await getMijnOrganisatie();
  if (!org) redirect('/portaal');

  const toegang = await getMijnToegang();
  if (toegang.rol !== 'beheerder') redirect('/portaal/medewerkers');

  const { id } = await params;
  const medewerker = await getMedewerkerDetail(id);
  if (!medewerker) {
    return (
      <main className="container-x py-12">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">{t('algemeen.klantportaal')}</p>
        <h1 className="font-display text-3xl font-extrabold text-ink-900">{t('medewerker.nietGevonden')}</h1>
        <PortaalNav rol={toegang.rol} actief="/portaal/team" />
        <div className="mt-8 max-w-xl rounded-2xl border border-line bg-white p-6 shadow-soft">
          <p className="text-sm text-warm">{t('medewerker.nietGevondenTekst')}</p>
          <Link href="/portaal/medewerkers" className="mt-4 inline-block text-sm font-semibold text-warm hover:text-ink-800">
            {t('medewerker.terug')}
          </Link>
        </div>
      </main>
    );
  }

  const [vestigingen, producten, voorkeursmaten] = await Promise.all([
    listVestigingen(),
    listProductenVoorMaten(),
    getVoorkeursmaten(id),
  ]);
  const maatPerProduct = new Map(voorkeursmaten.map((v) => [v.productId, v]));

  const sp = await searchParams;
  const melding = sp?.ok ? meldingen[sp.ok] : sp?.fout ? meldingen[sp.fout] : null;
  const isPunten = medewerker.budgetType === 'punten';
  const eenheid = isPunten ? t('medewerker.eenheidPunten') : t('medewerker.eenheidEuro');

  return (
    <main className="container-x py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">{t('algemeen.klantportaal')}</p>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">{medewerker.naam}</h1>
          <p className="mt-1 text-sm text-warm">
            {[medewerker.functie, medewerker.email].filter(Boolean).join(' · ') || t('medewerker.geenContact')}
          </p>
        </div>
        <Link href="/portaal/medewerkers" className="text-sm font-semibold text-warm hover:text-ink-800">
          {t('medewerker.terug')}
        </Link>
      </div>
      <PortaalNav rol={toegang.rol} actief="/portaal/team" />

      {melding && (
        <div
          className={`mt-6 rounded-xl border p-4 text-sm ${
            melding.soort === 'ok'
              ? 'border-green-300 bg-green-50 text-green-800'
              : 'border-amber-300 bg-amber-50 text-ink-800'
          }`}
        >
          {t(melding.tekst)}
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Budgetinstellingen */}
        <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="font-display text-lg font-extrabold text-ink-900">{t('medewerker.budgetInstellingen')}</h2>
          <p className="mt-1 text-sm text-warm">
            {t('medewerker.budgetUitleg')}
          </p>
          <form action={zetBudgetInstellingenAction} className="mt-5 space-y-4">
            <input type="hidden" name="medewerker_id" value={medewerker.id} />

            <div>
              <label className={label}>{t('medewerker.budgetsoort')}</label>
              <select name="budget_type" defaultValue={medewerker.budgetType} className={veld}>
                <option value="euro">{t('medewerker.euro')}</option>
                <option value="punten">{t('medewerker.punten')}</option>
              </select>
              <p className="mt-1 text-xs text-warm">
                {t('medewerker.puntenUitleg')}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={label}>{t('medewerker.startbudget', { eenheid })}</label>
                <input
                  name="startbudget"
                  defaultValue={medewerker.startbudget ?? ''}
                  inputMode="decimal"
                  placeholder={t('medewerkers.budgetPlaceholder')}
                  className={veld}
                />
              </div>
              <div>
                <label className={label}>{t('medewerker.huidigBudget', { eenheid })}</label>
                <input
                  name="budget"
                  defaultValue={medewerker.budget ?? ''}
                  inputMode="decimal"
                  placeholder={t('medewerkers.budgetPlaceholder')}
                  className={veld}
                />
                <p className="mt-1 text-xs text-warm">{t('medewerker.saldoUitleg')}</p>
              </div>
            </div>

            <div>
              <label className={label}>{t('medewerker.productbudget')}</label>
              <input
                name="productbudget"
                defaultValue={medewerker.productbudget ?? ''}
                inputMode="numeric"
                placeholder={t('medewerker.productbudgetPlaceholder')}
                className={veld}
              />
              <p className="mt-1 text-xs text-warm">{t('medewerker.productbudgetUitleg')}</p>
            </div>

            <label className="flex items-start gap-2 text-sm text-ink-800">
              <input
                type="checkbox"
                name="buiten_budget_toegestaan"
                defaultChecked={medewerker.buitenBudgetToegestaan}
                className="mt-0.5 h-4 w-4 rounded border-line text-amber-700 focus:ring-amber-200"
              />
              <span>{t('medewerker.buitenBudget')}</span>
            </label>

            <div className="border-t border-line pt-4">
              <p className="text-sm font-semibold text-ink-900">{t('medewerker.periodiek')}</p>
              <p className="mt-0.5 text-xs text-warm">{t('medewerker.periodiekUitleg')}</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={label}>{t('medewerker.aanvulling', { eenheid })}</label>
                  <input
                    name="periodiek_budget"
                    defaultValue={medewerker.periodiekBudget ?? ''}
                    inputMode="decimal"
                    placeholder={t('medewerker.aanvullingPlaceholder')}
                    className={veld}
                  />
                </div>
                <div>
                  <label className={label}>{t('medewerker.periode')}</label>
                  <select name="budget_periode" defaultValue={medewerker.budgetPeriode} className={veld}>
                    <option value="geen">{t('medewerker.geenAanvulling')}</option>
                    <option value="maand">{t('medewerker.perMaand')}</option>
                    <option value="kwartaal">{t('medewerker.perKwartaal')}</option>
                    <option value="jaar">{t('medewerker.perJaar')}</option>
                  </select>
                </div>
              </div>
              <label className="mt-3 flex items-start gap-2 text-sm text-ink-800">
                <input
                  type="checkbox"
                  name="behoud_restbudget"
                  defaultChecked={medewerker.behoudRestbudget}
                  className="mt-0.5 h-4 w-4 rounded border-line text-amber-700 focus:ring-amber-200"
                />
                <span>{t('medewerker.restbudgetMee')}</span>
              </label>
            </div>

            <div className="border-t border-line pt-4">
              <label className={label}>{t('medewerker.vestiging')}</label>
              <select name="vestiging_id" defaultValue={medewerker.vestigingId ?? ''} className={veld}>
                <option value="">{t('medewerker.geenVestiging')}</option>
                {vestigingen.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.naam}
                  </option>
                ))}
              </select>
              {vestigingen.length === 0 && (
                <p className="mt-1 text-xs text-warm">{t('medewerker.geenVestigingen')}</p>
              )}
            </div>

            <button className="btn-primary w-full justify-center">{t('medewerker.budgetOpslaan')}</button>
          </form>
        </section>

        {/* Voorkeursmaten */}
        <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h2 className="font-display text-lg font-extrabold text-ink-900">{t('medewerker.voorkeursmaten')}</h2>
          <p className="mt-1 text-sm text-warm">
            {t('medewerker.voorkeursmatenUitleg')}
          </p>

          {producten.length === 0 ? (
            <p className="mt-5 text-sm text-warm">
              {t('medewerker.geenProducten')}
            </p>
          ) : (
            <div className="mt-5 space-y-4">
              {producten.map((p) => {
                const huidig = maatPerProduct.get(p.id);
                return (
                  <form
                    key={p.id}
                    action={zetVoorkeursmaatAction}
                    className="rounded-xl border border-line bg-mist/60 p-4"
                  >
                    <input type="hidden" name="medewerker_id" value={medewerker.id} />
                    <input type="hidden" name="product_id" value={p.id} />
                    <p className="font-semibold text-ink-900">{p.naam}</p>
                    <div className="mt-3 flex flex-wrap items-end gap-3">
                      <div className="min-w-[8rem]">
                        <label className="block text-xs font-semibold text-warm">{t('algemeen.maat')}</label>
                        <select
                          name="voorkeursmaat"
                          defaultValue={huidig?.voorkeursmaat ?? ''}
                          className="mt-1 rounded-md border border-line px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
                        >
                          <option value="">{t('medewerker.geenVoorkeur')}</option>
                          {p.maten.map((maat) => (
                            <option key={maat} value={maat}>
                              {maat}
                            </option>
                          ))}
                        </select>
                      </div>
                      <label className="flex items-center gap-2 py-2 text-sm text-ink-800">
                        <input
                          type="checkbox"
                          name="plus_minus_toegestaan"
                          defaultChecked={huidig?.plusMinusToegestaan ?? false}
                          className="h-4 w-4 rounded border-line text-amber-700 focus:ring-amber-200"
                        />
                        <span>{t('medewerker.plusMin')}</span>
                      </label>
                      <button className="rounded-md border border-line px-2.5 py-2 text-xs font-semibold text-ink-700 hover:bg-mist">
                        {t('algemeen.opslaan')}
                      </button>
                    </div>
                    {p.maten.length === 0 && (
                      <p className="mt-2 text-xs text-warm">{t('medewerker.geenMaten')}</p>
                    )}
                    {huidig && (
                      <div className="mt-2">
                        <button
                          formAction={verwijderVoorkeursmaatAction}
                          name="maat_id"
                          value={huidig.id}
                          className="text-xs font-semibold text-warm hover:text-amber-800"
                        >
                          {t('medewerker.voorkeurVerwijderen')}
                        </button>
                      </div>
                    )}
                  </form>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
