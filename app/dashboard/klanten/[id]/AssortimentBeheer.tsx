'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { AssortimentRij, Periode, VerstrekkingType } from '@/lib/kms/assortiment';
import type { ArtikelKeuze } from '@/lib/kms/producten';
import ArtikelKiezer from './ArtikelKiezer';
import { haalArtikelenActie, verwijderAssortimentActie, werkAssortimentActie } from './actions';
import { PERIODE_OPTIES, VERSTREKKING_OPTIES, periodeLabel, verstrekkingLabel } from './verstrekkingOpties';

/**
 * Het assortiment van één klant: welke artikelen zij mogen bestellen, in welke
 * kleur, voor wie (hele klant of een afdeling) en hoe ze het krijgen. Met een
 * zoekbalk, want ook een klant met tachtig artikelen moet je kunnen doorzoeken
 * zonder te scrollen. De kleur ligt vast na het toevoegen (foto in die kleur);
 * verstrekking en afdeling zijn hier nog aan te passen.
 *
 * Eén zoekbalk voor twee dingen: hij filtert wat de klant al heeft, en daaronder
 * staat meteen wat er in de catalogus past maar nog niet in dit assortiment zit,
 * met een knop Toevoegen. Zo hoef je niet te weten of iets er al in staat.
 * Zoeken gebeurt in de browser; de catalogus wordt één keer opgehaald zodra je typt.
 */
