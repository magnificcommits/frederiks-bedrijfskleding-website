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
 * kleur, voor wie (hele klant of een afdeling) en hoe ze het krijgen. Met een
 * zoekbalk, want ook een klant met tachtig artikelen moet je kunnen doorzoeken
 * zonder te scrollen. De kleur ligt vast na het toevoegen (foto in die kleur);
 * verstrekking en afdeling zijn hier nog aan te passen.
 *
 * Zoeken gebeurt in de browser op de al geladen regels. De lijst is van één
 * klant en dus klein; een ronde langs de server per toetsaanslag zou hier alleen
 * maar vertraging toevoegen.
 */
export default function AssortimentBeheer({
  orgId,
  regels,
  afdelingen,
}: {
  orgId: string;
  regels: AssortimentRij[];
  afdelingen: { id: string; naam: string }[];
}) {
  const router = useRouter();
  const [zoek, setZoek] = useState('');
  const [merk, setMerk] = useState('');
  // '' = alles, 'klant' = alleen voor de hele klant, anders een afdeling-id.
  const [groep, setGroep] = useState('');
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
      if (groep === 'klant' && (r.afdeling_id || r.medewerker_id)) return false;
      if (groep && groep !== 'klant' && r.afdeling_id !== groep) return false;
      if (delen.length === 0) return true;
      const tekst = [r.naam, r.merk ?? '', r.sku ?? '', r.categorie ?? '', r.kleur ?? '']
        .join(' ')
        .toLowerCase();
      return delen.every((d) => tekst.includes(d));
    });
  }, [regels, zoek, merk, groep]);

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
          {afdelingen.length > 0 && (
            <div className="w-52">
              <label className="veld-label" htmlFor="assortiment-groep">
                Voor wie
              </label>
              <select
                id="assortiment-groep"
                value={groep}
                onChange={(e) => setGroep(e.target.value)}
                className="veld"
              >
                <option value="">Alles</option>
                <option value="klant">Hele klant</option>
                {afdelingen.map((a) => (
                  <option key={a.id} value={a.id}>
                    Afdeling {a.naam}
                  </option>
                ))}
              </select>
            </div>
          )}
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
          naam, merk of artikelnummer en kies daar de kleur en voor wie het is.
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
                  <th>Voor wie</th>
                  <th>Hoe krijgt de klant dit</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {gevonden.map((r) => (
                  <RegelRij
                    // De stand van de keuzelijsten hoort bij de opgeslagen waarden.
                    // Wijzigt de server iets, dan moet de rij opnieuw beginnen.
                    key={`${r.id}|${r.afdeling_id ?? ''}|${r.verstrekking_type}|${r.gratis_per_periode ?? ''}|${r.periode}`}
                    orgId={orgId}
                    regel={r}
                    afdelingen={afdelingen}
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
          afdelingen={afdelingen}
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
 *
 * De kleur ligt vast: die is gekozen bij het toevoegen. Een andere kleur is een
 * andere regel (verwijderen en opnieuw toevoegen).
 */
function RegelRij({
  orgId,
  regel,
  afdelingen,
  onMelding,
}: {
  orgId: string;
  regel: AssortimentRij;
  afdelingen: { id: string; naam: string }[];
  onMelding: (m: { ok: boolean; tekst: string; waarschuwing?: string }) => void;
}) {
  const router = useRouter();
  const [groep, setGroep] = useState(regel.afdeling_id ?? '');
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

  const voorEenWerknemer = Boolean(regel.medewerker_id);
  const opgeslagenAantal =
    regel.verstrekking_type === 'periodiek_gratis' ? (regel.gratis_per_periode ?? 0) : null;
  const nieuwAantal = type === 'periodiek_gratis' ? Math.max(0, Number(aantal) || 0) : null;
  const groepGewijzigd = !voorEenWerknemer && groep !== (regel.afdeling_id ?? '');
  const gewijzigd =
    groepGewijzigd ||
    type !== regel.verstrekking_type ||
    periode !== regel.periode ||
    nieuwAantal !== opgeslagenAantal;

  // Een afdeling die al op de regel staat maar (nog) niet in de lijst, toch tonen.
  const afdelingKeuzes =
    regel.afdeling_id && !afdelingen.some((a) => a.id === regel.afdeling_id)
      ? [{ id: regel.afdeling_id, naam: regel.bereik ?? 'onbekende afdeling' }, ...afdelingen]
      : afdelingen;

  function opslaan() {
    if (bezig) return;
    start(async () => {
      const antwoord = await werkAssortimentActie({
        orgId,
        regelId: regel.id,
        verstrekking_type: type,
        gratis_per_periode: nieuwAantal,
        periode,
        ...(groepGewijzigd ? { afdeling_id: groep || null } : {}),
      });
      onMelding({ ok: antwoord.ok, tekst: antwoord.melding, waarschuwing: antwoord.waarschuwing });
      if (antwoord.ok) router.refresh();
    });
  }

  function verwijderen() {
    if (bezig) return;
    const bevestigd = window.confirm(
      `${regel.naam}${regel.kleur ? ` in ${regel.kleur}` : ''} uit het assortiment van deze klant halen? Het artikel zelf blijft gewoon bestaan.`,
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
              alt={regel.kleur ? `${regel.naam} in ${regel.kleur}` : ''}
              className="h-14 w-14 shrink-0 rounded border border-line bg-white object-contain"
            />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded border border-line bg-mist text-[10px] text-warm">
              geen foto
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-ink-900">{regel.naam}</p>
            <p className="truncate text-[12px] text-warm">
              {[regel.merk, regel.sku].filter(Boolean).join(' · ') || 'Geen merk bekend'}
            </p>
            <div className="mt-0.5 flex flex-wrap gap-1.5">
              {!regel.artikel_actief && <span className="badge-actie">artikel staat op inactief</span>}
              {!regel.toegestaan && <span className="badge-actie">niet bestelbaar</span>}
            </div>
          </div>
        </div>
      </td>
      <td>
        <span className="text-[14px] font-semibold text-ink-900">{regel.kleur || 'Geen kleur'}</span>
        {!regel.kleur && regel.kleuren.length > 0 && (
          <p className="text-[11px] text-amber-800">
            Nog zonder vaste kleur. Verwijder en voeg opnieuw toe om een kleur vast te leggen.
          </p>
        )}
      </td>
      <td>
        {voorEenWerknemer ? (
          <span className="badge-rust">alleen {regel.bereik ?? 'één werknemer'}</span>
        ) : afdelingKeuzes.length === 0 ? (
          <span className="text-[13px] text-warm">Hele klant</span>
        ) : (
          <>
            <label className="sr-only" htmlFor={`groep-${regel.id}`}>
              Voor wie is {regel.naam}
            </label>
            <select
              id={`groep-${regel.id}`}
              value={groep}
              onChange={(e) => setGroep(e.target.value)}
              className="rounded-md border border-line bg-white px-2 py-1.5 text-[13px] text-ink-800"
            >
              <option value="">Hele klant</option>
              {afdelingKeuzes.map((a) => (
                <option key={a.id} value={a.id}>
                  Afdeling {a.naam}
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
            className="rounded-md border border-line bg-white px-2 py-1.5 text-[13px] text-ink-800"
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
                className="w-16 rounded-md border border-line bg-white px-2 py-1.5 text-[13px] text-ink-800"
              />
              <label className="sr-only" htmlFor={`periode-${regel.id}`}>
                Periode voor {regel.naam}
              </label>
              <select
                id={`periode-${regel.id}`}
                value={periode}
                onChange={(e) => setPeriode(e.target.value as Periode)}
                className="rounded-md border border-line bg-white px-2 py-1.5 text-[13px] text-ink-800"
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
            <button type="button" onClick={opslaan} disabled={bezig} className="knop-donker">
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
