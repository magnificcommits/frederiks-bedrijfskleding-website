import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { isPortalConfigured } from '@/lib/env';
import { getPortaalUser, getMijnOrganisatie } from '@/lib/portaal/queries';
import { getMijnToegang } from '@/lib/portaal/team';
import { getServerSupabase } from '@/lib/portaal/supabaseServer';
import DrukproefPreview from '@/app/dashboard/drukproeven/DrukproefPreview';
import PortaalNav from '../PortaalNav';
import { beslisDrukproefPortaalActie } from './actions';
import { getVertaler } from '@/lib/i18n/portaal/server';
import type { Vertaler } from '@/lib/i18n/portaal/kern';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getVertaler();
  return { title: t('nav.drukproeven'), robots: { index: false, follow: false } };
}
export const dynamic = 'force-dynamic';

type Drukproef = {
  id: string;
  naam: string;
  type: string;
  kleur: number;
  techniek: string;
  positie: string;
  logo_url: string | null;
  afbeelding_url: string | null;
  achter_afbeelding_url?: string | null;
  ontwerp?: unknown;
  omschrijving: string | null;
  status: string;
  opmerking: string | null;
  behandeld_op: string | null;
  created_at: string;
};

function StatusBadge({ status, v }: { status: string; v: Vertaler }) {
  const label = v.status('drukproef', status);
  const toon =
    status === 'goedgekeurd'
      ? 'border-green-300 bg-green-50 text-green-800'
      : status === 'afgekeurd'
        ? 'border-red-300 bg-red-50 text-red-700'
        : status === 'verstuurd'
          ? 'border-amber-300 bg-amber-50 text-amber-700'
          : 'border-line bg-mist text-warm';
  return <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${toon}`}>{label}</span>;
}

export default async function Drukproeven({ searchParams }: { searchParams: Promise<{ ok?: string; fout?: string }> }) {
  const v = await getVertaler();
  const { t, datum } = v;
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

  const toegang = await getMijnToegang();
  if (toegang.rol !== 'beheerder' && toegang.rol !== 'leidinggevende') {
    return (
      <main className="container-x py-12">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">{t('algemeen.klantportaal')}</p>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">{t('nav.drukproeven')}</h1>
        </div>
        <PortaalNav rol={toegang.rol} actief="/portaal/drukproeven" />
        <div className="mt-8 rounded-xl border border-line bg-white p-6 shadow-soft">
          <h2 className="font-display text-lg font-extrabold text-ink-900">{t('algemeen.geenToegang')}</h2>
          <p className="mt-3 text-sm text-warm">{t('drukproeven.geenToegangTekst')}</p>
        </div>
      </main>
    );
  }

  const sp = await searchParams;
  const sb = await getServerSupabase();
  const { data } = sb
    ? // Concepten zijn nog in de maak bij Frederiks; de klant ziet een proef pas als hij verstuurd is.
      await sb.from('drukproeven').select('*').neq('status', 'concept').order('created_at', { ascending: false })
    : { data: null };
  const proeven = (data as Drukproef[]) ?? [];

  return (
    <main className="container-x py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">{t('algemeen.klantportaal')}</p>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">{t('nav.drukproeven')}</h1>
        </div>
      </div>
      <PortaalNav rol={toegang.rol} actief="/portaal/drukproeven" />

      <p className="mt-6 max-w-2xl text-sm text-warm">{t('drukproeven.intro')}</p>

      {sp?.ok && (
        <div className="mt-6 rounded-xl border border-green-300 bg-green-50 p-4 text-sm text-green-800">
          {t('drukproeven.opgeslagen')}
        </div>
      )}
      {sp?.fout && (
        <div role="alert" className="mt-6 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          {t('algemeen.foutOpslaan')}
        </div>
      )}

      {proeven.length === 0 ? (
        <p className="mt-8 text-sm text-warm">{t('drukproeven.geenProeven')}</p>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {proeven.map((p) => {
            const behandeld = p.status === 'goedgekeurd' || p.status === 'afgekeurd';
            return (
              <div key={p.id} className="rounded-xl border border-line bg-white p-6 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{p.naam}</p>
                    <p className="mt-1 text-xs text-warm">{datum(p.created_at)}</p>
                  </div>
                  <StatusBadge status={p.status} v={v} />
                </div>

                {p.omschrijving && <p className="mt-3 text-sm text-warm">{p.omschrijving}</p>}

                <div className={`mx-auto mt-4 ${p.ontwerp ? 'max-w-2xl' : 'max-w-xs'}`}>
                  <DrukproefPreview
                    afbeeldingUrl={p.afbeelding_url}
                    type={p.type}
                    kleur={p.kleur}
                    logoUrl={p.logo_url}
                    positie={p.positie}
                    techniek={p.techniek}
                    ontwerp={p.ontwerp}
                    achterAfbeeldingUrl={p.achter_afbeelding_url ?? null}
                  />
                </div>

                {behandeld ? (
                  <div className="mt-5">
                    {p.status === 'goedgekeurd' ? (
                      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                        <p className="font-semibold">{p.behandeld_op ? t('drukproeven.goedgekeurdOp', { datum: datum(p.behandeld_op) }) : t('drukproeven.goedgekeurd')}</p>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        <p className="font-semibold">{p.behandeld_op ? t('drukproeven.afgekeurdOp', { datum: datum(p.behandeld_op) }) : t('drukproeven.afgekeurd')}</p>
                      </div>
                    )}
                    {p.opmerking && (
                      <div className="mt-3 rounded-lg border border-line bg-mist px-4 py-3 text-sm text-warm">
                        <p className="text-xs font-semibold text-ink-900">{t('algemeen.opmerking')}</p>
                        <p className="mt-1">{p.opmerking}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <form action={beslisDrukproefPortaalActie} className="mt-5">
                    <input type="hidden" name="id" value={p.id} />
                    <label htmlFor={`opmerking-${p.id}`} className="block text-sm font-semibold text-ink-900">
                      {t('algemeen.opmerkingOptioneel')}
                    </label>
                    <textarea
                      id={`opmerking-${p.id}`}
                      name="opmerking"
                      rows={3}
                      placeholder={t('drukproeven.opmerkingPlaceholder')}
                      className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink-900 shadow-soft focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <button
                        type="submit"
                        name="besluit"
                        value="akkoord"
                        className="flex-1 rounded-lg bg-green-600 px-4 py-3 text-sm font-bold text-white shadow-soft transition hover:bg-green-700"
                      >
                        {t('drukproeven.goedkeuren')}
                      </button>
                      <button
                        type="submit"
                        name="besluit"
                        value="afkeuren"
                        className="flex-1 rounded-lg bg-red-600 px-4 py-3 text-sm font-bold text-white shadow-soft transition hover:bg-red-700"
                      >
                        {t('drukproeven.afkeuren')}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