export default function AssortimentBeheer({
  orgId,
  regels,
  afdelingen,
  startGroep = '',
}: {
  orgId: string;
  regels: AssortimentRij[];
  afdelingen: { id: string; naam: string }[];
  /** Filter bij binnenkomst: '' = alles, 'klant' of een afdeling-id (vanaf het tabblad Afdelingen). */
  startGroep?: string;
}) {
  const router = useRouter();
  const [zoek, setZoek] = useState('');
  const [merk, setMerk] = useState('');
  // '' = alles, 'klant' = alleen voor de hele klant, anders een afdeling-id.
  const [groep, setGroep] = useState(startGroep);
  const gekozenAfdeling = afdelingen.find((a) => a.id === groep) ?? null;
  const [kiezerOpen, setKiezerOpen] = useState(false);
  // Waarmee het toevoegvenster opent: een zoekterm en/of meteen één artikel.
  const [kiezerStart, setKiezerStart] = useState<{ zoek: string; artikelId: string | null }>({ zoek: '', artikelId: null });
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

  // Catalogus ophalen zodra er gezocht wordt, voor de suggesties onder de lijst.
  const zoekterm = zoek.trim().toLowerCase();
  useEffect(() => {
    if (catalogus !== null || zoekterm.length < 2) return;
    let levend = true;
    haalArtikelenActie()
      .then((lijst) => {
        if (levend) setCatalogus(lijst);
      })
      .catch(() => {});
    return () => {
      levend = false;
    };
  }, [catalogus, zoekterm]);

  // Wat telt als "staat er al": bij een gekozen afdeling alleen wat voor die afdeling
  // of voor de hele klant klaarstaat; een artikel van een andere afdeling mag erbij.
  const inAssortiment = useMemo(
    () =>
      new Set(
        regels
          .filter((r) => !gekozenAfdeling || r.afdeling_id === gekozenAfdeling.id || (!r.afdeling_id && !r.medewerker_id))
          .map((r) => r.product_id),
      ),
    [regels, gekozenAfdeling],
  );
  const uitCatalogus = useMemo(() => {
    if (!catalogus || zoekterm.length < 2) return [];
    const delen = zoekterm.split(/\s+/).filter(Boolean);
    return catalogus.filter((a) => {
      if (inAssortiment.has(a.id)) return false;
      if (merk && a.merk !== merk) return false;
      const tekst = [a.naam, a.merk ?? '', a.sku ?? '', a.art_nr_leverancier ?? '', a.categorie ?? ''].join(' ').toLowerCase();
      return delen.every((d) => tekst.includes(d));
    });
  }, [catalogus, zoekterm, merk, inAssortiment]);

  function openKiezer(artikelId: string | null = null, metZoek = '') {
    setKiezerStart({ zoek: metZoek, artikelId });
    setKiezerOpen(true);
  }

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
          <div className="w-72 max-w-full">
            <label className="veld-label" htmlFor="assortiment-zoek">
              Zoek een artikel
            </label>
            <input
              id="assortiment-zoek"
              type="search"
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              placeholder="Bijv. softshell, Snickers of WK300"
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
        <button type="button" onClick={() => openKiezer(null, zoek.trim())} className="knop-donker">
          {gekozenAfdeling ? `Artikel toevoegen voor ${gekozenAfdeling.naam}` : 'Artikel toevoegen'}
        </button>
      </div>
      <p className="mt-1.5 text-[12px] text-warm">
        De zoekbalk zoekt in wat deze klant al heeft én in de hele catalogus. Staat het er nog niet in, dan zie je het
        eronder met een knop Toevoegen.
      </p>

      {gekozenAfdeling && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-[13px] text-amber-900">
          <p>
            Je ziet alleen de artikelen die apart voor afdeling <strong>{gekozenAfdeling.naam}</strong> klaarstaan. Werknemers
            van deze afdeling krijgen daarnaast alles wat voor de hele klant geldt. Een artikel dat je nu toevoegt, staat
            meteen op deze afdeling.
          </p>
          <button type="button" onClick={() => setGroep('')} className="knop-stil">
            Alles tonen
          </button>
        </div>
      )}

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
      ) : gevonden.length === 0 && gekozenAfdeling && !zoek && !merk ? (
        <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-4 text-[13px] text-warm">
          Er staan nog geen artikelen apart voor afdeling {gekozenAfdeling.naam}. Klik op Artikel toevoegen voor{' '}
          {gekozenAfdeling.naam} om bijvoorbeeld laskleding alleen voor deze groep klaar te zetten.
        </p>
      ) : gevonden.length === 0 ? (
        <p className="mt-4 rounded-xl border border-line bg-mist px-5 py-4 text-[13px] text-warm">
          {zoekterm
            ? `“${zoek.trim()}” staat nog niet in het assortiment van deze klant${gekozenAfdeling ? ` (afdeling ${gekozenAfdeling.naam})` : ''}.`
            : 'Geen artikel in dit assortiment dat hierop past. Zet het merk terug op alle merken om de hele lijst weer te zien.'}
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

      {zoekterm.length >= 2 && (
        <div className="mt-4 rounded-xl border border-line bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
            <p className="text-[13px] font-semibold text-ink-900">
              Uit de catalogus toevoegen
              {catalogus && <span className="ml-1 font-normal text-warm">({uitCatalogus.length} gevonden, nog niet bij deze klant)</span>}
            </p>
            {uitCatalogus.length > 6 && (
              <button type="button" onClick={() => openKiezer(null, zoek.trim())} className="knop-stil">
                Alle {uitCatalogus.length} bekijken
              </button>
            )}
          </div>
          {catalogus === null ? (
            <p className="flex items-center gap-2 px-4 py-3 text-[13px] text-warm">
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-300 border-t-transparent" aria-hidden="true" />
              Catalogus doorzoeken…
            </p>
          ) : uitCatalogus.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-warm">Niets in de catalogus dat hierop past en nog niet bij deze klant staat.</p>
          ) : (
            <ul className="divide-y divide-line">
              {uitCatalogus.slice(0, 6).map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-4 py-2">
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded border border-line bg-mist">
                    {a.afbeelding && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.afbeelding} alt="" className="h-full w-full object-contain" loading="lazy" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-ink-900">{a.naam}</p>
                    <p className="truncate text-[12px] text-warm">
                      {[a.merk, a.sku, a.kleuren.length ? `${a.kleuren.length} kleuren` : ''].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <button type="button" onClick={() => openKiezer(a.id, zoek.trim())} className="knop-donker shrink-0">
                    Toevoegen
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
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
          startAfdelingen={gekozenAfdeling ? [gekozenAfdeling.id] : []}
          startZoek={kiezerStart.zoek}
          startArtikelId={kiezerStart.artikelId}
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
