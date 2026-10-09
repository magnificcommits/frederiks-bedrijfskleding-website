import { kmsAdmin } from '@/lib/kms/adminClient';
import { sendEmail, emailLayout, escapeHtml } from '@/lib/email';
import { site } from '@/content/site';

/**
 * Medewerker-wijzigingsverzoeken (Jessi-kant, service-role). Beheerders dienen via het
 * portaal een verzoek in om een medewerker toe te voegen of te laten vertrekken; Jessi
 * keurt hier goed of af. Bij goedkeuren wordt de wijziging echt doorgevoerd, plus een
 * e-mail en een portaalmelding naar de medewerker.
 */

export const VERZOEK_STATUSSEN = ['wacht', 'goedgekeurd', 'afgewezen'] as const;

type SbAdmin = NonNullable<ReturnType<typeof kmsAdmin>>;

export type MedewerkerVerzoek = {
  id: string;
  organisatie_id: string;
  type: string;
  medewerker_id: string | null;
  naam: string | null;
  email: string | null;
  functie: string | null;
  budget: number | null;
  status: string;
  aangevraagd_door: string | null;
  behandeld_door: string | null;
  behandeld_op: string | null;
  notitie: string | null;
  created_at: string;
};

export type VerzoekMetKlant = MedewerkerVerzoek & { organisatie_naam: string | null; medewerker_naam: string | null };

export async function listVerzoeken(status?: string): Promise<VerzoekMetKlant[]> {
  const sb = kmsAdmin(); if (!sb) return [];
  let q = sb.from('medewerker_verzoeken').select('*, organisaties(naam), medewerkers(naam)').order('created_at', { ascending: false });
  if (status && status.trim()) q = q.eq('status', status.trim());
  const { data } = await q;
  const rows = (data as unknown as (MedewerkerVerzoek & { organisaties: { naam: string } | null; medewerkers: { naam: string } | null })[]) ?? [];
  return rows.map((r) => {
    const { organisaties, medewerkers, ...rest } = r;
    return { ...rest, organisatie_naam: organisaties?.naam ?? null, medewerker_naam: medewerkers?.naam ?? null } as VerzoekMetKlant;
  });
}

export async function aantalWachtVerzoeken(): Promise<number> {
  const sb = kmsAdmin(); if (!sb) return 0;
  const { count } = await sb.from('medewerker_verzoeken').select('id', { count: 'exact', head: true }).eq('status', 'wacht');
  return count ?? 0;
}

/** HTML van het bericht aan een werknemer over een verwerkt verzoek. */
export function medewerkerBerichtHtml(tekst: string): string {
  return emailLayout({
    heading: 'Bericht over je bedrijfskleding',
    preheader: tekst,
    bodyHtml: `<p style="margin:14px 0 0;color:#1c1c1c;">${escapeHtml(tekst)}</p><p style="margin:18px 0 0;">Vragen? Bel <strong style="color:#1c1c1c;">${escapeHtml(site.phone)}</strong> of mail naar ${escapeHtml(site.email)}.</p><p style="margin:20px 0 0;">Groet,<br/>Frederiks Bedrijfskleding</p>`,
  });
}

async function meldNaarMedewerker(sb: SbAdmin, orgId: string, medewerkerId: string | null, email: string | null, tekst: string): Promise<void> {
  if (medewerkerId) {
    await sb.from('portaal_meldingen').insert({ organisatie_id: orgId, medewerker_id: medewerkerId, tekst });
  }
  if (email && email.trim()) {
    await sendEmail({
      to: email.trim(),
      subject: 'Bericht van Frederiks Bedrijfskleding',
      html: medewerkerBerichtHtml(tekst),
    }).catch(() => {});
  }
}

/** Keurt een verzoek goed: voert de wijziging door en stuurt e-mail plus portaalmelding. */
/** Keurt goed. Bij toevoegen komt de nieuwe werknemer terug, zodat Jessi meteen de maten kan invullen. */
export async function keurGoedVerzoek(
  id: string,
  doorWie: string,
): Promise<{ ok: boolean; organisatieId?: string; nieuweWerknemerId?: string | null }> {
  const sb = kmsAdmin(); if (!sb) return { ok: false };
  const { data } = await sb.from('medewerker_verzoeken').select('*').eq('id', id).maybeSingle();
  const v = data as MedewerkerVerzoek | null;
  if (!v || v.status !== 'wacht') return { ok: false };
  let nieuweWerknemerId: string | null = null;

  if (v.type === 'toevoegen') {
    const { data: nieuw } = await sb
      .from('medewerkers')
      .insert({ organisatie_id: v.organisatie_id, naam: v.naam, email: v.email, functie: v.functie, budget: v.budget, actief: true })
      .select('id')
      .single();
    const nieuweId = (nieuw as { id: string } | null)?.id ?? null;
    nieuweWerknemerId = nieuweId;
    await meldNaarMedewerker(sb, v.organisatie_id, nieuweId, v.email, 'Je bent aangemeld voor bedrijfskleding bij Frederiks Bedrijfskleding. Je kunt binnenkort je kleding bestellen via het klantportaal.');
  } else if (v.type === 'verwijderen' && v.medewerker_id) {
    await sb.from('medewerkers').update({ actief: false, datum_uit_dienst: new Date().toISOString().slice(0, 10) }).eq('id', v.medewerker_id);
    await meldNaarMedewerker(sb, v.organisatie_id, v.medewerker_id, v.email, 'Je bedrijfskleding-account bij Frederiks Bedrijfskleding is afgesloten. Bedankt en het ga je goed.');
  }

  const { error } = await sb
    .from('medewerker_verzoeken')
    .update({ status: 'goedgekeurd', behandeld_door: doorWie, behandeld_op: new Date().toISOString() })
    .eq('id', id);
  return { ok: !error, organisatieId: v.organisatie_id, nieuweWerknemerId };
}

export async function wijsAfVerzoek(id: string, doorWie: string, notitie?: string): Promise<boolean> {
  const sb = kmsAdmin(); if (!sb) return false;
  const { error } = await sb
    .from('medewerker_verzoeken')
    .update({ status: 'afgewezen', behandeld_door: doorWie, behandeld_op: new Date().toISOString(), notitie: notitie?.trim() || null })
    .eq('id', id);
  return !error;
}
