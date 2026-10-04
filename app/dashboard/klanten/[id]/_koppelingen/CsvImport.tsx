'use client';
import { useMemo, useState, useTransition } from 'react';
import { importeerCsvActie, type CsvRij, type ImportUitkomst } from './actions';

type Bestaand = { personeelsnummer: string | null; email: string | null; status: string };

const VOORBEELD = [
  'naam;email;personeelsnummer;afdeling;startdatum;einddatum',
  'Sanne de Vries;sanne.devries@voorbeeld.nl;1001;Werkplaats;2026-11-01;',
  'Mehmet Yilmaz;mehmet.yilmaz@voorbeeld.nl;1002;Buitendienst;2026-11-15;',
  'Piet Jansen;piet.jansen@voorbeeld.nl;0874;Magazijn;2019-03-01;2026-12-31',
].join('\r\n');

/** Kolomnamen die we herkennen (kleine letters, zonder spaties, streepjes en underscores). */
const KOPPEN: Record<keyof CsvRij, string[]> = {
  naam: ['naam', 'name', 'volledigenaam', 'medewerker'],
  email: ['email', 'emailadres', 'mail', 'e-mail'],
  personeelsnummer: ['personeelsnummer', 'personeelsnr', 'pnr', 'medewerkernummer', 'werknemernummer', 'employeeid'],
  afdeling: ['afdeling', 'department', 'team'],
  startdatum: ['startdatum', 'indienst', 'datumindienst', 'begindatum', 'startdate'],
  einddatum: ['einddatum', 'uitdienst', 'datumuitdienst', 'enddate'],
};

function normaalKop(s: string): string {
  return s.toLowerCase().replace(/[\s_\-.]/g, '');
}

/** Eenvoudige CSV-lezer: ; , of tab als scheiding, aanhalingstekens met "" als escape. */
function leesCsv(tekst: string): string[][] {
  const schoon = tekst.replace(/^﻿/, '');
  const eersteRegel = schoon.split(/\r?\n/, 1)[0] ?? '';
  const telling = [';', ',', '\t'].map((s) => ({ s, n: eersteRegel.split(s).length }));
  const scheiding = telling.sort((a, b) => b.n - a.n)[0].s;
  const rijen: string[][] = [];
  let rij: string[] = [];
  let veld = '';
  let tussenAanhalingstekens = false;
  for (let i = 0; i < schoon.length; i++) {
    const c = schoon[i];
    if (tussenAanhalingstekens) {
      if (c === '"' && schoon[i + 1] === '"') {
        veld += '"';
        i++;
      } else if (c === '"') tussenAanhalingstekens = false;
      else veld += c;
    } else if (c === '"') tussenAanhalingstekens = true;
    else if (c === scheiding) {
      rij.push(veld);
      veld = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && schoon[i + 1] === '\n') i++;
      rij.push(veld);
      rijen.push(rij);
      rij = [];
      veld = '';
    } else veld += c;
  }
  if (veld !== '' || rij.length) {
    rij.push(veld);
    rijen.push(rij);
  }
  return rijen.filter((r) => r.some((v) => v.trim() !== ''));
}

/** 1-11-2026, 01/11/2026 of 2026-11-01 wordt 2026-11-01. Iets anders laten we staan (dan meldt de controle het). */
function normaalDatum(s: string): string {
  const t = s.trim();
  if (!t) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return t;
}

type Voorvertoning = CsvRij & { actie: 'nieuw' | 'bijwerken' | 'uit_dienst' | 'fout'; reden?: string };

