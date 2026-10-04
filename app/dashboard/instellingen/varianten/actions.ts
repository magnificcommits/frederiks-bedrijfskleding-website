'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed, eisEigenaar, magEigenaar } from '@/lib/kms/adminClient';
import { logAudit } from '@/lib/kms/audit';
import {
  maakKleur,
  werkKleur,
  verwijderKleur,
  voegKleurAliasToe,
  verwijderKleurAlias,
  maakReeks,
  werkReeks,
  verwijderReeks,
  voegMatenToe,
  verwijderMaat,
  zetMaatVolgorde,
  voegMaatAliasToe,
  verwijderMaatAlias,
  voegEigenschapToe,
  verwijderEigenschap,
  zetVariantenOm,
  type OmzetResultaat,
} from '@/lib/kms/varianten';

const PAD = '/dashboard/instellingen/varianten';

async function toegang() {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
}

const tekst = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

/** Terug naar het juiste tabblad, met een toast bij succes of een melding bij een fout. */
function terug(tab: string, uitkomst: { ok: true } | { ok: false; fout: string }, ok = 'opgeslagen'): never {
  const p = new URLSearchParams({ tab });
  if (uitkomst.ok) p.set('ok', ok);
  else p.set('melding', uitkomst.fout);
  redirect(`${PAD}?${p}`);
}

// --- Kleuren ---------------------------------------------------------------

export async function kleurNieuwActie(fd: FormData) {
  await toegang();
  const r = await maakKleur({
    naam: tekst(fd, 'naam'),
    hex: tekst(fd, 'hex'),
    hex2: fd.get('tweekleurig') ? tekst(fd, 'hex2') : null,
    groep: tekst(fd, 'groep'),
  });
  if (r.ok) await logAudit('variantkleur_aangemaakt', { entiteit: 'variant_kleuren', entiteitId: r.id, details: { naam: tekst(fd, 'naam') } });
  terug('kleuren', r, 'toegevoegd');
}

export async function kleurOpslaanActie(fd: FormData) {
  await toegang();
  const id = tekst(fd, 'id');
  const r = await werkKleur(id, {
    naam: tekst(fd, 'naam'),
    hex: tekst(fd, 'hex'),
    hex2: fd.get('tweekleurig') ? tekst(fd, 'hex2') : null,
    groep: tekst(fd, 'groep'),
    volgorde: Number(tekst(fd, 'volgorde')),
    actief: fd.get('actief') === 'on',
  });
  if (r.ok) await logAudit('variantkleur_gewijzigd', { entiteit: 'variant_kleuren', entiteitId: id, details: { naam: tekst(fd, 'naam') } });
  terug('kleuren', r);
}

export async function kleurVerwijderActie(fd: FormData) {
  await toegang();
  const id = tekst(fd, 'id');
  const r = await verwijderKleur(id);
  if (r.ok) await logAudit('variantkleur_verwijderd', { entiteit: 'variant_kleuren', entiteitId: id });
  terug('kleuren', r, 'verwijderd');
}

export async function kleurAliasToevoegenActie(fd: FormData) {
  await toegang();
  terug('kleuren', await voegKleurAliasToe(tekst(fd, 'kleur_id'), tekst(fd, 'alias')), 'toegevoegd');
}

export async function kleurAliasVerwijderActie(fd: FormData) {
  await toegang();
  terug('kleuren', await verwijderKleurAlias(tekst(fd, 'sleutel')), 'verwijderd');
}

// --- Maten -----------------------------------------------------------------

export async function reeksNieuwActie(fd: FormData) {
  await toegang();
  terug('maten', await maakReeks(tekst(fd, 'naam')), 'toegevoegd');
}

export async function reeksOpslaanActie(fd: FormData) {
  await toegang();
  const id = tekst(fd, 'id');
  const r = await werkReeks(id, { naam: tekst(fd, 'naam'), volgorde: Number(tekst(fd, 'volgorde')) });
  if (!r.ok) terug('maten', r);
  const volgorde = tekst(fd, 'maten_volgorde');
  if (volgorde) terug('maten', await zetMaatVolgorde(id, volgorde.split(/[,;\n]+/).map((m) => m.trim()).filter(Boolean)));
  terug('maten', r);
}

export async function reeksVerwijderActie(fd: FormData) {
  await toegang();
  const id = tekst(fd, 'id');
  const r = await verwijderReeks(id);
  if (r.ok) await logAudit('maatreeks_verwijderd', { entiteit: 'variant_maatreeksen', entiteitId: id });
  terug('maten', r, 'verwijderd');
}

