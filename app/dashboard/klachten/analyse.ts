import type { KlachtMetLabels } from '@/lib/kms/service';

/** Rekenwerk voor de analyse-tab van Klachten. Puur: alleen de lijst erin, getallen eruit. */

const UUR = 3_600_000;

function telOp<T>(lijst: T[], sleutel: (x: T) => string | null): { label: string; waarde: number }[] {
  const m = new Map<string, number>();
  for (const x of lijst) {
    const k = sleutel(x);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([label, waarde]) => ({ label, waarde })).sort((a, b) => b.waarde - a.waarde || a.label.localeCompare(b.label, 'nl'));
}

function gemiddelde(waarden: number[]): number | null {
  const geldig = waarden.filter((w) => Number.isFinite(w) && w >= 0);
  return geldig.length ? geldig.reduce((a, b) => a + b, 0) / geldig.length : null;
}

export function reactieUren(k: KlachtMetLabels): number | null {
  if (!k.eerste_reactie_op) return null;
  return (new Date(k.eerste_reactie_op).getTime() - new Date(k.created_at).getTime()) / UUR;
}

export function oplosUren(k: KlachtMetLabels): number | null {
  if (!k.opgelost_op) return null;
  return (new Date(k.opgelost_op).getTime() - new Date(k.created_at).getTime()) / UUR;
}

export function maandLabels(aantal: number, nu = new Date()): { key: string; label: string }[] {
  const uit: { key: string; label: string }[] = [];
  for (let i = aantal - 1; i >= 0; i--) {
    const d = new Date(nu.getFullYear(), nu.getMonth() - i, 1);
    uit.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: new Intl.DateTimeFormat('nl-NL', { month: 'short' }).format(d).replace('.', ''),
    });
  }
  return uit;
}

export function perMaand<T extends { created_at: string }>(lijst: T[], aantal = 12, gewicht: (x: T) => number = () => 1) {
  const maanden = maandLabels(aantal);
  const tel = new Map(maanden.map((m) => [m.key, 0]));
  for (const x of lijst) {
    const d = new Date(x.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (tel.has(key)) tel.set(key, (tel.get(key) ?? 0) + gewicht(x));
  }
  return maanden.map((m) => ({ label: m.label, waarde: tel.get(m.key) ?? 0 }));
}

export function klachtAnalyse(klachten: KlachtMetLabels[]) {
  const metReactie = klachten.filter((k) => k.eerste_reactie_op);
  const slaGehaald = metReactie.filter((k) => k.sla === 'gehaald').length;
  return {
    totaal: klachten.length,
    klachten: klachten.filter((k) => k.soort === 'klacht').length,
    vragen: klachten.filter((k) => k.soort !== 'klacht').length,
    perCategorie: telOp(klachten, (k) => k.categorie ?? 'Niet ingedeeld'),
    perMaand: perMaand(klachten, 12),
    perProduct: telOp(klachten, (k) => k.product_naam).slice(0, 10).map((r) => ({
      ...r,
      sub: klachten.find((k) => k.product_naam === r.label)?.product_merk ?? undefined,
    })),
    perMerk: telOp(klachten, (k) => k.product_merk).slice(0, 10),
    perKlant: telOp(klachten, (k) => k.organisatie_naam).slice(0, 10),
    perBron: telOp(klachten, (k) => k.bron),
    gemReactieUren: gemiddelde(klachten.map(reactieUren).filter((x): x is number => x != null)),
    gemOplosUren: gemiddelde(klachten.map(oplosUren).filter((x): x is number => x != null)),
    slaPct: metReactie.length ? Math.round((slaGehaald / metReactie.length) * 100) : null,
    topOorzaken: telOp(klachten, (k) => {
      const o = (k.oorzaak ?? '').trim();
      return o ? o.charAt(0).toUpperCase() + o.slice(1).toLowerCase() : null;
    }).slice(0, 5),
    zonderOorzaak: klachten.filter((k) => k.status === 'afgehandeld' && !(k.oorzaak ?? '').trim()).length,
  };
}