export default function CsvImport({ orgId, bestaand }: { orgId: string; bestaand: Bestaand[] }) {
  const [bestandsnaam, setBestandsnaam] = useState('');
  const [rijen, setRijen] = useState<CsvRij[]>([]);
  const [kopFout, setKopFout] = useState<string | null>(null);
  const [taken, setTaken] = useState(true);
  const [uitkomst, setUitkomst] = useState<ImportUitkomst | null>(null);
  const [bezig, start] = useTransition();

  const perPnr = useMemo(() => new Map(bestaand.filter((b) => b.personeelsnummer).map((b) => [b.personeelsnummer!, b])), [bestaand]);
  const perEmail = useMemo(() => new Map(bestaand.filter((b) => b.email).map((b) => [b.email!.toLowerCase(), b])), [bestaand]);

  const voorvertoning: Voorvertoning[] = useMemo(
    () =>
      rijen.map((r) => {
        const reden = !r.naam
          ? 'naam ontbreekt'
          : !r.personeelsnummer && !r.email
            ? 'personeelsnummer of e-mail ontbreekt'
            : r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)
              ? 'e-mailadres klopt niet'
              : r.startdatum && !/^\d{4}-\d{2}-\d{2}$/.test(r.startdatum)
                ? 'startdatum onleesbaar'
                : r.einddatum && !/^\d{4}-\d{2}-\d{2}$/.test(r.einddatum)
                  ? 'einddatum onleesbaar'
                  : null;
        if (reden) return { ...r, actie: 'fout', reden };
        const gevonden = (r.personeelsnummer && perPnr.get(r.personeelsnummer)) || (r.email && perEmail.get(r.email.toLowerCase())) || null;
        if (r.einddatum) return { ...r, actie: 'uit_dienst' };
        return { ...r, actie: gevonden ? 'bijwerken' : 'nieuw' };
      }),
    [rijen, perPnr, perEmail],
  );
  const tel = (a: Voorvertoning['actie']) => voorvertoning.filter((v) => v.actie === a).length;
  const goed = voorvertoning.filter((v) => v.actie !== 'fout');

  async function kiesBestand(file: File | null) {
    setUitkomst(null);
    setKopFout(null);
    setRijen([]);
    if (!file) return;
    setBestandsnaam(file.name);
    const tekst = await file.text();
    const tabel = leesCsv(tekst);
    if (tabel.length < 2) {
      setKopFout('Het bestand is leeg of heeft alleen een kopregel.');
      return;
    }
    const kop = tabel[0].map(normaalKop);
    const index = {} as Record<keyof CsvRij, number>;
    for (const [veld, namen] of Object.entries(KOPPEN) as [keyof CsvRij, string[]][]) {
      index[veld] = kop.findIndex((k) => namen.map(normaalKop).includes(k));
    }
    if (index.naam < 0 || (index.personeelsnummer < 0 && index.email < 0)) {
      setKopFout('De kopregel moet in elk geval de kolommen naam en personeelsnummer (of email) hebben. Gebruik het voorbeeldbestand als begin.');
      return;
    }
    const waarde = (r: string[], veld: keyof CsvRij) => (index[veld] >= 0 ? (r[index[veld]] ?? '').trim() : '');
    setRijen(
      tabel.slice(1).map((r) => ({
        naam: waarde(r, 'naam'),
        email: waarde(r, 'email').toLowerCase(),
        personeelsnummer: waarde(r, 'personeelsnummer'),
        afdeling: waarde(r, 'afdeling'),
        startdatum: normaalDatum(waarde(r, 'startdatum')),
        einddatum: normaalDatum(waarde(r, 'einddatum')),
      })),
    );
  }

  function importeer() {
    start(async () => {
      const res = await importeerCsvActie(orgId, goed.map((v) => ({ naam: v.naam, email: v.email, personeelsnummer: v.personeelsnummer, afdeling: v.afdeling, startdatum: v.startdatum, einddatum: v.einddatum })), taken);
      setUitkomst(res);
      if (res.ok) setRijen([]);
    });
  }

  const ACTIE_LABEL: Record<Voorvertoning['actie'], { tekst: string; cls: string }> = {
    nieuw: { tekst: 'Nieuw', cls: 'badge-actie' },
    bijwerken: { tekst: 'Bijwerken', cls: 'badge-rust' },
    uit_dienst: { tekst: 'Uit dienst', cls: 'badge bg-mist text-ink-800' },
    fout: { tekst: 'Overslaan', cls: 'badge bg-red-100 text-red-700' },
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="knop-donker cursor-pointer">
          CSV-bestand kiezen
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            className="sr-only"
            onChange={(e) => {
              void kiesBestand(e.target.files?.[0] ?? null);
              e.target.value = '';
            }}
          />
        </label>
        <a href={`data:text/csv;charset=utf-8,${encodeURIComponent('﻿' + VOORBEELD)}`} download="medewerkers-voorbeeld.csv" className="knop-stil">
          Voorbeeldbestand downloaden
        </a>
        {bestandsnaam && rijen.length > 0 && <span className="text-[12px] text-warm">{bestandsnaam}: {rijen.length} rijen</span>}
      </div>
      <p className="veld-hint">
        Kolommen: naam, email, personeelsnummer, afdeling, startdatum, einddatum. Puntkomma of komma als scheiding, datums als 2026-11-01 of 1-11-2026.
        Bestaande medewerkers (zelfde personeelsnummer of e-mail) worden bijgewerkt, niet dubbel aangemaakt. Met een einddatum gaat iemand uit dienst; we verwijderen niemand.
      </p>

      {kopFout && <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] font-semibold text-ink-800" role="alert">{kopFout}</p>}

      {uitkomst && (
        <div className={`rounded-md border px-3 py-2 text-[13px] ${uitkomst.ok ? 'border-green-300 bg-green-50 text-green-900' : 'border-amber-300 bg-amber-50 text-ink-800'}`} role="status">
          {uitkomst.ok ? (
            <>
              <p className="font-semibold">
                Import klaar: {uitkomst.aangemaakt} nieuw, {uitkomst.bijgewerkt} bijgewerkt, {uitkomst.ongewijzigd} ongewijzigd, {uitkomst.uitDienst} uit dienst
                {uitkomst.taken > 0 && <>; {uitkomst.taken === 1 ? 'er staat een taak' : `er staan ${uitkomst.taken} taken`} klaar onder Taken</>}.
              </p>
              {uitkomst.mislukt.length > 0 && (
                <ul className="mt-1 list-disc pl-5">
                  {uitkomst.mislukt.slice(0, 10).map((m) => <li key={`${m.regel}-${m.naam}`}>Regel {m.regel} ({m.naam}): {m.reden}</li>)}
                </ul>
              )}
              {uitkomst.waarschuwingen.map((w) => <p key={w} className="mt-1">{w}</p>)}
            </>
          ) : (
            <p className="font-semibold">{uitkomst.fout ?? 'Importeren is niet gelukt.'}</p>
          )}
        </div>
      )}

      {voorvertoning.length > 0 && (
        <>
          <p className="text-[13px] text-ink-800">
            Voorvertoning: <span className="font-semibold">{tel('nieuw')}</span> nieuw, <span className="font-semibold">{tel('bijwerken')}</span> bijwerken,{' '}
            <span className="font-semibold">{tel('uit_dienst')}</span> uit dienst{tel('fout') > 0 && <>, <span className="font-semibold text-red-700">{tel('fout')}</span> overslaan</>}. Er is nog niets opgeslagen.
          </p>
          <div className="panel max-h-[24rem] overflow-auto">
            <table className="tbl">
              <thead>
                <tr><th>Actie</th><th>Naam</th><th>Personeelsnr.</th><th>E-mail</th><th>Afdeling</th><th>Start</th><th>Einde</th></tr>
              </thead>
              <tbody>
                {voorvertoning.slice(0, 300).map((v, i) => (
                  <tr key={`${i}-${v.personeelsnummer}-${v.email}`}>
                    <td className="whitespace-nowrap">
                      <span className={ACTIE_LABEL[v.actie].cls}>{ACTIE_LABEL[v.actie].tekst}</span>
                      {v.reden && <span className="block text-[11px] text-red-700">{v.reden}</span>}
                    </td>
                    <td className="max-w-[12rem] truncate">{v.naam || '-'}</td>
                    <td className="stil">{v.personeelsnummer || '-'}</td>
                    <td className="max-w-[14rem] truncate stil">{v.email || '-'}</td>
                    <td className="stil">{v.afdeling || '-'}</td>
                    <td className="stil whitespace-nowrap">{v.startdatum || '-'}</td>
                    <td className="stil whitespace-nowrap">{v.einddatum || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {voorvertoning.length > 300 && <p className="p-3 text-[12px] text-warm">En nog {voorvertoning.length - 300} rijen.</p>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-[13px] text-ink-800">
              <input type="checkbox" checked={taken} onChange={(e) => setTaken(e.target.checked)} />
              Taak voor Jessi: pakketten klaarzetten en kleding innemen
            </label>
            <div className="flex gap-2">
              <button type="button" className="knop-stil" onClick={() => { setRijen([]); setBestandsnaam(''); }} disabled={bezig}>Annuleren</button>
              <button type="button" className="knop-donker" onClick={importeer} disabled={bezig || goed.length === 0}>
                {bezig ? 'Importeren…' : `${goed.length} ${goed.length === 1 ? 'rij' : 'rijen'} importeren`}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
