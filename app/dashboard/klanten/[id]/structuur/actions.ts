'use server';
import { redirect } from 'next/navigation';
import { dashAuthed } from '@/lib/kms/adminClient';
import {
  werkInstellingen,
  maakVestiging,
  verwijderVestiging,
  maakAfdeling,
  verwijderAfdeling,
  zetManagerScope,
} from '@/lib/kms/structuur';

function getal(formData: FormData, naam: string): number | null {
  const ruw = String(formData.get(naam) ?? '').replace(/[^0-9.,]/g, '').replace(',', '.');
  return ruw === '' ? null : Number(ruw);
}

function datum(formData: FormData, naam: string): string | null {
  return String(formData.get(naam) ?? '').trim() || null;
}

function aan(formData: FormData, naam: string): boolean {
  return String(formData.get(naam) ?? '') === 'on';
}

export async function bewaarInstellingen(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('orgId') ?? '');
  if (id) {
    await werkInstellingen(id, {
      type: String(formData.get('type') ?? '').trim() || null,
      min_bestelbedrag: getal(formData, 'min_bestelbedrag'),
      max_bestelbedrag: getal(formData, 'max_bestelbedrag'),
      verzendkosten: getal(formData, 'verzendkosten'),
      bestelperiode_start: datum(formData, 'bestelperiode_start'),
      bestelperiode_eind: datum(formData, 'bestelperiode_eind'),
      toon_kortingen: aan(formData, 'toon_kortingen'),
      gebruik_referentienr: aan(formData, 'gebruik_referentienr'),
      opmerking_bij_bestelling: aan(formData, 'opmerking_bij_bestelling'),
      toon_voorraad: aan(formData, 'toon_voorraad'),
      voorwaarden_tekst: String(formData.get('voorwaarden_tekst') ?? '').trim() || null,
      voorschriften_tekst: String(formData.get('voorschriften_tekst') ?? '').trim() || null,
      huisstijl_kleur: String(formData.get('huisstijl_kleur') ?? '').trim() || null,
      portaal_logo_url: String(formData.get('portaal_logo_url') ?? '').trim() || null,
      sfeerafbeelding_url: String(formData.get('sfeerafbeelding_url') ?? '').trim() || null,
    });
  }
  redirect('/dashboard/klanten/' + id + '/structuur');
}

export async function voegVestigingToe(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('orgId') ?? '');
  const naam = String(formData.get('naam') ?? '').trim();
  if (id && naam) {
    await maakVestiging(id, {
      naam,
      leveradres: String(formData.get('leveradres') ?? '').trim() || null,
      leverpostcode: String(formData.get('leverpostcode') ?? '').trim() || null,
      leverplaats: String(formData.get('leverplaats') ?? '').trim() || null,
      factuuradres: String(formData.get('factuuradres') ?? '').trim() || null,
      factuurpostcode: String(formData.get('factuurpostcode') ?? '').trim() || null,
      factuurplaats: String(formData.get('factuurplaats') ?? '').trim() || null,
    });
  }
  redirect('/dashboard/klanten/' + id + '/structuur');
}

export async function verwijderVestigingActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('orgId') ?? '');
  const vestigingId = String(formData.get('vestigingId') ?? '');
  if (vestigingId) await verwijderVestiging(vestigingId);
  redirect('/dashboard/klanten/' + id + '/structuur');
}

export async function voegAfdelingToe(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('orgId') ?? '');
  const naam = String(formData.get('naam') ?? '').trim();
  if (id && naam) {
    await maakAfdeling(id, {
      naam,
      kostenplaats: String(formData.get('kostenplaats') ?? '').trim() || null,
      leidinggevende: String(formData.get('leidinggevende') ?? '').trim() || null,
      vestiging_id: String(formData.get('vestiging_id') ?? '').trim() || null,
      leveradres: String(formData.get('leveradres') ?? '').trim() || null,
      leverpostcode: String(formData.get('leverpostcode') ?? '').trim() || null,
      leverplaats: String(formData.get('leverplaats') ?? '').trim() || null,
      factuuradres: String(formData.get('factuuradres') ?? '').trim() || null,
      factuurpostcode: String(formData.get('factuurpostcode') ?? '').trim() || null,
      factuurplaats: String(formData.get('factuurplaats') ?? '').trim() || null,
    });
  }
  redirect('/dashboard/klanten/' + id + '/structuur');
}

export async function verwijderAfdelingActie(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('orgId') ?? '');
  const afdelingId = String(formData.get('afdelingId') ?? '');
  if (afdelingId) await verwijderAfdeling(afdelingId);
  redirect('/dashboard/klanten/' + id + '/structuur');
}

export async function bewaarManagerScope(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('orgId') ?? '');
  const gebruikerId = String(formData.get('gebruikerId') ?? '');
  const scope = String(formData.get('scope') ?? '').trim();
  let vestigingId: string | null = null;
  let afdelingId: string | null = null;
  if (scope.startsWith('v:')) vestigingId = scope.slice(2);
  else if (scope.startsWith('a:')) afdelingId = scope.slice(2);
  if (gebruikerId) await zetManagerScope(gebruikerId, vestigingId, afdelingId);
  redirect('/dashboard/klanten/' + id + '/structuur');
}
