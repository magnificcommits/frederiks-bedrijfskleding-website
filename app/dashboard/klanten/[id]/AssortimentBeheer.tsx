'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { AssortimentRij, Periode, VerstrekkingType } from '@/lib/kms/assortiment';
import type { ArtikelKeuze } from '@/lib/kms/producten';
import ArtikelKiezer from './ArtikelKiezer';
import { verwijderAssortimentActie, werkAssortimentActie } from './actions';
import { PERIODE_OPTIES, VERSTREKKING_OPTIES, periodeLabel, verstrekkingLabel } from './verstrekkingOpties';

/**
 * Het assortiment van één klant: welke artikelen zij mogen bestellen, in welke
 * kleur en hoe ze het krijgen. Met een zoekbalk, want ook een klant met tachtig
 * artikelen moet je kunnen doorzoeken zonder te scrollen. Kleur en verstrekking
 * zijn hier ook aan te passen: een verkeerd gekozen kleur mag geen reden zijn om
 * de regel weg te gooien en opnieuw te beginnen.
 *
 * Zoeken gebeurt in de browser op de al geladen regels. De lijst is van één
 * klant en dus klein; een ronde langs de server per toetsaanslag zou hier alleen
 * maar vertraging toevoegen.
 */
export default function AssortimentBeheer({
  orgId,
  regels,
}: {
  orgId: string;
  regels: AssortimentRij[];
}) {
  const router = useRouter();
  const [zoek, setZoek] = useState('');
  const [merk, setMerk] = useState('');
  const [kiezerOpen, setKiezerOpen] = useState(false);
  const [melding, setMelding] = useState<{
    ok: boolean;
    tekst: string;
    waarschuwing?: string;
  } | null>(null);
  // De catalogus blijft hier hangen, zodat het zoekvenster de tweede keer
  // meteen openstaat zonder opnieuw te laden.
  const [catalogus, setCatalogus] = useState<ArtikelKeuze[] | null>(null);

  const merken = useMemo(
    () =>
      [...new Set(regels.map((r) => r.merk).filter((m): m is string => Boolean(m)))].sort((a, b) =>
        a.localeCompare(b, 'nl'),
      ),
    [regels],
  );

  const gevonden = useMemo(() => {
    const delen = zoek.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return regels.filter((r) => {
      if (merk && r.merk !== merk) return false;
      if (delen.length === 0) return true;
      const tekst = [r.naam, r.merk ?? '', r.sku ?? '', r.categorie ?? '', r.kleur ?? '']
        .join(' ')
        .toLowerCase();
      return delen.every((d) => tekst.includes(d));
    });
  }, [regels, zoek, merk]);

  const sluitKiezer = useCallback(() => setKiezerOpen(false), []);
  const naToevoegen = useCallback(() => {
    // De serveractie heeft de klantpagina al ongeldig verklaard; refresh haalt de
    // nieuwe lijst op zonder dat het zoekvenster of het tabblad dichtklapt.
    router.refresh();
  }, [router]);

  const alGekozenIds = useMemo(() => [...new Set(regels.map((r) => r.product_id))], [regels]);

  return (
    <div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-72">
            <label className="veld-label" htmlFor="assortiment-zoek">
              Zoeken in dit assortiment
            </label>
            <input
              id="assortiment-zoek"
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              placeholder="Naam, merk, kleur of sku"
              autoComplete="off"
              className="veld"
            />
          </div>
          <div className="w-44">
            <label className="veld-label" htmlFor="assortiment-merk">
              Merk
            </label>
            <select
              id="assortiment-merk"
              value={merk}
              onChange={(e) => setMerk(e.target.value)}
              className="veld"
            >
              <option value="">Alle merken</option>
              {merken.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button type="button" onClick={() => setKiezerOpen(true)} className="knop-donker">
          Artikel zoeken en toevoegen
        </button>
      </div>

      {melding && (
        <div
          className={`mt-3 rounded-xl border px-5 py-3 text-[13px] ${
            melding.ok && !melding.waarschuwing
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          <p className="font-semibold">{melding.tekst}</p>
          {melding.waarschuwing && <p className="mt-0.5">{melding.waarschuwing}</p>}
        </div>
      )}

      {regels.length === 0 ? (
        <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-4 text-[13px] text-warm">
          Er staat nog niets in het assortiment. Klik op Artikel zoeken en toevoegen, zoek een artikel op
          naam, merk of artikelnummer en kies daar meteen de kleur bij.
        </p>
      ) : gevonden.length === 0 ? (
        <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-4 text-[13px] text-warm">
          Geen artikel in dit assortiment dat hierop past. Maak het zoekveld leeg of zet het merk terug op
          alle merken om de hele lijst weer te zien.
        </p>
      ) : (
        <>
          <p className="mt-3 text-[12px] text-warm">
            {gevonden.length === regels.length
              ? `${regels.length} ${regels.length === 1 ? 'artikel' : 'artikelen'} in het assortiment.`
              : `${gevonden.length} van ${regels.length} artikelen.`}
          </p>
          <div className="panel mt-2 overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Artikel</th>
                  <th>Kleur</th>
                  <th>Hoe krijgt de klant dit</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {gevonden.map((r) => (
                  <RegelRij
                    // De stand van de keuzelijsten hoort bij de opgeslagen waarden.
                    // Wijzigt de server iets, dan moet de rij opnieuw beginnen.
                    key={`${r.id}|${r.kleur ?? ''}|${r.verstrekking_type}|${r.gratis_per_periode ?? ''}|${r.periode}`}
                    orgId={orgId}
                    regel={r}
                    onMelding={setMelding}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {kiezerOpen && (
        <ArtikelKiezer
          orgId={orgId}
          catalogus={catalogus}
          onCatalogus={setCatalogus}
          alGekozenIds={alGekozenIds}
          onSluiten={sluitKiezer}
          onToegevoegd={naToevoegen}
        />
      )}
    </div>
  );
}

/**
 * Eén regel uit het assortiment. Houdt zijn eigen keuzes vast tot je op Opslaan
 * klikt, zodat een halve wijziging nooit stilletjes wegvalt.
 */
function RegelRij({
  orgId,
  regel,
  onMelding,
}: {
  orgId: string;
  regel: AssortimentRij;
  onMelding: (m: { ok: boolean; tekst: string; waarschuwing?: string }) => void;
}) {
  const router = useRouter();
  const [kleur, setKleur] = useState(regel.kleur ?? '');
  const [type, setType] = useState<VerstrekkingType>(regel.verstrekking_type);
  // Staat er nog geen aantal, dan is 1 de zinnige startwaarde. Bij een regel die
  // al op periodiek gratis staat houden we 0 aan, anders lijkt de rij gewijzigd
  // terwijl Jessi nog niets heeft aangeraakt.
  const [aantal, setAantal] = useState(
    regel.gratis_per_periode != null
      ? String(regel.gratis_per_periode)
      : regel.verstrekking_type === 'periodiek_gratis'
        ? '0'
        : '1',
  );
  const [periode, setPeriode] = useState<Periode>(regel.periode);
  const [bezig, start] = useTransition();

  const opgeslagenAantal =
    regel.verstrekking_type === 'periodiek_gratis' ? (regel.gratis_per_periode ?? 0) : null;
  const nieuwAantal = type === 'periodiek_gratis' ? Math.max(0, Number(aantal) || 0) : null;
  const gewijzigd =
    kleur !== (regel.kleur ?? '') ||
    type !== regel.verstrekking_type ||
    periode !== regel.periode ||
    nieuwAantal !== opgeslagenAantal;

  // Een kleur die al vastligt maar niet meer als variant bestaat, hoort toch in de
  // lijst te staan. Anders wist opslaan hem stilletjes.
  const kleurKeuzes =
    regel.kleur && !regel.kleuren.includes(regel.kleur)
      ? [regel.kleur, ...regel.kleuren]
      : regel.kleuren;

  function opslaan() {
    if (bezig) return;
    start(async () => {
      const antwoord = await werkAssortimentActie({
        orgId,
        regelId: regel.id,
        kleur: kleur || null,
        verstrekking_type: type,
        gratis_per_periode: nieuwAantal,
        periode,
      });
      onMelding({ ok: antwoord.ok, tekst: antwoord.melding, waarschuwing: antwoord.waarschuwing });
      if (antwoord.ok) router.refresh();
    });
  }

  function verwijderen() {
    if (bezig) return;
    const bevestigd = window.confirm(
      `${regel.naam} uit het assortiment van deze klant halen? Het artikel zelf blijft gewoon bestaan.`,
    );
    if (!bevestigd) return;
    start(async () => {
      const antwoord = await verwijderAssortimentActie({ orgId, regelId: regel.id });
      onMelding({ ok: antwoord.ok, tekst: antwoord.melding });
      if (antwoord.ok) router.refresh();
    });
  }

  return (
    <tr className="border-b border-line align-middle">
      <td>
        <div className="flex items-center gap-3">
          {regel.afbeelding ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={regel.afbeelding}
              alt=""
              className="h-10 w-10 shrink-0 rounded border border-line object-contain"
            />
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-line bg-mist text-[10px] text-warm">
              geen foto
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink-900">{regel.naam}</p>
            <p className="truncate text-[11px] text-warm">
              {[regel.merk, regel.sku].filter(Boolean).join(' · ') || 'Geen merk bekend'}
            </p>
            <div className="mt-0.5 flex flex-wrap gap-1.5">
              {regel.bereik && <span className="badge-rust">alleen {regel.bereik}</span>}
              {!regel.artikel_actief && <span className="badge-actie">artikel staat op inactief</span>}
              {!regel.toegestaan && <span className="badge-actie">niet bestelbaar</span>}
            </div>
          </div>
        </div>
      </td>
      <td>
        {kleurKeuzes.length === 0 ? (
          <span className="text-warm">{regel.kleur || 'Alle kleuren'}</span>
        ) : (
          <>
            <label className="sr-only" htmlFor={`kleur-${regel.id}`}>
              Kleur voor {regel.naam}
            </label>
            <select
              id={`kleur-${regel.id}`}
              value={kleur}
              onChange={(e) => setKleur(e.target.value)}
              className="rounded-md border border-line bg-white px-2 py-1 text-[13px] text-ink-800"
            >
              <option value="">Alle kleuren</option>
              {kleurKeuzes.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </>
        )}
      </td>
      <td>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={`verstrekking-${regel.id}`}>
            Verstrekking voor {regel.naam}
          </label>
          <select
            id={`verstrekking-${regel.id}`}
            value={type}
            onChange={(e) => setType(e.target.value as VerstrekkingType)}
            className="rounded-md border border-line bg-white px-2 py-1 text-[13px] text-ink-800"
          >
            {VERSTREKKING_OPTIES.map((o) => (
              <option key={o.waarde} value={o.waarde}>
                {o.label}
              </option>
            ))}
          </select>
          {type === 'periodiek_gratis' && (
            <>
              <label className="sr-only" htmlFor={`aantal-${regel.id}`}>
                Aantal gratis voor {regel.naam}
              </label>
              <input
                id={`aantal-${regel.id}`}
                type="number"
                min="0"
                step="1"
                value={aantal}
                onChange={(e) => setAantal(e.target.value)}
                className="w-16 rounded-md border border-line bg-white px-2 py-1 text-[13px] text-ink-800"
              />
              <label className="sr-only" htmlFor={`periode-${regel.id}`}>
                Periode voor {regel.naam}
              </label>
              <select
                id={`periode-${regel.id}`}
                value={periode}
                onChange={(e) => setPeriode(e.target.value as Periode)}
                className="rounded-md border border-line bg-white px-2 py-1 text-[13px] text-ink-800"
              >
                {PERIODE_OPTIES.map((o) => (
                  <option key={o.waarde} value={o.waarde}>
                    {o.label}
                  </option>
                ))}
              </select>
            </>
          )}
          {gewijzigd && (
            <button type="button" onClick={opslaan} disabled={bezig} className="knop-stil">
              {bezig ? 'Bezig...' : 'Opslaan'}
            </button>
          )}
        </div>
        {!gewijzigd && (
          <p className="mt-1 text-[11px] text-warm">
            {verstrekkingLabel(regel.verstrekking_type)}
            {regel.verstrekking_type === 'periodiek_gratis'
              ? `: ${regel.gratis_per_periode ?? 0}x ${periodeLabel(regel.periode)}`
              : ''}
          </p>
        )}
      </td>
      <td className="text-right">
        <button
          type="button"
          onClick={verwijderen}
          disabled={bezig}
          className="rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-mist"
        >
          Verwijderen
        </button>
      </td>
    </tr>
  );
}
