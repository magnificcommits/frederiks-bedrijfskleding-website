import { isLeadsDbConfigured } from '@/lib/env';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import {
  omzetPerKlant,
  omzetPerMerk,
  budgetPerMedewerker,
  verstrekkingenPerMedewerker,
  verbruikPerVestiging,
  verbruikPerAfdeling,
} from '@/lib/kms/rapportages';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RapportKey =
  | 'omzet-klant'
  | 'omzet-merk'
  | 'budget-medewerker'
  | 'verstrekkingen'
  | 'verbruik-vestiging'
  | 'verbruik-afdeling';

/**
 * Bouwt voor elk rapport een vaste set kolommen (kop + rijen).
 * Bedragen worden als getal met punt weggeschreven zodat Excel ze als getal leest.
 */
type Tabel = { bestand: string; kop: string[]; rijen: (string | number)[][] };

const rapporten: Record<RapportKey, () => Promise<Tabel>> = {
  'omzet-klant': async () => {
    const data = await omzetPerKlant();
    return {
      bestand: 'omzet-per-klant',
      kop: ['Klant', 'Omzet'],
      rijen: data.map((r) => [r.naam, r.bedrag]),
    };
  },
  'omzet-merk': async () => {
    const data = await omzetPerMerk();
    return {
      bestand: 'omzet-per-merk',
      kop: ['Merk', 'Omzet'],
      rijen: data.map((r) => [r.merk, r.bedrag]),
    };
  },
  'budget-medewerker': async () => {
    const data = await budgetPerMedewerker();
    return {
      bestand: 'budget-per-medewerker',
      kop: ['Medewerker', 'Organisatie', 'Budget', 'Verbruik', 'Percentage'],
      rijen: data.map((r) => [r.naam, r.organisatie_naam ?? '', r.budget, r.verbruik, r.percentage]),
    };
  },
  verstrekkingen: async () => {
    const data = await verstrekkingenPerMedewerker();
    return {
      bestand: 'verstrekkingen-per-medewerker',
      kop: ['Medewerker', 'Organisatie', 'Aantal'],
      rijen: data.map((r) => [r.naam, r.organisatie_naam ?? '', r.aantal]),
    };
  },
  'verbruik-vestiging': async () => {
    const data = await verbruikPerVestiging();
    return {
      bestand: 'verbruik-per-vestiging',
      kop: ['Vestiging', 'Bedrag', 'Aantal orders'],
      rijen: data.map((r) => [r.naam, r.bedrag, r.aantalOrders]),
    };
  },
  'verbruik-afdeling': async () => {
    const data = await verbruikPerAfdeling();
    return {
      bestand: 'verbruik-per-afdeling',
      kop: ['Afdeling', 'Bedrag', 'Aantal orders'],
      rijen: data.map((r) => [r.naam, r.bedrag, r.aantalOrders]),
    };
  },
};

// Velden met puntkomma, aanhalingstekens of regeleindes krijgen quotes; getallen blijven kaal.
function esc(v: string | number): string {
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '0';
  const s = String(v ?? '');
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: Request) {
  if (!(await dashAuthed())) {
    return new Response('Niet toegestaan', { status: 401 });
  }
  await eisEigenaar();
  if (!isLeadsDbConfigured) return new Response('Niet geconfigureerd', { status: 400 });

  const gevraagd = new URL(request.url).searchParams.get('rapport');
  const key: RapportKey = gevraagd && gevraagd in rapporten ? (gevraagd as RapportKey) : 'omzet-klant';

  const { bestand, kop, rijen } = await rapporten[key]();
  const regels = [kop.map(esc).join(';'), ...rijen.map((r) => r.map(esc).join(';'))];
  const csv = '﻿' + regels.join('\r\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${bestand}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
