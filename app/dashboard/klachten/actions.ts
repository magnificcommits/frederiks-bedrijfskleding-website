'use server';
import { redirect } from 'next/navigation';
import { dashAuthed, getHuidigeAdmin } from '@/lib/kms/adminClient';
import { logAudit } from '@/lib/kms/audit';
import { bevestigPersoon, leesPersoonKeuze } from '@/lib/kms/personen';
import {
  isUuid,
  mailKlachtAntwoord,
  maakKlacht,
  ordersVoorKlant,
  productenVanOrder,
  sluitKlacht,
  voegKlachtBerichtToe,
  werkKlachtBij,
  zetKlachtStatus,
  zoekProducten,
  KLACHT_STATUSSEN,
  type ProductKeuze,
} from '@/lib/kms/service';

function tekstOfNull(raw: FormDataEntryValue | null): string | null {
  const s = String(raw ?? '').trim();
  return s === '' ? null : s;
}

/** Terug naar de lijst met dezelfde filters; alleen paden binnen Klachten. */
function terugUrl(formData: FormData, extra: Record<string, string>): string {
  const ruw = String(formData.get('terug') ?? '');
  const basis = ruw.startsWith('/dashboard/klachten') ? ruw : '/dashboard/klachten';
  const [pad, qs = ''] = basis.split('?');
  const p = new URLSearchParams(qs);
  for (const k of ['melding', 'ok', 'fout', 'nieuw']) p.delete(k);
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  const s = p.toString();
  return s ? `${pad}?${s}` : pad;
}

async function auteurNaam(): Promise<string> {
  try {
    const a = await getHuidigeAdmin();
    if (a) return a.naam || a.email;
  } catch {
    // geen sessie
  }
  return 'Frederiks';
}

export async function nieuweKlacht(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const omschrijving = String(formData.get('omschrijving') ?? '').trim();
  const organisatie_id = tekstOfNull(formData.get('organisatie_id'));
  if (!omschrijving || !isUuid(organisatie_id)) redirect('/dashboard/klachten?melding=klant-nodig');

  // Alleen een contactpersoon of werknemer die echt bij deze klant hoort; anders blijft alleen de naam over.
  const persoon = await bevestigPersoon(leesPersoonKeuze(formData, 'contact'), organisatie_id);
  const id = await maakKlacht({
    organisatie_id,
    soort: tekstOfNull(formData.get('soort')),
    omschrijving,
    categorie: tekstOfNull(formData.get('categorie')),
    prioriteit: tekstOfNull(formData.get('prioriteit')),
    toegewezen_aan: tekstOfNull(formData.get('toegewezen_aan')),
    order_id: tekstOfNull(formData.get('order_id')),
    product_id: tekstOfNull(formData.get('product_id')),
    bron: tekstOfNull(formData.get('bron')) ?? 'telefoon',
    contact_id: persoon.soort === 'contact' ? persoon.id : null,
    medewerker_id: persoon.soort === 'medewerker' ? persoon.id : null,
    contact_naam: persoon.naam,
  });
  if (!id) redirect('/dashboard/klachten?melding=mislukt');
  await logAudit('klacht_aangemaakt', { entiteit: 'klacht', entiteitId: id, details: { organisatie_id } });
  redirect(`/dashboard/klachten?id=${id}&melding=aangemaakt`);
}

export async function wijzigKlachtStatus(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('klachtId') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  if (isUuid(id) && (KLACHT_STATUSSEN as readonly string[]).includes(status)) {
    await zetKlachtStatus(id, status);
    await logAudit('klachtstatus_gewijzigd', { entiteit: 'klacht', entiteitId: id, details: { status } });
  }
  redirect(terugUrl(formData, { melding: 'status' }));
}

export async function werkKlachtBijActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('klachtId') ?? '').trim();
  if (!isUuid(id)) redirect(terugUrl(formData, {}));
  const velden = {
    categorie: tekstOfNull(formData.get('categorie')),
    prioriteit: tekstOfNull(formData.get('prioriteit')),
    toegewezen_aan: tekstOfNull(formData.get('toegewezen_aan')),
    order_id: tekstOfNull(formData.get('order_id')),
    product_id: tekstOfNull(formData.get('product_id')),
    soort: tekstOfNull(formData.get('soort')),
  };
  const res = await werkKlachtBij(id, velden);
  if (res.ok) await logAudit('klacht_bijgewerkt', { entiteit: 'klacht', entiteitId: id, details: velden });
  redirect(terugUrl(formData, { melding: !res.ok ? 'mislukt' : res.zonderMigratie ? 'migratie' : 'opgeslagen' }));
}

export async function klachtBericht(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('klachtId') ?? '').trim();
  const tekst = String(formData.get('tekst') ?? '').trim();
  const soort = formData.get('soort') === 'notitie' ? 'notitie' : 'antwoord';
  if (!isUuid(id) || !tekst) redirect(terugUrl(formData, { melding: 'leeg' }));

  const res = await voegKlachtBerichtToe(id, soort, tekst, await auteurNaam());
  if (!res.ok) redirect(terugUrl(formData, { melding: res.zonderMigratie ? 'migratie' : 'mislukt' }));
  await logAudit(soort === 'antwoord' ? 'klacht_beantwoord' : 'klacht_notitie', { entiteit: 'klacht', entiteitId: id });

  let melding = soort === 'antwoord' ? 'beantwoord' : 'notitie';
  if (soort === 'antwoord' && formData.get('mailen') === 'on') {
    const mail = await mailKlachtAntwoord(id, res.berichtId, tekst);
    melding = mail.sent ? 'gemaild' : 'niet-gemaild';
  }
  redirect(terugUrl(formData, { melding }));
}

export async function sluitKlachtActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('klachtId') ?? '').trim();
  if (!isUuid(id)) redirect(terugUrl(formData, {}));
  const oplossing = tekstOfNull(formData.get('oplossing'));
  const oorzaak = tekstOfNull(formData.get('oorzaak'));

  // Oplossing desgewenst ook als antwoord aan de klant, vóór het sluiten.
  let mailMelding: string | null = null;
  if (oplossing && formData.get('naar_klant') === 'on') {
    const b = await voegKlachtBerichtToe(id, 'antwoord', oplossing, await auteurNaam());
    if (b.ok && formData.get('mailen') === 'on') {
      const mail = await mailKlachtAntwoord(id, b.berichtId, oplossing);
      mailMelding = mail.sent ? 'gesloten-gemaild' : 'gesloten-niet-gemaild';
    }
  }
  const res = await sluitKlacht(id, oplossing, oorzaak);
  if (res.ok) await logAudit('klacht_gesloten', { entiteit: 'klacht', entiteitId: id, details: { oorzaak } });
  redirect(terugUrl(formData, { melding: !res.ok ? 'mislukt' : mailMelding ?? (res.zonderMigratie ? 'gesloten-migratie' : 'gesloten') }));
}

/* ---- voor de client-onderdelen (klantzoeker, ordertjes, artikelzoeker) ---- */

export async function ordersVoorKlantActie(orgId: string) {
  if (!(await dashAuthed())) return [];
  return ordersVoorKlant(orgId);
}

export async function zoekProductenActie(q: string): Promise<ProductKeuze[]> {
  if (!(await dashAuthed())) return [];
  return zoekProducten(String(q ?? '').slice(0, 60));
}

export async function productenVanOrderActie(orderId: string): Promise<ProductKeuze[]> {
  if (!(await dashAuthed())) return [];
  return productenVanOrder(orderId);
}
