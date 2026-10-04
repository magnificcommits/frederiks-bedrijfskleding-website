'use server';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import { uploadMedia } from '@/lib/kms/storage';
import { getProduct, werkProduct as werkProductDb, zetProductActief, maakVariant, werkVariant as werkVariantDb, verwijderVariant as verwijderVariantDb } from '@/lib/kms/producten';
import { zetKleurAfbeelding, verwijderKleurAfbeelding, bewaarFotoMetingen } from '@/lib/kms/afbeeldingen';
import { laadVariantLijsten } from '@/lib/kms/varianten';
import { kleurNaam, maatNaam } from '@/lib/kms/variantenStandaard';
import { aiTekst } from '@/lib/ai';

function getalOfNull(raw: string): number | null {
  const s = String(raw ?? '').replace(/[^0-9.,-]/g, '').replace(',', '.');
  return s === '' ? null : Number(s);
}
function getalOf0(raw: string): number {
  const n = getalOfNull(raw);
  return n == null ? 0 : n;
}

/**
 * Maat en kleur uit het formulier, naar de vaste lijst vertaald ("black" wordt
 * "Zwart", "XXL" wordt "2XL"). Een waarde die niet is aangeraakt (gelijk aan het
 * verborgen veld *_oud) blijft precies staan, zodat een leverancierswaarde met
 * kleurcode niet ongemerkt verandert bij het opslaan van een prijs.
 */
async function variantWaarden(formData: FormData): Promise<{ maat: string | null; kleur: string | null }> {
  const lijst = await laadVariantLijsten();
  const maat = String(formData.get('maat') ?? '').trim();
  const kleur = String(formData.get('kleur') ?? '').trim();
  const maatOud = formData.has('maat_oud') ? String(formData.get('maat_oud') ?? '').trim() : null;
  const kleurOud = formData.has('kleur_oud') ? String(formData.get('kleur_oud') ?? '').trim() : null;
  return {
    maat: maat === maatOud ? maat || null : maatNaam(maat, lijst),
    kleur: kleur === kleurOud ? kleur || null : kleurNaam(kleur, lijst),
  };
}

/** Meting uit FotoInvoer bewaren bij de uiteindelijke URL. Stil als dat niet lukt. */
async function bewaarMeting(formData: FormData, productId: string, url: string, kleur: string | null) {
  const ruw = String(formData.get('foto_meting') ?? '');
  if (!ruw || !url) return;
  try {
    const m = JSON.parse(ruw) as Record<string, unknown>;
    const n = (k: string) => (typeof m[k] === 'number' ? (m[k] as number) : null);
    await bewaarFotoMetingen([
      {
        productId,
        kleur,
        url,
        breedte: n('breedte'),
        hoogte: n('hoogte'),
        bytes: n('bytes'),
        scherpte: n('scherpte'),
        witruimte: n('witruimte'),
        uitMidden: n('uitMidden'),
        vulling: n('vulling'),
        problemen: Array.isArray(m.problemen) ? (m.problemen as string[]) : [],
      },
    ]);
  } catch {
    // Geen geldige meting: dan meet de fotocontrole hem later.
  }
}

export async function werkProduct(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('productId') ?? '');
  const naam = String(formData.get('naam') ?? '').trim();
  if (!id || !naam) redirect('/dashboard/producten');
  const afbeeldingen = formData.getAll('afbeelding').map((a) => String(a).trim()).filter(Boolean);
  const geupload = await uploadMedia(formData.get('afbeelding_bestand') as File | null, 'producten');
  if (geupload) {
    afbeeldingen.push(geupload);
    await bewaarMeting(formData, id, geupload, null);
  }
  await werkProductDb(id, {
    naam,
    omschrijving: String(formData.get('omschrijving') ?? '').trim() || null,
    sku: String(formData.get('sku') ?? '').trim() || null,
    ean: String(formData.get('ean') ?? '').trim() || null,
    art_nr_leverancier: String(formData.get('art_nr_leverancier') ?? '').trim() || null,
    merk: String(formData.get('merk') ?? '').trim() || null,
    categorie: String(formData.get('categorie') ?? '').trim() || null,
    subcategorie: String(formData.get('subcategorie') ?? '').trim() || null,
    geslacht: String(formData.get('geslacht') ?? '').trim() || null,
    materiaal: String(formData.get('materiaal') ?? '').trim() || null,
    normeringen: String(formData.get('normeringen') ?? '').trim() || null,
    btw: getalOfNull(String(formData.get('btw') ?? '')) ?? 21,
    min_voorraad: (() => {
      const n = getalOfNull(String(formData.get('min_voorraad') ?? ''));
      return n == null ? null : Math.trunc(n);
    })(),
    wasinstructies: String(formData.get('wasinstructies') ?? '').trim() || null,
    leverancier_id: String(formData.get('leverancier_id') ?? '').trim() || null,
    afbeeldingen,
  });
  redirect('/dashboard/producten/' + id + '?tab=gegevens');
}

