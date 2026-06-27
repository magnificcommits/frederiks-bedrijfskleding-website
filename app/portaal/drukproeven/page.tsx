import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { isPortalConfigured } from '@/lib/env';
import { getPortaalUser, getMijnOrganisatie } from '@/lib/portaal/queries';
import { getMijnToegang } from '@/lib/portaal/team';
import { getServerSupabase } from '@/lib/portaal/supabaseServer';
import DrukproefPreview from '@/app/dashboard/drukproeven/DrukproefPreview';
import PortaalNav from '../PortaalNav';
import { beslisDrukproefPortaalActie } from './actions';

export const metadata: Metadata = { title: 'Drukproeven', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const datum = (s: string | null) =>
  s ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(s)) : '';

type Drukproef = {
  id: string;
  naam: string;
  type: string;
  kleur: number;
  techniek: string;
  positie: string;
  logo_url: string | null;
  afbeelding_url: string | null;
  omschrijving: string | null;
  status: string;
  opmerking: string | null;
  behandeld_op: string | null;
  created_at: string;
};

const statusLabel: Record<string, string> = {
  concept: 'Concept',
  verstuurd: 'Verstuurd',
  goedgekeurd: 'Goedgekeurd',
  afgekeurd: 'Afgekeurd',
};

function StatusBadge({ status }: { status: string }) {
  const label = statusLabel[status] ?? status;
  const toon =
    status === 'goedgekeurd'
      ? 'border-green-300 bg-green-50 text-green-800'
      : status === 'afgekeurd'
        ? 'border-red-300 bg-red-50 text-red-700'
        : status === 'verstuurd'
          ? 'border-amber-300 bg-amber-50 text-amber-700'
          : 'border-line bg-cream text-warm';
  return <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${toon}`}>{label}</span>;
}

export default async function Drukproeven({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
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

  const org = await getMijnOrganisatie();
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

  const toegang = await getMijnToegang();
  if (toegang.rol !== 'beheerder' && toegang.rol !== 'leidinggevende') {
    return (
      <main className="container-x py-12">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">Klantportaal</p>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">Drukproeven</h1>
        </div>
        <PortaalNav rol={toegang.rol} actief="/portaal/drukproeven" />
        <div className="mt-8 rounded-xl border border-line bg-white p-6 shadow-soft">
          <h2 className="font-display text-lg font-extrabold text-ink-900">Geen toegang</h2>
          <p className="mt-3 text-sm text-warm">Drukproeven goedkeuren kan alleen door een beheerder of leidinggevende. Vraag iemand met die rol om de drukproef te beoordelen.</p>
        </div>
      </main>
    );
  }

  const sp = await searchParams;
  const sb = await getServerSupabase();
  const { data } = sb
    ? await sb.from('drukproeven').select('*').order('created_at', { ascending: false })
    : { data: null };
  const proeven = (data as Drukproef[]) ?? [];

  return (
    <main className="container-x py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">Klantportaal</p>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">Drukproeven</h1>
        </div>
      </div>
      <PortaalNav rol={toegang.rol} actief="/portaal/drukproeven" />

      <p className="mt-6 max-w-2xl text-sm text-warm">Hier zie je hoe een logo op de kleding komt: de plek, de maat en de techniek. Keur een drukproef goed of af, en geef bij afkeuren kort aan wat er anders moet.</p>

      {sp?.ok && (
        <div className="mt-6 rounded-xl border border-green-300 bg-green-50 p-4 text-sm text-green-800">
          Je beoordeling is opgeslagen. We zien je keuze meteen terug.
        </div>
      )}

      {proeven.length === 0 ? (
        <p className="mt-8 text-sm text-warm">Er staan nog geen drukproeven klaar. Zodra Frederiks Bedrijfskleding er een opstuurt, vind je hem hier.</p>
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
                  <StatusBadge status={p.status} />
                </div>

                {p.omschrijving && <p className="mt-3 text-sm text-warm">{p.omschrijving}</p>}

                <div className="mx-auto mt-4 max-w-xs">
                  <DrukproefPreview
                    afbeeldingUrl={p.afbeelding_url}
                    type={p.type}
                    kleur={p.kleur}
                    logoUrl={p.logo_url}
                    positie={p.positie}
                    techniek={p.techniek}
                  />
                </div>

                {behandeld ? (
                  <div className="mt-5">
                    {p.status === 'goedgekeurd' ? (
                      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                        <p className="font-semibold">Goedgekeurd{p.behandeld_op ? ` op ${datum(p.behandeld_op)}` : ''}.</p>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        <p className="font-semibold">Afgekeurd{p.behandeld_op ? ` op ${datum(p.behandeld_op)}` : ''}.</p>
                      </div>
                    )}
                    {p.opmerking && (
                      <div className="mt-3 rounded-lg border border-line bg-cream px-4 py-3 text-sm text-warm">
                        <p className="text-xs font-semibold text-ink-900">Opmerking</p>
                        <p className="mt-1">{p.opmerking}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <form action={beslisDrukproefPortaalActie} className="mt-5">
                    <input type="hidden" name="id" value={p.id} />
                    <label htmlFor={`opmerking-${p.id}`} className="block text-sm font-semibold text-ink-900">
                      Opmerking (optioneel)
                    </label>
                    <textarea
                      id={`opmerking-${p.id}`}
                      name="opmerking"
                      rows={3}
                      placeholder="Wil je iets aangepast zien? Laat het hier weten."
                      className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink-900 shadow-soft focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <button
                        type="submit"
                        name="besluit"
                        value="akkoord"
                        className="flex-1 rounded-lg bg-green-600 px-4 py-3 text-sm font-bold text-white shadow-soft transition hover:bg-green-700"
                      >
                        Goedkeuren
                      </button>
                      <button
                        type="submit"
                        name="besluit"
                        value="afkeuren"
                        className="flex-1 rounded-lg bg-red-600 px-4 py-3 text-sm font-bold text-white shadow-soft transition hover:bg-red-700"
                      >
                        Afkeuren
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
