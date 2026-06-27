import { getDrukproefViaToken } from '@/lib/kms/drukproeven';
import DrukproefPreview from '@/app/dashboard/drukproeven/DrukproefPreview';
import { site } from '@/content/site';
import { beslisActie } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Drukproef', robots: { index: false, follow: false } };

const datum = (s: string | null) =>
  s ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(s)) : '';

function Kop() {
  return (
    <div className="text-center">
      <div className="font-display text-2xl font-extrabold tracking-wide text-ink-900">FREDERIKS</div>
      <div className="mt-1 text-[11px] font-bold tracking-[0.32em] text-amber-600">BEDRIJFSKLEDING</div>
    </div>
  );
}

export default async function DrukproefTokenPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  const { token } = await params;
  const { ok } = await searchParams;
  const proef = await getDrukproefViaToken(token);

  if (!proef) {
    return (
      <main className="container-x py-16">
        <div className="mx-auto max-w-md rounded-2xl border border-line bg-white p-8 text-center shadow-soft">
          <Kop />
          <h1 className="mt-6 font-display text-xl font-bold text-ink-900">Drukproef niet gevonden</h1>
          <p className="mt-3 text-sm text-warm">Deze drukproef bestaat niet of de link is verlopen.</p>
        </div>
      </main>
    );
  }

  const bedrijf = proef.organisatie_naam ?? '';
  const behandeld = proef.status === 'goedgekeurd' || proef.status === 'afgekeurd';

  return (
    <main className="container-x py-16">
      <div className="mx-auto max-w-md rounded-2xl border border-line bg-white p-8 shadow-soft">
        <Kop />

        {ok === 'akkoord' && (
          <div className="mt-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
            Bedankt, je hebt de drukproef goedgekeurd. Jessi gaat ermee aan de slag.
          </div>
        )}
        {ok === 'afkeuren' && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            Bedankt, je hebt de drukproef afgekeurd. Jessi neemt contact met je op.
          </div>
        )}

        <div className="mt-6 text-center">
          {bedrijf && <p className="text-xs font-semibold uppercase tracking-wide text-warm">{bedrijf}</p>}
          <h1 className="mt-1 font-display text-2xl font-bold text-ink-900">{proef.naam}</h1>
          {proef.omschrijving && <p className="mt-2 text-sm text-warm">{proef.omschrijving}</p>}
        </div>

        <div className="mx-auto mt-6 max-w-md">
          <DrukproefPreview
            afbeeldingUrl={proef.afbeelding_url}
            type={proef.type}
            kleur={proef.kleur}
            logoUrl={proef.logo_url}
            positie={proef.positie}
            techniek={proef.techniek}
          />
        </div>

        {behandeld ? (
          <div className="mt-8">
            {proef.status === 'goedgekeurd' ? (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                <p className="font-semibold">Je hebt deze drukproef goedgekeurd{proef.behandeld_op ? ` op ${datum(proef.behandeld_op)}` : ''}.</p>
              </div>
            ) : (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <p className="font-semibold">Je hebt deze drukproef afgekeurd{proef.behandeld_op ? ` op ${datum(proef.behandeld_op)}` : ''}.</p>
              </div>
            )}
            {proef.opmerking && (
              <div className="mt-4 rounded-lg border border-line bg-mist px-4 py-3 text-sm text-warm">
                <p className="text-xs font-semibold text-ink-900">Jouw opmerking</p>
                <p className="mt-1">{proef.opmerking}</p>
              </div>
            )}
            <p className="mt-6 text-center text-sm text-warm">Vragen? Bel ons op {site.phone} of mail naar {site.email}.</p>
          </div>
        ) : (
          <form action={beslisActie} className="mt-8">
            <input type="hidden" name="token" value={token} />
            <label htmlFor="opmerking" className="block text-sm font-semibold text-ink-900">
              Opmerking (optioneel)
            </label>
            <textarea
              id="opmerking"
              name="opmerking"
              rows={3}
              placeholder="Wil je iets aangepast zien? Laat het hier weten."
              className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink-900 shadow-soft focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
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
            <p className="mt-5 text-center text-xs text-warm">Vragen? Bel ons op {site.phone} of mail naar {site.email}.</p>
          </form>
        )}
      </div>
    </main>
  );
}