export async function matenToevoegenActie(fd: FormData) {
  await toegang();
  const r = await voegMatenToe(tekst(fd, 'reeks_id'), tekst(fd, 'maten'));
  terug('maten', r.ok ? { ok: true } : r, 'toegevoegd');
}

export async function maatVerwijderActie(fd: FormData) {
  await toegang();
  terug('maten', await verwijderMaat(tekst(fd, 'id')), 'verwijderd');
}

export async function maatAliasToevoegenActie(fd: FormData) {
  await toegang();
  terug('maten', await voegMaatAliasToe(tekst(fd, 'alias'), tekst(fd, 'maat')), 'toegevoegd');
}

export async function maatAliasVerwijderActie(fd: FormData) {
  await toegang();
  terug('maten', await verwijderMaatAlias(tekst(fd, 'sleutel')), 'verwijderd');
}

// --- Lengte en pasvorm -----------------------------------------------------

export async function eigenschapToevoegenActie(fd: FormData) {
  await toegang();
  const soort = tekst(fd, 'soort') === 'pasvorm' ? 'pasvorm' : 'lengte';
  terug('overig', await voegEigenschapToe(soort, tekst(fd, 'waarde')), 'toegevoegd');
}

export async function eigenschapVerwijderActie(fd: FormData) {
  await toegang();
  terug('overig', await verwijderEigenschap(tekst(fd, 'id')), 'verwijderd');
}

// --- Opschonen -------------------------------------------------------------

export type OmzetInvoer = {
  veld: 'kleur' | 'maat';
  paren: { van: string; naar: string }[];
  nieuweKleuren: { naam: string; hex: string; hex2: string | null; groep: string }[];
  leerAlias: boolean;
};

export type OmzetUitkomst =
  | { ok: true; omgezet: number; overgeslagen: number; fotos: number; aliassen: number; nieuweKleuren: number; resultaten: OmzetResultaat[] }
  | { ok: false; fout: string };

/**
 * Zet de gekozen waarden om. Wordt vanuit de opschoontool aangeroepen na een
 * bevestiging met het aantal varianten erbij. Schrijft niets zonder die klik.
 */
export async function omzettenActie(invoer: OmzetInvoer): Promise<OmzetUitkomst> {
  if (!(await dashAuthed())) return { ok: false, fout: 'Je bent niet ingelogd.' };
  if (!(await magEigenaar())) return { ok: false, fout: 'Alleen de eigenaar kan varianten omzetten.' };
  if (invoer?.veld !== 'kleur' && invoer?.veld !== 'maat') return { ok: false, fout: 'Onbekend veld.' };
  const paren = (Array.isArray(invoer.paren) ? invoer.paren : [])
    .filter((p) => p && typeof p.van === 'string' && typeof p.naar === 'string')
    .slice(0, 1000);
  const nieuwe = (Array.isArray(invoer.nieuweKleuren) ? invoer.nieuweKleuren : [])
    .filter((k) => k && typeof k.naam === 'string' && typeof k.hex === 'string')
    .slice(0, 300);

  const r = await zetVariantenOm(invoer.veld, paren, { leerAlias: invoer.leerAlias !== false, nieuweKleuren: nieuwe });
  if (!r.ok) return r;

  const omgezet = r.resultaten.reduce((n, x) => n + (x.omgezet ?? 0), 0);
  const overgeslagen = r.resultaten.reduce((n, x) => n + (x.overgeslagen ?? 0), 0);
  const fotos = r.resultaten.reduce((n, x) => n + (x.fotos ?? 0), 0);
  await logAudit('varianten_omgezet', {
    entiteit: 'product_varianten',
    details: {
      veld: invoer.veld,
      waarden: paren.length,
      omgezet,
      overgeslagen,
      aliassen: r.aliassen,
      nieuweKleuren: r.nieuweKleuren,
      paren: r.resultaten.slice(0, 200).map((x) => ({ van: x.van, naar: x.naar, n: x.omgezet })),
    },
  });
  revalidatePath(PAD);
  revalidatePath('/dashboard/producten');
  return { ok: true, omgezet, overgeslagen, fotos, aliassen: r.aliassen, nieuweKleuren: r.nieuweKleuren, resultaten: r.resultaten };
}
