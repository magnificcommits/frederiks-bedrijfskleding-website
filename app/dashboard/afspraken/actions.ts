'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { logAudit } from '@/lib/kms/audit';
import { zetAfspraakStatus } from '@/lib/afspraken/afspraken';
import { zetBeschikbaarheid } from '@/lib/afspraken/beschikbaarheid';
import { AFSPRAAK_SOORTEN, normaliseerBeschikbaarheid } from '@/lib/afspraken/soorten';
import { isDatum, plusDagen } from '@/app/dashboard/taken/tijd';

const UUID = /^[0-9a-f-]{36}$/i;

/** Status van een online afspraak zetten (Afspraken in het KMS). */
export async function zetAfspraakStatusActie(formData: FormData): Promise<void> {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  const tab = String(formData.get('tab') ?? 'komend');
  const mailKlant = formData.get('mail_klant') === 'on';
  if (!UUID.test(id)) redirect(`/dashboard/afspraken?tab=${encodeURIComponent(tab)}&melding=mislukt`);
  const res = await zetAfspraakStatus(id, status, mailKlant);
  if (res.ok) await logAudit('afspraak_status', { entiteit: 'afspraak', entiteitId: id, details: { status, mailKlant } });
  revalidatePath('/dashboard/afspraken');
  revalidatePath('/dashboard/taken');
  redirect(`/dashboard/afspraken?tab=${encodeURIComponent(tab)}&melding=${res.ok ? 'status' : encodeURIComponent(res.fout ?? 'mislukt')}`);
}

/** Losse regels "2026-12-24" of "2026-12-24 t/m 2026-12-31" naar een lijst datums. */
function leesGeblokkeerd(invoer: string): string[] {
  const uit: string[] = [];
  for (const regel of invoer.split(/[\n,;]+/)) {
    // Scheidingsteken met spaties eromheen: het streepje in een datum zelf telt niet.
    const delen = regel.trim().split(/\s+(?:t\/m|tm|tot en met|-|–)\s+/i).filter(Boolean);
    if (delen.length === 1 && isDatum(delen[0])) uit.push(delen[0]);
    if (delen.length === 2 && isDatum(delen[0]) && isDatum(delen[1]) && delen[1] >= delen[0]) {
      for (let d = delen[0], n = 0; d <= delen[1] && n < 370; d = plusDagen(d, 1), n++) uit.push(d);
    }
  }
  return uit;
}

/** "09:00-12:00, 13:00-17:00" naar tijdvakken. */
function leesTijdvakken(invoer: string): { van: string; tot: string }[] {
  return invoer
    .split(/[\n,;]+/)
    .map((r) => r.trim().replace(/\./g, ':'))
    .map((r) => /^(\d{1,2}:\d{2})\s*(?:-|–|tot)\s*(\d{1,2}:\d{2})$/.exec(r))
    .filter((m): m is RegExpExecArray => Boolean(m))
    .map((m) => ({ van: m[1].padStart(5, '0'), tot: m[2].padStart(5, '0') }));
}

export async function zetBeschikbaarheidActie(formData: FormData): Promise<void> {
  if (!(await dashAuthed())) redirect('/dashboard');
  await eisEigenaar();
  const soorten = Object.fromEntries(
    AFSPRAAK_SOORTEN.map((s) => [s, { actief: formData.get(`${s}_actief`) === 'on', duurMin: Number(formData.get(`${s}_duur`)) }]),
  );
  const ruw: Record<string, unknown> = {
    werkdagen: formData.getAll('werkdagen').map((d) => Number(d)),
    tijdvakken: leesTijdvakken(String(formData.get('tijdvakken') ?? '')),
    bufferMin: Number(formData.get('bufferMin')),
    maxPerDag: Number(formData.get('maxPerDag')),
    dagenVooruit: Number(formData.get('dagenVooruit')),
    minUrenVooraf: Number(formData.get('minUrenVooraf')),
    stapMin: Number(formData.get('stapMin')),
    geblokkeerd: leesGeblokkeerd(String(formData.get('geblokkeerd') ?? '')),
    soorten,
    persoonId: String(formData.get('persoonId') ?? '') || null,
  };
  const schoon = normaliseerBeschikbaarheid(ruw);
  const ok = await zetBeschikbaarheid(schoon);
  if (ok) await logAudit('afspraken_instellingen', { entiteit: 'instellingen', entiteitId: 'afspraken_beschikbaarheid', details: schoon as unknown as Record<string, unknown> });
  revalidatePath('/dashboard/afspraken/instellingen');
  redirect(`/dashboard/afspraken/instellingen?melding=${ok ? 'opgeslagen' : 'mislukt'}`);
}
