'use server';
import { redirect } from 'next/navigation';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { logWijziging } from '@/lib/kms/audit';
import {
  getKlachtInstellingen,
  getReparatieInstellingen,
  getRetourbeleid,
  isUuid,
  zetKlachtInstellingen,
  zetReparatieInstellingen,
  zetRetourbeleidVelden,
  zetRetourredenen,
  zetTermijnVoorKlant,
  STANDAARD_SLA,
  type KlachtPrioriteit,
} from '@/lib/kms/service';

/**
 * Instellingen voor Service: retourbeleid, retourredenen, afwijkende termijnen per klant,
 * klachtcategorieën en streefreactietijden. Alles in de tabel `instellingen`; de
 * retourtermijn houdt zijn sleutel `retourtermijn_dagen`.
 */

const TERUG = '/dashboard/instellingen/service';

async function bewaak() {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
}

function regels(raw: FormDataEntryValue | null): string[] {
  return String(raw ?? '')
    .split('\n')
    .map((r) => r.trim())
    .filter(Boolean);
}

export async function zetRetourbeleidActie(formData: FormData) {
  await bewaak();
  const vorig = await getRetourbeleid();
  const dagen = Number.parseInt(String(formData.get('dagen') ?? '').trim(), 10);
  const nieuw = {
    termijnDagen: Number.isFinite(dagen) && dagen > 0 ? dagen : vorig.termijnDagen,
    voorwaarden: {
      ongedragen: formData.get('ongedragen') === 'on',
      metLabels: formData.get('metLabels') === 'on',
      geenBedrukt: formData.get('geenBedrukt') === 'on',
      extra: String(formData.get('extra') ?? '').trim(),
    },
    retouradres: String(formData.get('retouradres') ?? '').trim(),
    instructie: String(formData.get('instructie') ?? '').trim(),
  };
  const ok = await zetRetourbeleidVelden(nieuw);
  await logWijziging('retourbeleid_gewijzigd', {
    entiteit: 'instellingen',
    voor: { retourtermijn_dagen: vorig.termijnDagen, voorwaarden: vorig.voorwaarden, retouradres: vorig.retouradres, instructie: vorig.instructie },
    na: { retourtermijn_dagen: nieuw.termijnDagen, voorwaarden: nieuw.voorwaarden, retouradres: nieuw.retouradres, instructie: nieuw.instructie },
  });
  redirect(`${TERUG}?melding=${ok ? 'beleid' : 'mislukt'}#retourbeleid`);
}

export async function zetRetourredenenActie(formData: FormData) {
  await bewaak();
  const vorig = (await getRetourbeleid()).redenen;
  const lijst = regels(formData.get('redenen'));
  const ok = await zetRetourredenen(lijst);
  await logWijziging('retourredenen_gewijzigd', { entiteit: 'instellingen', voor: { redenen: vorig }, na: { redenen: lijst } });
  redirect(`${TERUG}?melding=${ok ? 'redenen' : 'mislukt'}#redenen`);
}

export async function zetKlantTermijnActie(formData: FormData) {
  await bewaak();
  const orgId = String(formData.get('organisatie_id') ?? '').trim();
  if (!isUuid(orgId)) redirect(`${TERUG}?melding=klant-nodig#per-klant`);
  const ruw = String(formData.get('dagen') ?? '').trim();
  const dagen = ruw === '' ? null : Number.parseInt(ruw, 10);
  const vorig = (await getRetourbeleid()).termijnPerKlant[orgId] ?? null;
  const ok = await zetTermijnVoorKlant(orgId, dagen && dagen > 0 ? dagen : null);
  await logWijziging('retourtermijn_klant_gewijzigd', {
    entiteit: 'organisatie',
    entiteitId: orgId,
    voor: { retourtermijn_dagen: vorig },
    na: { retourtermijn_dagen: dagen && dagen > 0 ? dagen : null },
  });
  redirect(`${TERUG}?melding=${ok ? 'klant' : 'mislukt'}#per-klant`);
}

export async function zetReparatieInstellingenActie(formData: FormData) {
  await bewaak();
  const vorig = await getReparatieInstellingen();
  const ruw = String(formData.get('kosten') ?? '').trim().replace(',', '.');
  const kosten = ruw === '' ? null : Number(ruw);
  const nieuw = {
    aan: formData.get('aan') === 'on',
    kosten: kosten != null && Number.isFinite(kosten) && kosten >= 0 ? kosten : null,
    tekst: String(formData.get('tekst') ?? '').trim(),
  };
  const ok = await zetReparatieInstellingen(nieuw);
  await logWijziging('reparatie_instellingen_gewijzigd', { entiteit: 'instellingen', voor: vorig, na: nieuw });
  redirect(`${TERUG}?melding=${ok ? 'reparaties' : 'mislukt'}#reparaties`);
}

export async function zetKlachtInstellingenActie(formData: FormData) {
  await bewaak();
  const vorig = await getKlachtInstellingen();
  const uren = (k: KlachtPrioriteit) => {
    const n = Number(String(formData.get(`sla_${k}`) ?? '').replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? Math.min(n, 24 * 30) : STANDAARD_SLA[k];
  };
  const nieuw = {
    categorieen: regels(formData.get('categorieen')),
    sla: { hoog: uren('hoog'), normaal: uren('normaal'), laag: uren('laag') },
  };
  const ok = await zetKlachtInstellingen(nieuw);
  await logWijziging('klachtinstellingen_gewijzigd', { entiteit: 'instellingen', voor: vorig, na: nieuw });
  redirect(`${TERUG}?melding=${ok ? 'klachten' : 'mislukt'}#klachten`);
}