export async function verwijderAfbeelding(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('productId') ?? '');
  const url = String(formData.get('url') ?? '').trim();
  if (!id || !url) redirect('/dashboard/producten/' + id);
  const product = await getProduct(id);
  if (product) {
    const afbeeldingen = (product.afbeeldingen ?? []).filter((a) => a !== url);
    await werkProductDb(id, { naam: product.naam, afbeeldingen });
  }
  redirect('/dashboard/producten/' + id + '?tab=kleuren');
}

export async function schakelActief(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('productId') ?? '');
  const actief = String(formData.get('actief') ?? '') === 'true';
  if (id) await zetProductActief(id, actief);
  redirect('/dashboard/producten/' + id);
}

export async function voegVariantToe(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('productId') ?? '');
  if (!id) redirect('/dashboard/producten');
  const { maat, kleur } = await variantWaarden(formData);
  await maakVariant(id, {
    maat,
    kleur,
    ean: String(formData.get('ean') ?? '').trim() || null,
    inkoopprijs: getalOfNull(String(formData.get('inkoopprijs') ?? '')),
    verkoopprijs: getalOfNull(String(formData.get('verkoopprijs') ?? '')),
    meerprijs: getalOf0(String(formData.get('meerprijs') ?? '')),
    voorraad: Math.trunc(getalOf0(String(formData.get('voorraad') ?? ''))),
  });
  redirect('/dashboard/producten/' + id);
}

export async function werkVariant(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('productId') ?? '');
  const variantId = String(formData.get('variantId') ?? '');
  if (!variantId) redirect('/dashboard/producten/' + id);
  const { maat, kleur } = await variantWaarden(formData);
  await werkVariantDb(variantId, {
    maat,
    kleur,
    inkoopprijs: getalOfNull(String(formData.get('inkoopprijs') ?? '')),
    verkoopprijs: getalOfNull(String(formData.get('verkoopprijs') ?? '')),
    meerprijs: getalOf0(String(formData.get('meerprijs') ?? '')),
    voorraad: Math.trunc(getalOf0(String(formData.get('voorraad') ?? ''))),
  });
  redirect('/dashboard/producten/' + id);
}

export async function verwijderVariant(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('productId') ?? '');
  const variantId = String(formData.get('variantId') ?? '');
  if (variantId) await verwijderVariantDb(variantId);
  redirect('/dashboard/producten/' + id);
}

export async function zetKleurAfbeeldingActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('productId') ?? '');
  const kleur = String(formData.get('kleur') ?? '').trim();
  if (!id || !kleur) redirect('/dashboard/producten/' + id);
  let url = String(formData.get('afbeelding_url') ?? '').trim();
  const geupload = await uploadMedia(formData.get('afbeelding_bestand') as File | null, 'producten');
  if (geupload) url = geupload;
  if (url) {
    await zetKleurAfbeelding(id, kleur, url);
    await bewaarMeting(formData, id, url, kleur);
  }
  redirect('/dashboard/producten/' + id + '?tab=kleuren');
}

export async function verwijderKleurAfbeeldingActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('productId') ?? '');
  const kleur = String(formData.get('kleur') ?? '').trim();
  if (id && kleur) await verwijderKleurAfbeelding(id, kleur);
  redirect('/dashboard/producten/' + id + '?tab=kleuren');
}

/**
 * Genereert met de bestaande AI-laag (Claude) een korte productbeschrijving op
 * basis van de productvelden. Vorm is geschikt voor useActionState. Geen redirect:
 * het resultaat wordt teruggegeven zodat de beheerder het zelf kan plakken.
 * De AI-key blijft volledig server-side.
 */
export async function genereerBeschrijvingActie(
  _prev: { tekst?: string; error?: string } | null,
  formData: FormData,
): Promise<{ tekst?: string; error?: string }> {
  if (!(await dashAuthed())) return { error: 'Geen toegang.' };

  const naam = String(formData.get('naam') ?? '').trim();
  const merk = String(formData.get('merk') ?? '').trim();
  const categorie = String(formData.get('categorie') ?? '').trim();
  const materiaal = String(formData.get('materiaal') ?? '').trim();
  const normeringen = String(formData.get('normeringen') ?? '').trim();

  const opdracht =
    'Schrijf een korte, wervende maar zakelijke productbeschrijving (2-3 zinnen) ' +
    'voor dit werkkledingartikel: ' +
    `naam=${naam || 'onbekend'}, ` +
    `merk=${merk || 'onbekend'}, ` +
    `categorie=${categorie || 'onbekend'}, ` +
    `materiaal=${materiaal || 'onbekend'}, ` +
    `normeringen=${normeringen || 'geen'}. ` +
    'Schrijf in het Nederlands, concreet, geen overdreven verkooptaal.';

  const resultaat = await aiTekst(opdracht);
  if (!resultaat.ok) {
    return { error: resultaat.error ?? 'Er ging iets mis bij het genereren.' };
  }
  return { tekst: resultaat.tekst };
}
