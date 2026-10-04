import { kmsAdmin } from '@/lib/kms/adminClient';
import { logAudit } from '@/lib/kms/audit';

/**
 * Logo's die bij een webaanvraag zijn geüpload (tabel lead_logos).
 * Zolang de lead nog geen klant is, staan ze hier; logos.organisatie_id is
 * verplicht. Bij omzetten of koppelen naar een klant komt elk logo als gewone
 * rij in de logobibliotheek van die klant en wijst lead_logos.logo_id daarheen.
 */

export type LeadLogo = {
  id: string;
  lead_id: string;
  logo_url: string;
  logo_naam: string | null;
  bron: string | null;
  logo_id: string | null;
  created_at: string;
};

export type LeadLogoMetLead = LeadLogo & { lead_naam: string; lead_bedrijf: string | null };

export async function listLeadLogos(leadId: string): Promise<LeadLogo[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from('lead_logos')
    .select('id, lead_id, logo_url, logo_naam, bron, logo_id, created_at')
    .eq('lead_id', leadId)
    .order('created_at');
  if (error) return [];
  return (data as LeadLogo[]) ?? [];
}

/** Logo's van leads die nog geen klant zijn: voor de logobibliotheek. */
export async function listOpenLeadLogos(limiet = 60): Promise<LeadLogoMetLead[]> {
  const sb = kmsAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from('lead_logos')
    .select('id, lead_id, logo_url, logo_naam, bron, logo_id, created_at, leads(name, company)')
    .is('logo_id', null)
    .order('created_at', { ascending: false })
    .limit(limiet);
  if (error) return [];
  return ((data as unknown as (LeadLogo & { leads: { name: string; company: string | null } | null })[]) ?? []).map(({ leads, ...l }) => ({
    ...l,
    lead_naam: leads?.name ?? 'Onbekend',
    lead_bedrijf: leads?.company ?? null,
  }));
}

/**
 * Zet de nog niet overgezette logo's van een lead in de logobibliotheek van de
 * klant. Geeft het aantal overgezette logo's terug. Faalt stil (best effort).
 */
export async function zetLeadLogosNaarKlant(leadId: string, orgId: string): Promise<number> {
  const sb = kmsAdmin();
  if (!sb) return 0;
  const { data, error } = await sb.from('lead_logos').select('id, logo_url, logo_naam, bron').eq('lead_id', leadId).is('logo_id', null);
  if (error || !data?.length) return 0;
  let aantal = 0;
  for (const l of data as { id: string; logo_url: string; logo_naam: string | null; bron: string | null }[]) {
    const naam = (l.logo_naam ?? 'Logo').replace(/\.[a-z0-9]{2,4}$/i, '') || 'Logo';
    // Een SVG is al een vectorbestand; de rest (png, jpg, webp) is een gewoon logobestand.
    const vector = /\.svg(\?|$)/i.test(l.logo_url) || /\.svg$/i.test(l.logo_naam ?? '');
    const { data: logo, error: e } = await sb
      .from('logos')
      .insert({
        organisatie_id: orgId,
        naam: naam.slice(0, 120),
        ...(vector
          ? { vectorbestand_url: l.logo_url, vectorbestand_naam: l.logo_naam }
          : { logo_bestand_url: l.logo_url, logo_bestand_naam: l.logo_naam }),
        opmerkingen: `Aangeleverd via de website (${l.bron ?? 'webaanvraag'}). Controleer of het geschikt is voor borduren of bedrukken.`,
      })
      .select('id')
      .single();
    if (e || !logo) {
      console.error('[lead] logo naar klant mislukt:', e?.message);
      continue;
    }
    await sb.from('lead_logos').update({ logo_id: (logo as { id: string }).id }).eq('id', l.id);
    aantal += 1;
  }
  if (aantal) await logAudit('lead.logos_naar_klant', { entiteit: 'lead', entiteitId: leadId, details: { organisatie_id: orgId, aantal } });
  return aantal;
}
