import { NextResponse } from 'next/server';
import { dashAuthed } from '@/lib/kms/adminClient';
import { logAudit } from '@/lib/kms/audit';
import { maakLogo } from '@/lib/kms/logos';
import { uploadDrukproefAfbeelding, DRUKPROEF_SOORTEN, type DrukproefBestandSoort } from '@/lib/kms/drukproefOpslag';

/**
 * Upload voor de drukproef-editor (logo, voorkant- of achterkantfoto).
 *
 * Dit is een gewone route in plaats van een server-actie: server-acties mogen maar
 * 1 MB ontvangen en een foto of logo is vaak groter. De editor verkleint te grote
 * foto's (boven 4 MB) eerst in de browser, zodat ook de limiet van de hosting past.
 *
 * Bij een logo kan Jessi kiezen om het meteen in de logobibliotheek van de klant te
 * bewaren, zodat ze het de volgende keer gewoon kan kiezen.
 */

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  if (!(await dashAuthed())) {
    return NextResponse.json({ ok: false, melding: 'Je bent niet meer ingelogd. Log opnieuw in.' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, melding: 'Het bestand kwam niet goed binnen. Probeer het nog een keer.' }, { status: 400 });
  }

  const soortRuw = String(form.get('soort') ?? '');
  const soort: DrukproefBestandSoort = (DRUKPROEF_SOORTEN as readonly string[]).includes(soortRuw)
    ? (soortRuw as DrukproefBestandSoort)
    : 'logo';
  const bestand = form.get('bestand');
  const file = bestand instanceof File ? bestand : null;

  const uitkomst = await uploadDrukproefAfbeelding(file, soort);
  if (!uitkomst.ok) return NextResponse.json(uitkomst, { status: 400 });

  let inBibliotheek = false;
  const orgId = String(form.get('org_id') ?? '').trim();
  if (soort === 'logo' && form.get('bewaar_logo') === '1' && UUID.test(orgId)) {
    const punt = uitkomst.naam.lastIndexOf('.');
    const naam = (String(form.get('logo_naam') ?? '').trim() || (punt > 0 ? uitkomst.naam.slice(0, punt) : uitkomst.naam) || 'Logo').slice(0, 120);
    inBibliotheek = await maakLogo(orgId, {
      naam,
      logo_bestand_url: uitkomst.url,
      logo_bestand_naam: uitkomst.naam,
      opmerkingen: 'Toegevoegd vanuit de drukproef-editor',
    });
    if (inBibliotheek) {
      await logAudit('logo_aangemaakt', { entiteit: 'logo', details: { naam, organisatie_id: orgId, bron: 'drukproef-editor' } });
    }
  }

  return NextResponse.json({ ok: true, url: uitkomst.url, naam: uitkomst.naam, inBibliotheek });
}
