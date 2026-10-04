import * as XLSX from 'xlsx';
import { isLeadsDbConfigured } from '@/lib/env';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { logAudit } from '@/lib/kms/audit';
import { laadKlanten } from '@/lib/kms/analyseData';
import { datumKort } from '@/lib/kms/analysePeriode';
import { leesRapportFilters, vindRapport, type Cel, type KolomSoort, type RapportDef, type RapportFilters, type RapportTabel } from '@/lib/kms/rapportages';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Export van elk rapport uit de bibliotheek als CSV of Excel, met dezelfde
 * filters als de pagina: ?rapport=omzet-klant&formaat=xlsx&periode=jaar&klant=<id>.
 * De oude links (?rapport=budget-medewerker zonder formaat) werken nog en geven CSV.
 */

/* ---------------- CSV: Nederlandse Excel (puntkomma, decimale komma) ---------------- */

function csvCel(v: Cel, soort: KolomSoort): string {
  if (v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v))) return '';
  if (typeof v === 'number') {
    const n = soort === 'pct' ? Math.round(v * 1000) / 10 : soort === 'euro' ? Math.round(v * 100) / 100 : v;
    return String(n).replace('.', ',');
  }
  const s = soort === 'datum' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v.slice(8, 10)}-${v.slice(5, 7)}-${v.slice(0, 4)}` : v;
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const kopMetEenheid = (kop: string, soort: KolomSoort) => (soort === 'pct' && !kop.includes('%') ? `${kop} (%)` : kop);

function naarCsv(t: RapportTabel): string {
  const regels = [t.kolommen.map((k) => csvCel(kopMetEenheid(k.kop, k.soort), 'tekst')).join(';')];
  for (const r of t.rijen) regels.push(r.cellen.map((c, i) => csvCel(c, t.kolommen[i].soort)).join(';'));
  if (t.totalen) regels.push(t.totalen.map((c, i) => csvCel(c, t.kolommen[i].soort)).join(';'));
  return '﻿' + regels.join('\r\n');
}

/* ---------------- Excel: echte getallen, euro- en procentnotatie ---------------- */

const FORMAAT: Partial<Record<KolomSoort, string>> = { euro: '€ #,##0.00', pct: '0.0%', getal: '#,##0' };

function naarXlsx(def: RapportDef, t: RapportTabel, kopregels: string[]): Buffer {
  const datum = (v: Cel) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00Z`) : v);
  const aoa: (string | number | Date | null)[][] = [
    ...kopregels.map((r) => [r]),
    [],
    t.kolommen.map((k) => k.kop),
    ...t.rijen.map((r) => r.cellen.map((c, i) => (t.kolommen[i].soort === 'datum' ? datum(c) : typeof c === 'number' && !Number.isFinite(c) ? null : c))),
  ];
  const kopRij = kopregels.length + 1;
  if (t.totalen) aoa.push(t.totalen);
  if (t.samenvatting?.length) {
    aoa.push([], ['Samenvatting']);
    for (const s of t.samenvatting) aoa.push([s.label, Number.isFinite(s.waarde) ? s.waarde : null, s.uitleg ?? null]);
  }
  if (t.toelichting) aoa.push([], [t.toelichting]);

  const ws = XLSX.utils.aoa_to_sheet(aoa, { dateNF: 'dd-mm-yyyy' });
  // Getalnotatie per kolom voor de rijen en de totaalregel.
  const laatsteDataRij = kopRij + t.rijen.length + (t.totalen ? 1 : 0);
  t.kolommen.forEach((k, c) => {
    const z = FORMAAT[k.soort];
    if (!z) return;
    for (let r = kopRij + 1; r <= laatsteDataRij; r++) {
      const cel = ws[XLSX.utils.encode_cell({ r, c })];
      if (cel && cel.t === 'n') cel.z = z;
    }
  });
  if (t.samenvatting?.length) {
    const start = laatsteDataRij + 3;
    t.samenvatting.forEach((s, i) => {
      const cel = ws[XLSX.utils.encode_cell({ r: start + i, c: 1 })];
      if (cel && cel.t === 'n' && FORMAAT[s.soort]) cel.z = FORMAAT[s.soort];
    });
  }
  ws['!cols'] = t.kolommen.map((k, i) => {
    const breedste = Math.max(k.kop.length, ...t.rijen.slice(0, 200).map((r) => String(r.cellen[i] ?? '').length));
    return { wch: Math.min(60, Math.max(10, breedste + 2)) };
  });
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: kopRij, c: 0 }, e: { r: kopRij + t.rijen.length, c: Math.max(0, t.kolommen.length - 1) } }) };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, def.titel.slice(0, 31).replace(/[\\/?*[\]:]/g, ''));
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function bestandsnaam(def: RapportDef, f: RapportFilters, klant: string | null): string {
  const delen = [def.key, def.periode ? `${f.periode.van}_${f.periode.tot}` : f.periode.vandaag];
  if (klant) delen.push(klant.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40));
  return delen.join('_');
}

export async function GET(request: Request) {
  if (!(await dashAuthed())) return new Response('Niet toegestaan', { status: 401 });
  await eisEigenaar();
  if (!isLeadsDbConfigured) return new Response('Niet geconfigureerd', { status: 400 });

  const sp = Object.fromEntries(new URL(request.url).searchParams.entries());
  const def = vindRapport(sp.rapport) ?? vindRapport('omzet-klant')!;
  const formaat = sp.formaat === 'xlsx' ? 'xlsx' : 'csv';
  const filters = leesRapportFilters(def, sp);

  const [tabel, klanten] = await Promise.all([def.bouw(filters), filters.klantId ? laadKlanten() : Promise.resolve(null)]);
  const klantNaam = filters.klantId ? klanten?.get(filters.klantId)?.naam ?? null : null;
  const naam = bestandsnaam(def, filters, klantNaam);

  await logAudit('rapport_geexporteerd', {
    entiteit: 'rapport',
    details: { rapport: def.key, formaat, van: def.periode ? filters.periode.van : null, tot: def.periode ? filters.periode.tot : null, klant: filters.klantId, rijen: tabel.rijen.length },
  });

  if (formaat === 'xlsx') {
    const kop = [
      `Frederiks Bedrijfskleding · ${def.titel}`,
      def.periode ? `Periode: ${filters.periode.label}` : `Peildatum: ${datumKort(filters.periode.vandaag)}`,
      ...(klantNaam ? [`Klant: ${klantNaam}`] : []),
    ];
    const buf = naarXlsx(def, tabel, kop);
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${naam}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  return new Response(naarCsv(tabel), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${naam}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
